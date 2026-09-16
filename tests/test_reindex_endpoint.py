"""
Tests for POST /admin/reindex.

The endpoint exists because the index cannot be built from anywhere else: the
vector database is reachable only over the deployment's private network, so
the backfill has to run inside the deployment.

What is worth pinning is who may run it and what it does when it cannot.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import ai_providers
import vector_store
from backend.api import app
from database import SessionLocal, User, init_db
import auth as auth_mod
import auth_seed


class ReindexEndpointTests(unittest.TestCase):
    client = TestClient(app)

    def setUp(self):
        self._available = vector_store.available
        self._describe = ai_providers.embeddings_describe

        # Both accounts are created per test, not once for the class, and the
        # schema is ensured here too.
        #
        # Two things made this necessary. These tests used to just query a
        # `users` table and pass, because a developer machine has a
        # mining_reports.db lying around from running the app - so the suite
        # was green locally and failed the moment CI ran it on a clean
        # checkout. And another test module rebinds the database module onto a
        # temporary file, so anything seeded once in setUpClass can belong to a
        # database that is no longer the live one by the time a test runs.
        # init_db only creates what is missing, so this is cheap.
        init_db()
        self._ensure_user("reindex-writer", "reindex-pass", readonly=False)
        # The demo account is normally created by seeding at application
        # startup, which does not happen in a bare test process. Without it the
        # one test that checks a published credential cannot spend the
        # embedding quota simply skipped itself - green, and protecting
        # nothing, which is exactly where it could least afford to be trusted.
        self._ensure_user(auth_seed.DEMO_USERNAME, auth_seed.DEMO_PASSWORD, readonly=True)

    @staticmethod
    def _ensure_user(username: str, password: str, *, readonly: bool) -> None:
        db = SessionLocal()
        try:
            if not db.query(User).filter(User.username == username).first():
                db.add(User(
                    username=username,
                    password_hash=auth_mod.hash_password(password),
                    display_name=username,
                    is_readonly=readonly,
                ))
                db.commit()
        finally:
            db.close()

    def tearDown(self):
        vector_store.available = self._available
        ai_providers.embeddings_describe = self._describe

    def writer_headers(self):
        res = self.client.post(
            "/auth/login",
            json={"username": "reindex-writer", "password": "reindex-pass"},
        )
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_an_unauthenticated_caller_is_refused(self):
        self.assertEqual(self.client.post("/admin/reindex").status_code, 401)

    def test_the_published_demo_account_cannot_spend_the_embedding_quota(self):
        # The demo password is printed on the sign-in page, and every chunk
        # here costs an embedding call against the project's quota.
        res = self.client.post(
            "/auth/login",
            json={"username": auth_seed.DEMO_USERNAME, "password": auth_seed.DEMO_PASSWORD},
        )
        self.assertEqual(
            res.status_code, 200,
            "the demo account has to exist for this test to assert anything; "
            "setUpClass seeds it rather than letting the test skip.",
        )
        token = res.json()["access_token"]
        out = self.client.post("/admin/reindex", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(out.status_code, 403)

    def test_an_unreachable_index_is_503_with_the_reason(self):
        # Not a 500: the operator needs to know it was the vector database,
        # and which part of it.
        vector_store.available = lambda: (False, "VECTOR_DATABASE_URL is not set.")
        out = self.client.post("/admin/reindex", headers=self.writer_headers())
        self.assertEqual(out.status_code, 503)
        self.assertIn("VECTOR_DATABASE_URL", out.json()["detail"])

    def test_a_provider_without_embeddings_is_503_with_its_own_reason(self):
        # Distinct from the above: the database is fine and the provider is
        # the problem, and those need different fixes.
        vector_store.available = lambda: (True, None)
        ai_providers.embeddings_describe = lambda: {
            "available": False, "provider": "claude", "model": None,
            "reason": "claude has no embeddings API.",
        }
        out = self.client.post("/admin/reindex", headers=self.writer_headers())
        self.assertEqual(out.status_code, 503)
        self.assertIn("no embeddings API", out.json()["detail"])


if __name__ == "__main__":
    unittest.main()
