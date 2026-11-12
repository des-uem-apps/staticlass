import json
import tempfile
import unittest
from pathlib import Path
from flask_jwt_extended import create_access_token
from statl import create_app, db
from statl.models.user import User
from statl.models.classroom import ClassroomList
from statl.import_classroom import import_archive


class ClassroomImportTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(testing=True)
        self.client = self.app.test_client()
        self.temp = tempfile.TemporaryDirectory()
        self.app.config['UPLOAD_FOLDER'] = str(Path(self.temp.name) / 'public')
        self.app.config['CLASSROOM_STORAGE_PATH'] = str(Path(self.temp.name) / 'private')
        with self.app.app_context():
            db.session.add_all([User(id=i, email=f'user{i}@example.com', name='User', role='aluno' if i != 2 else 'admin', password_hash='unused') for i in [1, 2, 3]])
            db.session.commit()
        self.manifest = {
            'courses': [{'course': {'id': 'course1', 'name': 'Inferência II', 'courseState': 'ARCHIVED'}, 'posts': {
                'courseWork': [{'id': 'post1', 'title': 'Lista 1', 'description': 'Resolva as questões.'}], 'materials': [], 'announcements': [],
            }}],
            'files': {'file1234567890': {'id': 'file1234567890', 'name': 'Lista 1.pdf', 'mimeType': 'application/pdf', 'status': 'downloaded',
                'localPath': 'files/file1234567890/lista.pdf', 'downloadedBytes': 12,
                'contexts': [{'courseId': 'course1', 'category': 'courseWork', 'postId': 'post1'}]}},
        }
        target = Path(self.temp.name) / 'private/files/file1234567890/lista.pdf'
        target.parent.mkdir(parents=True)
        target.write_bytes(b'%PDF-example')
        with self.app.app_context():
            import_archive(self.manifest, 'user1@example.com', 'user2@example.com')
            self.list_id = ClassroomList.query.one().id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove(); db.drop_all()
        self.temp.cleanup()

    def headers(self, user_id):
        with self.app.app_context():
            token = create_access_token(identity=str(user_id), additional_claims={'role': 'admin' if user_id == 2 else 'aluno'})
        return {'Authorization': 'Bearer ' + token}

    def test_owner_and_importing_admin_can_see_lists_but_other_users_cannot(self):
        for user_id in [1, 2]:
            response = self.client.get('/lists/classroom', headers=self.headers(user_id))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json), 1)
        self.assertEqual(self.client.get('/lists/classroom', headers=self.headers(3)).json, [])
        self.assertEqual(self.client.get(f'/lists/classroom/{self.list_id}', headers=self.headers(3)).status_code, 404)
        self.assertEqual(self.client.get('/lists/classroom').status_code, 401)

    def test_file_requires_scoped_ticket_and_does_not_expose_storage_path(self):
        detail = self.client.get(f'/lists/classroom/{self.list_id}', headers=self.headers(1))
        self.assertNotIn('storage_path', json.dumps(detail.json))
        route = f'/lists/classroom/{self.list_id}/files/file1234567890'
        self.assertEqual(self.client.get(route).status_code, 403)
        self.assertEqual(self.client.post(route + '/access', headers=self.headers(3)).status_code, 404)
        access = self.client.post(route + '/access', headers=self.headers(1))
        self.assertEqual(access.status_code, 200)
        response = self.client.get('/lists/classroom' + access.json['url'].split('/lists/classroom')[1])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b'%PDF-example')
        self.assertIn('private', response.headers['Cache-Control'])
        other = access.json['url'].replace('file1234567890?', 'different-file?')
        self.assertEqual(self.client.get(other).status_code, 404)

    def test_reimport_updates_existing_list_without_duplicates(self):
        with self.app.app_context():
            result = import_archive(self.manifest, 'user1@example.com', 'user2@example.com')
            self.assertEqual(result['inserted'], 0)
            self.assertEqual(result['updated'], 1)
            self.assertEqual(ClassroomList.query.count(), 1)
            self.assertEqual(ClassroomList.query.one().kind, 'lista')

    def test_registered_attachment_cannot_escape_its_storage_directory(self):
        with self.app.app_context():
            row = ClassroomList.query.one()
            attachments = [dict(f) for f in row.attachments]
            attachments[0]['storage_path'] = '../../outside.pdf'
            row.attachments = attachments; db.session.commit()
        route = f'/lists/classroom/{self.list_id}/files/file1234567890/access'
        access = self.client.post(route, headers=self.headers(1))
        self.assertEqual(self.client.get(access.json['url']).status_code, 404)


    def test_external_worksheet_links_are_preserved_without_drive_attachments(self):
        self.manifest['courses'][0]['posts']['materials'].append({
            'id': 'linked-list', 'title': 'Lista de exercícios online',
            'materials': [{'link': {'title': 'Exercícios', 'url': 'https://example.com/lista.pdf'}}],
        })
        with self.app.app_context():
            import_archive(self.manifest, 'user1@example.com', 'user2@example.com')
            row = ClassroomList.query.filter_by(post_id='linked-list').one()
            self.assertEqual(row.kind, 'lista')
            self.assertEqual(row.attachments[0]['source_url'], 'https://example.com/lista.pdf')
            self.assertFalse(row.attachments[0]['available'])
