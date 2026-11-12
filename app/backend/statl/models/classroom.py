from datetime import datetime
from statl import db


class ClassroomList(db.Model):
    __tablename__ = "classroom_lists"
    __table_args__ = (db.UniqueConstraint("owner_id", "course_id", "post_type", "post_id", name="uq_classroom_owner_post"),)

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    manager_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    course_id = db.Column(db.String(80), nullable=False)
    course_name = db.Column(db.Text, nullable=False)
    course_state = db.Column(db.String(30), nullable=True)
    post_id = db.Column(db.String(80), nullable=False)
    post_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    source_url = db.Column(db.Text, nullable=True)
    kind = db.Column(db.String(20), nullable=False, default="material")
    due_at = db.Column(db.DateTime, nullable=True)
    attachments = db.Column(db.JSON, nullable=False, default=list)
    imported_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
