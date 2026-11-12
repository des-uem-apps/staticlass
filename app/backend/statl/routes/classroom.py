from pathlib import Path
from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import or_
from statl.models.classroom import ClassroomList
from statl.utils.auth_middleware import require_role

bp = Blueprint("classroom_lists", __name__, url_prefix="/lists/classroom")
ROLES = ["admin", "professor", "aluno"]


def _allowed(row, user_id):
    return row is not None and int(user_id) in (row.owner_id, row.manager_id)


def _serialize(row, detail=False):
    files = [{key: value for key, value in item.items() if key != "storage_path"} for item in (row.attachments or [])]
    result = {"id": row.id, "title": row.title, "course_id": row.course_id, "course_name": row.course_name,
              "course_state": row.course_state, "kind": row.kind, "source_url": row.source_url,
              "due_at": row.due_at.isoformat() if row.due_at else None,
              "attachment_count": len(files), "downloaded_count": sum(f.get("available", False) for f in files)}
    if detail:
        result.update(description=row.description, attachments=files)
    return result


@bp.get("")
@require_role(ROLES)
def list_imports():
    user_id = int(get_jwt_identity())
    rows = ClassroomList.query.filter(or_(ClassroomList.owner_id == user_id, ClassroomList.manager_id == user_id)).order_by(ClassroomList.course_name, ClassroomList.id).all()
    return jsonify([_serialize(row) for row in rows])


@bp.get("/<int:list_id>")
@require_role(ROLES)
def detail(list_id):
    row = ClassroomList.query.filter_by(id=list_id).first()
    if not _allowed(row, get_jwt_identity()):
        return jsonify(error="Lista não encontrada."), 404
    return jsonify(_serialize(row, detail=True))


def _signer():
    return URLSafeTimedSerializer(current_app.secret_key, salt="classroom-private-attachment")


@bp.post("/<int:list_id>/files/<file_id>/access")
@require_role(ROLES)
def attachment_access(list_id, file_id):
    row = ClassroomList.query.filter_by(id=list_id).first()
    if not _allowed(row, get_jwt_identity()):
        return jsonify(error="Lista não encontrada."), 404
    attachment = next((f for f in (row.attachments or []) if f.get("id") == file_id and f.get("available")), None)
    if not attachment:
        return jsonify(error="Arquivo não disponível."), 404
    ticket = _signer().dumps({"list_id": list_id, "file_id": file_id, "user_id": int(get_jwt_identity())})
    return jsonify(url=f"/lists/classroom/{list_id}/files/{file_id}?ticket={ticket}", mime_type=attachment.get("mime_type"), name=attachment["name"])


@bp.get("/<int:list_id>/files/<file_id>")
def attachment_file(list_id, file_id):
    try:
        ticket = _signer().loads(request.args.get("ticket", ""), max_age=900)
    except (BadSignature, SignatureExpired):
        return jsonify(error="Link inválido ou expirado. Abra o arquivo novamente."), 403
    row = ClassroomList.query.filter_by(id=list_id).first()
    if ticket.get("list_id") != list_id or ticket.get("file_id") != file_id or not _allowed(row, ticket.get("user_id", -1)):
        return jsonify(error="Arquivo não encontrado."), 404
    attachment = next((f for f in row.attachments if f.get("id") == file_id and f.get("available")), None)
    if not attachment:
        return jsonify(error="Arquivo não encontrado."), 404
    base = Path(current_app.config["CLASSROOM_STORAGE_PATH"]).resolve()
    target = (base / attachment["storage_path"]).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        return jsonify(error="Arquivo não encontrado."), 404
    mime = attachment.get("mime_type") or "application/octet-stream"
    inline = mime in ("application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp") and request.args.get("download") != "1"
    response = send_from_directory(base, target.relative_to(base), mimetype=mime, as_attachment=not inline, download_name=attachment["name"], conditional=True)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self'; object-src 'none'"
    return response
