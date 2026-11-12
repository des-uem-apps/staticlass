from datetime import datetime

from .. import db
from sqlalchemy import text


_CAMPOS_ATUALIZAVEIS = {"name", "email", "xp", "active", "password_hash"}


def buscar_usuario_por_email(email):
    result = db.session.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": email},
    )
    row = result.fetchone()
    result.close()
    return row


def buscar_usuario_por_id(usuario_id):
    result = db.session.execute(
        text("SELECT * FROM users WHERE id = :id"),
        {"id": usuario_id},
    )
    row = result.fetchone()
    result.close()
    return row


def criar_usuario(email, senha_hash, nome, ra=None, ano_ingresso=None):
    resultado = db.session.execute(
        text("""
            INSERT INTO users (email, password_hash, name, role, active, xp, email_verified, ra, ano_ingresso)
            VALUES (:email, :senha_hash, :nome, 'aluno', TRUE, 0, FALSE, :ra, :ano_ingresso)
            RETURNING id
        """),
        {"email": email, "senha_hash": senha_hash, "nome": nome, "ra": ra, "ano_ingresso": ano_ingresso},
    )
    new_id = resultado.scalar()
    db.session.commit()
    return new_id


def buscar_usuario_por_ra(ra):
    result = db.session.execute(
        text("SELECT * FROM users WHERE LOWER(ra) = LOWER(:ra)"),
        {"ra": ra},
    )
    row = result.fetchone()
    result.close()
    return row


def set_otp_code(usuario_id, code, expires_at):
    db.session.execute(
        text("UPDATE users SET otp_code = :code, otp_expires_at = :exp WHERE id = :id"),
        {"code": code, "exp": expires_at, "id": usuario_id},
    )
    db.session.commit()


def clear_otp_code(usuario_id):
    db.session.execute(
        text("UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = :id"),
        {"id": usuario_id},
    )
    db.session.commit()


def criar_usuario_pendente(email, nome_placeholder):
    import secrets
    senha_inutilizavel = secrets.token_hex(32)
    from werkzeug.security import generate_password_hash
    resultado = db.session.execute(
        text("""
            INSERT INTO users (email, password_hash, name, role, active, xp, email_verified)
            VALUES (:email, :senha_hash, :nome, 'aluno', TRUE, 0, FALSE)
            RETURNING id
        """),
        {"email": email, "senha_hash": generate_password_hash(senha_inutilizavel), "nome": nome_placeholder},
    )
    new_id = resultado.scalar()
    db.session.commit()
    return new_id


def verificar_email_usuario(usuario_id):
    db.session.execute(
        text("UPDATE users SET email_verified = TRUE WHERE id = :id"),
        {"id": usuario_id},
    )
    db.session.commit()


def criar_usuario_com_papel(email, senha_hash, nome, papel):
    resultado = db.session.execute(
        text("""
            INSERT INTO users (email, password_hash, name, role, active, xp)
            VALUES (:email, :senha_hash, :nome, :papel, TRUE, 0)
            RETURNING id
        """),
        {"email": email, "senha_hash": senha_hash, "nome": nome, "papel": papel},
    )
    new_id = resultado.scalar()
    db.session.commit()
    return new_id


def atualizar_usuario(usuario_id, dados):
    campos = {k: v for k, v in dados.items() if k in _CAMPOS_ATUALIZAVEIS}
    if not campos:
        raise KeyError("nenhum campo válido para atualizar")
    campos["id"] = usuario_id
    atribuicoes = ", ".join(f"{k} = :{k}" for k in campos if k != "id")
    try:
        db.session.execute(text(f"UPDATE users SET {atribuicoes} WHERE id = :id"), campos)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise KeyError(f"erro ao atualizar usuário: {e}")


def atualizar_senha(usuario_id, nova_senha_hash):
    try:
        db.session.execute(
            text("UPDATE users SET password_hash = :senha_hash WHERE id = :id"),
            {"senha_hash": nova_senha_hash, "id": usuario_id},
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise KeyError(f"erro ao atualizar senha: {e}")


def deletar_usuario(usuario_id):
    try:
        db.session.execute(text("DELETE FROM users WHERE id = :id"), {"id": usuario_id})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise KeyError(f"erro ao deletar usuário: {e}")


def listar_professores():
    return db.session.execute(
        text("SELECT id, name, email FROM users WHERE role = 'professor' ORDER BY name"),
    ).mappings().all()


def listar_alunos():
    return db.session.execute(
        text("SELECT id, name, email, ano_ingresso FROM users WHERE role = 'aluno' ORDER BY name"),
    ).mappings().all()


def listar_usuarios_por_papel(papel):
    return db.session.execute(
        text("""
            SELECT id, name, email, active, COALESCE(xp, 0) AS xp
            FROM users
            WHERE role = :papel
            ORDER BY name
        """),
        {"papel": papel},
    ).mappings().all()
