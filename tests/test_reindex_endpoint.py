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
from database import SessionLocal, User
import auth as auth_mod


class ReindexEndpointTests(unittest.TestCase):
    client = TestClient(app)

    def setUp(self):
        self._available = vector_store.available
        self._describe = ai_providers.embeddings_describe
        db = SessionLocal()
        try:
            if not db.query(User).filter(User.username == "reindex-writer").first():
                db.add(User(
                    username="reindex-writer",
                    password_hash=auth_mod.hash_password("reindex-pass"),
                    display_name="Reindex Writer",
                    is_readonly=False,
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
            "/auth/login", json={"username": "demo", "password": "dataforge-demo"}
        )
        if res.status_code != 200:
            self.skipTest("no demo account configured in this environment")
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
