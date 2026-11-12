import re
import secrets
from datetime import datetime, timedelta

from flask import current_app, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash

from statl.security.tokens import (
    generate_reset_token,
    verify_reset_token,
    generate_verification_token,
    verify_verification_token,
)
from statl.services.email_service import send_reset_email, send_otp_email

from ..repositories.user_repository import (
    atualizar_senha,
    buscar_usuario_por_email,
    buscar_usuario_por_id,
    buscar_usuario_por_ra,
    criar_usuario,
    set_otp_code,
    clear_otp_code,
    verificar_email_usuario,
)

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)

def email_valido(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))


def register_user(data):
    if not data:
        return None, jsonify({"error": "Requisicao invalida"}), 400
    if buscar_usuario_por_email(data.get("email")) is not None:
        return None, jsonify({"error": "Usuario ja registrado."}), 400

    if not all(k in data for k in ("email", "password", "confirm_password", "name")):
        return None, jsonify({"error": "Campos obrigatórios ausentes."}), 400

    if data["password"] != data["confirm_password"]:
        return None, jsonify({"error": "As senhas nao coincidem."}), 400

    email = data["email"]
    password = data["password"]
    name = data["name"]
    ra = data.get("ra", None)
    is_uem = data.get("is_uem", False)

    ano_ingresso = data.get("ano_ingresso")
    if ano_ingresso not in (None, ""):
        try:
            ano_ingresso = int(ano_ingresso)
        except (TypeError, ValueError):
            return None, jsonify({"error": "Ano de ingresso deve ser numérico."}), 400
    else:
        ano_ingresso = None

    if not email_valido(email):
        return None, jsonify({"error": "Email invalido."}), 400

    if is_uem and not ra:
        return None, jsonify({"error": "RA é obrigatório para alunos da UEM."}), 400

    if ra:
        nivel_curso = data.get("nivel_curso", "graduacao")
        if nivel_curso not in ("graduacao", "mestrado"):
            return None, jsonify({"error": "Selecione Graduação ou Mestrado."}), 400
        if not isinstance(ra, str) or not re.fullmatch(r"[0-9]{1,28}", ra):
            return None, jsonify({"error": "Informe apenas os números do RA (até 28 dígitos)."}), 400
        ra = ("pg" if nivel_curso == "mestrado" else "ra") + ra
        if buscar_usuario_por_ra(ra) is not None:
            return None, jsonify({"error": "RA já cadastrado."}), 400

    user_id = criar_usuario(email, generate_password_hash(password), name, ra=ra, ano_ingresso=ano_ingresso)

    try:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        expires = datetime.utcnow() + timedelta(minutes=15)
        set_otp_code(user_id, otp, expires)
        send_otp_email(to=email, otp_code=otp)
    except Exception:
        # não bloqueia o registro se o email falhar, mas precisa ficar
        # visível no log — antes disso era engolido em silêncio e
        # ninguém percebia que o OTP nunca chegava.
        current_app.logger.exception("Falha ao enviar OTP de verificação para %s", email)
        return None, jsonify({
            "error": "Sua conta foi criada, mas não foi possível enviar o código. Tente reenviar mais tarde.",
            "verification_pending": True,
        }), 503

    return user_id, None, 201



# testar mais vezes
def login_user(data):
    ''' Serviço para autenticar um usuário e gerar um token JWT.
    '''

    if not data:
        return None, jsonify({"error": "Requisicao invalida"}), 400
    try:
        email = data["email"]
        password = data["password"]

    except KeyError as e:
        return None, jsonify({"error": f"Campo obrigatório ausente: {e}"}), 400

    user = buscar_usuario_por_email(email)


    if user is None or not check_password_hash(user.password_hash, password):
        return None, jsonify({"error": "Email ou senha incorretos."}), 400

    if not user.active:
        return None, jsonify({"error": "Conta desativada. Contate o administrador."}), 403

    if not user.email_verified:
        return None, jsonify({
            "error": "Email não verificado. Verifique seu email antes de fazer login.",
            "email_verified": False,
        }), 403

    token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role,
            "email": user.email,
            "name": user.name,
            "email_verified": bool(user.email_verified),
        }
    )
    return token, None, 200




def request_password_reset(email: str):
    ''' Servico para solicitar a redefinição de senha.
    '''
    user = buscar_usuario_por_email(email)
    if not user:
        return None

    token = generate_reset_token(user.id)

    send_reset_email(to=user.email, token=token)
    return token





def verify_email_token(token: str) -> bool:
    ''' Verifica o token de email e ativa a conta se válido.
    '''
    user_id = verify_verification_token(token)
    if not user_id:
        return False
    user = buscar_usuario_por_id(user_id)
    if not user:
        return False
    verificar_email_usuario(user_id)
    return True


def verify_otp_service(email: str, code: str) -> tuple[bool, str]:
    user = buscar_usuario_por_email(email)
    if not user or user.otp_code != code:
        return False, "Código inválido"
    expires = user.otp_expires_at
    if expires is None:
        return False, "Código expirado. Solicite um novo."
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if datetime.utcnow() > expires:
        return False, "Código expirado. Solicite um novo."
    verificar_email_usuario(user.id)
    clear_otp_code(user.id)
    return True, ""


def resend_verification_service(email: str) -> None:
    if not current_app.testing and not current_app.config.get("MAIL_DEFAULT_SENDER", (None, ""))[1]:
        raise RuntimeError("Email sender is not configured")
    user = buscar_usuario_por_email(email)
    if not user or user.email_verified:
        return
    try:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        expires = datetime.utcnow() + timedelta(minutes=15)
        set_otp_code(user.id, otp, expires)
        send_otp_email(to=email, otp_code=otp)
    except Exception:
        current_app.logger.exception("Falha ao reenviar OTP de verificação para %s", email)
        raise


def reset_password(token: str, new_password: str):
    ''' Serviço para redefinir a senha do usuário.
    '''
    user_id = verify_reset_token(token)
    if not user_id:
        return False

    user = buscar_usuario_por_id(user_id)
    if not user:
        return False

    password_hash = generate_password_hash(new_password)
    atualizar_senha(user.id, password_hash)
    return True
