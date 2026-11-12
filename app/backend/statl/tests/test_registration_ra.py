import unittest
from unittest.mock import patch
from statl import create_app, db
from statl.models.user import User


class RegistrationRATest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(testing=True)
        self.client = self.app.test_client()
        self.mail = patch("statl.services.auth_service.send_otp_email")
        self.mail.start()

    def tearDown(self):
        self.mail.stop()
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def register(self, email, ra, level="graduacao"):
        return self.client.post("/auth/register", json={
            "name": "Student", "email": email, "password": "test123",
            "confirm_password": "test123", "is_uem": True,
            "ra": ra, "nivel_curso": level,
        })

    def test_prefixes_and_leading_zeroes(self):
        for level, expected in [("graduacao", "ra001234"), ("mestrado", "pg001234")]:
            email = level + "@example.com"
            self.assertEqual(self.register(email, "001234", level).status_code, 201)
            with self.app.app_context():
                self.assertEqual(User.query.filter_by(email=email).one().ra, expected)

    def test_invalid_input_is_rejected_without_creating_accounts(self):
        for index, (ra, level) in enumerate([
            ("RA123", "graduacao"), ("12-3", "graduacao"),
            ("", "graduacao"), (123, "graduacao"),
            ("1" * 29, "graduacao"), ("123", "doutorado"),
            ("１２３", "graduacao"),
        ]):
            self.assertEqual(self.register(f"bad{index}@example.com", ra, level).status_code, 400)
        with self.app.app_context():
            self.assertEqual(User.query.count(), 0)

    def test_duplicate_ra_in_same_level_is_rejected(self):
        self.assertEqual(self.register("first@example.com", "98765").status_code, 201)
        self.assertEqual(self.register("second@example.com", "98765").status_code, 400)

    def test_legacy_uppercase_ra_still_prevents_duplicate(self):
        with self.app.app_context():
            db.session.add(User(email="legacy@example.com", name="Legacy", password_hash="unused", ra="RA98765"))
            db.session.commit()
        self.assertEqual(self.register("duplicate@example.com", "98765").status_code, 400)
