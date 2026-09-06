"""
Proves the platform is no longer open to whoever knows the URL.

Before this, every endpoint served uploaded mining reports to any caller. The
cases below are the claim that it does not: each data endpoint is asked without
credentials and must refuse, and the published demo account is asked to change
things and must be refused too.

The endpoint list is derived from the app's own routes rather than typed out, so
a route added later without a guard fails these tests instead of shipping open.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class AuthenticationTests(unittest.TestCase):
    OVERRIDES = ("DATABASE_URL", "USE_MOCK_AI", "AUTH_USERS", "AUTH_SECRET",
                 "DEMO_ACCOUNT", "DEMO_PASSWORD", "DEMO_USERNAME")

    ALWAYS_PUBLIC = {"/", "/health", "/auth/login", "/auth/demo", "/openapi.json",
                     "/docs", "/docs/oauth2-redirect", "/redoc"}

    @classmethod
    def setUpClass(cls):
        cls._saved = {k: os.environ.get(k) for k in cls.OVERRIDES}
        cls._tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{cls._tmp.name}/auth.db"
        os.environ["USE_MOCK_AI"] = "true"
        os.environ["AUTH_SECRET"] = "test-secret-not-a-real-one"
        os.environ["AUTH_USERS"] = "auditor:right-password:CMPDI Auditor"
        os.environ["DEMO_ACCOUNT"] = "on"
        os.environ["DEMO_PASSWORD"] = "demo-password"

        sys.path.insert(0, str(PROJECT_ROOT))
        cls._poisoned = ("database", "auth", "auth_seed", "ai_providers", "ai_extractor", "backend.api")
        for name in cls._poisoned:
            sys.modules.pop(name, None)

        from fastapi.testclient import TestClient
        from backend.api import app
        from database import init_db
        from auth_seed import seed_users

        init_db()
        seed_users()
        cls.app = app
        cls.client = TestClient(app)
        cls.pdf = (PROJECT_ROOT / "sample_mining_report.pdf").read_bytes()

    @classmethod
    def tearDownClass(cls):
        for key, value in cls._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        for name in cls._poisoned:
            sys.modules.pop(name, None)
        cls._tmp.cleanup()

    # -- helpers ----------------------------------------------------------
    def token_for(self, username, password):
        res = self.client.post("/auth/login", json={"username": username, "password": password})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["access_token"]

    def auth(self, token):
        return {"Authorization": f"Bearer {token}"}

    def data_routes(self):
        """Every route the app serves that is not deliberately public."""
        for route in self.app.routes:
            path = getattr(route, "path", None)
            methods = getattr(route, "methods", set()) or set()
            if not path or path in self.ALWAYS_PUBLIC:
                continue
            for method in methods & {"GET", "POST", "DELETE", "PUT", "PATCH"}:
                yield method, path.replace("{report_id}", "1").replace("{finding_id}", "x")

    # -- the central claim ------------------------------------------------
    def test_every_data_route_refuses_an_anonymous_caller(self):
        checked = 0
        for method, path in self.data_routes():
            with self.subTest(route=f"{method} {path}"):
                res = self.client.request(method, path)
                self.assertEqual(
                    res.status_code, 401,
                    f"{method} {path} answered {res.status_code} without credentials",
                )
                checked += 1
        # Guards against the list silently becoming empty and the test passing.
        self.assertGreater(checked, 8, "expected the app to expose several protected routes")

    def test_a_garbage_token_is_refused(self):
        for bad in ["", "not-a-token", "a.b.c"]:
            res = self.client.get("/reports", headers=self.auth(bad))
            self.assertEqual(res.status_code, 401)

    def test_a_tampered_token_is_refused(self):
        token = self.token_for("auditor", "right-password")
        res = self.client.get("/reports", headers=self.auth(token[:-4] + "AAAA"))
        self.assertEqual(res.status_code, 401)

    # -- signing in -------------------------------------------------------
    def test_correct_credentials_return_a_working_token(self):
        token = self.token_for("auditor", "right-password")
        res = self.client.get("/reports", headers=self.auth(token))
        self.assertEqual(res.status_code, 200)

    def test_username_is_not_case_sensitive(self):
        self.token_for("AUDITOR", "right-password")

    def test_wrong_password_and_unknown_user_are_indistinguishable(self):
        wrong = self.client.post("/auth/login", json={"username": "auditor", "password": "nope"})
        missing = self.client.post("/auth/login", json={"username": "ghost", "password": "nope"})
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(missing.status_code, 401)
        # Differing messages would let someone enumerate which accounts exist.
        self.assertEqual(wrong.json()["detail"], missing.json()["detail"])

    def test_password_is_never_returned_or_stored_in_clear(self):
        res = self.client.post("/auth/login", json={"username": "auditor", "password": "right-password"})
        self.assertNotIn("right-password", res.text)

        from database import SessionLocal, User
        db = SessionLocal()
        try:
            row = db.query(User).filter(User.username == "auditor").first()
            self.assertNotIn("right-password", row.password_hash)
            self.assertTrue(row.password_hash.startswith("pbkdf2_sha256$"))
        finally:
            db.close()

    def test_me_reports_the_signed_in_account(self):
        token = self.token_for("auditor", "right-password")
        body = self.client.get("/auth/me", headers=self.auth(token)).json()
        self.assertEqual(body["username"], "auditor")
        self.assertFalse(body["readonly"])

    # -- the published demo account ---------------------------------------
    def test_demo_credentials_are_published_and_work(self):
        published = self.client.get("/auth/demo").json()
        self.assertTrue(published["enabled"])
        self.token_for(published["username"], published["password"])

    def test_demo_account_can_read(self):
        token = self.token_for("demo", "demo-password")
        for path in ["/reports", "/stats", "/validation"]:
            self.assertEqual(self.client.get(path, headers=self.auth(token)).status_code, 200, path)

    def test_demo_account_cannot_upload_or_delete(self):
        token = self.token_for("demo", "demo-password")
        upload = self.client.post(
            "/upload",
            files={"file": ("r.pdf", self.pdf, "application/pdf")},
            headers=self.auth(token),
        )
        self.assertEqual(upload.status_code, 403)
        self.assertEqual(self.client.delete("/reports/1", headers=self.auth(token)).status_code, 403)
        self.assertEqual(
            self.client.post("/validation/x/resolve", headers=self.auth(token)).status_code, 403
        )

    def test_a_full_account_can_upload(self):
        token = self.token_for("auditor", "right-password")
        res = self.client.post(
            "/upload",
            files={"file": ("r.pdf", self.pdf, "application/pdf")},
            headers=self.auth(token),
        )
        self.assertEqual(res.status_code, 200, res.text)

    # -- account lifecycle ------------------------------------------------
    def test_deleting_an_account_invalidates_its_existing_token(self):
        # The user is re-read per request, so revoking access must not wait for
        # the token to expire.
        from database import SessionLocal, User
        from auth import hash_password

        db = SessionLocal()
        try:
            db.add(User(username="temp", password_hash=hash_password("pw"), display_name="Temp"))
            db.commit()
        finally:
            db.close()

        token = self.token_for("temp", "pw")
        self.assertEqual(self.client.get("/reports", headers=self.auth(token)).status_code, 200)

        db = SessionLocal()
        try:
            db.query(User).filter(User.username == "temp").delete()
            db.commit()
        finally:
            db.close()

        self.assertEqual(self.client.get("/reports", headers=self.auth(token)).status_code, 401)

    def test_health_stays_public(self):
        # The status indicator and the platform's own healthcheck call it
        # unauthenticated; requiring a token would report the service as down.
        self.assertEqual(self.client.get("/health").status_code, 200)


if __name__ == "__main__":
    unittest.main()


class AccountRemovalTests(unittest.TestCase):
    """
    Removing an account.

    Seeding only ever adds, so a name dropped from AUTH_USERS keeps working -
    which is how a typo'd username survives being corrected. Without this there
    is no way to close an account short of direct database access.
    """

    OVERRIDES = ("DATABASE_URL", "USE_MOCK_AI", "AUTH_USERS", "AUTH_SECRET",
                 "AUTH_REMOVE_USERS", "DEMO_ACCOUNT")

    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in self.OVERRIDES}
        self._tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{self._tmp.name}/remove.db"
        os.environ["USE_MOCK_AI"] = "true"
        os.environ["AUTH_SECRET"] = "test-secret-not-a-real-one"
        os.environ["DEMO_ACCOUNT"] = "off"
        os.environ.pop("AUTH_REMOVE_USERS", None)
        sys.path.insert(0, str(PROJECT_ROOT))

    def tearDown(self):
        for key, value in self._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self._tmp.cleanup()

    def _run(self):
        """Re-import the modules so they read the environment as it stands."""
        for name in ("database", "auth", "auth_seed"):
            sys.modules.pop(name, None)
        import importlib
        database = importlib.import_module("database")
        database.init_db()
        return importlib.import_module("auth_seed").seed_users(), database

    def test_a_named_account_is_removed(self):
        os.environ["AUTH_USERS"] = "keeper:pw,typo:pw"
        result, _ = self._run()
        self.assertEqual(sorted(result["created"]), ["keeper", "typo"])

        # The typo is corrected in AUTH_USERS and named for removal.
        os.environ["AUTH_USERS"] = "keeper:pw"
        os.environ["AUTH_REMOVE_USERS"] = "typo"
        result, database = self._run()
        self.assertEqual(result["removed"], ["typo"])

        db = database.SessionLocal()
        try:
            self.assertIsNone(db.query(database.User).filter(database.User.username == "typo").first())
            self.assertIsNotNone(db.query(database.User).filter(database.User.username == "keeper").first())
        finally:
            db.close()

    def test_removing_an_absent_account_is_not_an_error(self):
        os.environ["AUTH_USERS"] = "keeper:pw"
        os.environ["AUTH_REMOVE_USERS"] = "never-existed"
        result, _ = self._run()
        self.assertEqual(result["removed"], [])
        self.assertEqual(result["total"], 1)

    def test_a_name_in_both_lists_keeps_the_account(self):
        # Contradictory configuration. Keeping is the recoverable reading:
        # deleting an account cannot be undone from here.
        os.environ["AUTH_USERS"] = "keeper:pw"
        os.environ["AUTH_REMOVE_USERS"] = "keeper"
        result, database = self._run()
        self.assertEqual(result["removed"], [])
        db = database.SessionLocal()
        try:
            self.assertIsNotNone(db.query(database.User).filter(database.User.username == "keeper").first())
        finally:
            db.close()
