"""Import an extracted Classroom archive into the owner's private list library."""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from statl import create_app, db
from statl.models.user import User
from statl.models.classroom import ClassroomList


def import_archive(manifest, owner_email, manager_email):
    owner = User.query.filter_by(email=owner_email).one()
    manager = User.query.filter_by(email=manager_email).one()
    files = manifest.get("files", {})
    file_by_post = {}
    for file in files.values():
        for context in file.get("contexts", []):
            key = (context["courseId"], context["category"], context["postId"])
            file_by_post.setdefault(key, {})[file["id"]] = file
    imported = updated = 0
    for group in manifest["courses"]:
        course = group["course"]
        for category, posts in group["posts"].items():
            for post in posts:
                key = (course["id"], category, post["id"])
                attachments = []
                related = list(file_by_post.get(key, {}).values())
                references = {m['driveFile']['driveFile']['id']: m['driveFile']['driveFile'] for m in post.get('materials', []) if m.get('driveFile', {}).get('driveFile', {}).get('id')}
                title = (post.get("title") or (post.get("text") or "Material do Classroom").splitlines()[0]).strip()
                description = post.get("description") or post.get("text") or ""
                names = " ".join(f.get("name", "") for f in related)
                keyword = bool(re.search(r"lista|exerc[ií]cio|problem[as]|atividade|trabalho|tarefa|prova|teste|roteiro|question[aá]rio", title + " " + names, re.I))
                # All assigned coursework is kept; announcements without documents are not worksheets.
                kind = "lista" if keyword or category == "courseWork" else "material"
                external_material = any(m.get("link", {}).get("url") or m.get("form", {}).get("formUrl") for m in post.get("materials", []))
                if not related and category != "courseWork" and not (category == "materials" and (keyword or external_material)) and not (category == "announcements" and keyword and external_material):
                    continue
                for file in related:
                    available = file.get("status") == "downloaded"
                    attachments.append({"id": file["id"], "name": (Path(file["localPath"].replace("\\", "/")).name if file.get("exportMimeType") else file.get("name")) or references.get(file["id"], {}).get("title") or title + " — arquivo",
                        "mime_type": file.get("exportMimeType") or file.get("mimeType"),
                        "size": file.get("downloadedBytes"), "available": available,
                        "source_url": file.get("webViewLink") or references.get(file["id"], {}).get("alternateLink") or "https://drive.google.com/open?id=" + file["id"], "status": file.get("status"),
                        "storage_path": file.get("localPath", "").replace("\\", "/") if available else None})
                for index, material in enumerate(post.get("materials", [])):
                    link = material.get("link") or material.get("form") or {}
                    url = link.get("url") or link.get("formUrl")
                    if url:
                        attachments.append({"id": f"link-{index}", "name": link.get("title") or "Abrir material original", "available": False, "source_url": url, "status": "external_link"})
                row = ClassroomList.query.filter_by(owner_id=owner.id, course_id=course["id"], post_type=category, post_id=post["id"]).first()
                if row is None:
                    row = ClassroomList(owner_id=owner.id, manager_id=manager.id, course_id=course["id"], post_type=category, post_id=post["id"])
                    db.session.add(row); imported += 1
                else:
                    updated += 1
                row.manager_id = manager.id
                row.course_name = course["name"]
                row.course_state = course.get("courseState")
                row.title = title
                row.description = description
                row.kind = kind
                row.source_url = post.get("alternateLink") or course.get("alternateLink")
                row.attachments = attachments
                due = post.get("dueDate")
                if due:
                    hour = post.get("dueTime", {})
                    row.due_at = datetime(due["year"], due["month"], due["day"], hour.get("hours", 23), hour.get("minutes", 59))
    db.session.commit()
    return {"inserted": imported, "updated": updated, "total": ClassroomList.query.filter_by(owner_id=owner.id).count(),
            "lists": ClassroomList.query.filter_by(owner_id=owner.id, kind="lista").count()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--manager-email", required=True)
    args = parser.parse_args()
    app = create_app()
    with app.app_context():
        print(json.dumps(import_archive(json.loads(args.manifest.read_text()), args.owner_email, args.manager_email)))
