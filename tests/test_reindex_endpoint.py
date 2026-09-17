"""
Tests for POST /admin/reindex.

The endpoint exists because the index cannot be built from anywhere else: the
vector database is reachable only over the deployment's private network, so
the backfill has to run inside the deployment.

What is worth pinning is who may run it and what it does when it cannot.
"""
import os
import sys
import re
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import ai_providers
import vector_store
from backend.api import app
from database import SessionLocal, User, init_db
import auth as auth_mod
import auth_seed


PROJECT_ROOT = Path(__file__).resolve().parent.parent


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


class IndexingIsBatchedBecauseTheEdgeClosesLongRequests(unittest.TestCase):
    """
    One synchronous rebuild cannot index a corpus of any size.

    Railway's edge closes a request at five minutes. Production proved it:
    POST /admin/reindex ran 300,011ms and came back 499 "client has closed the
    request", with the browser still sitting on a spinner and the index still
    empty. Nothing in the response could say so, because there was no response.

    So the endpoint indexes a bounded batch and says what is left, and the
    caller loops. These pin the two things that makes safe.
    """

    def test_the_endpoint_accepts_a_batch_size_and_reports_what_is_left(self):
        import inspect

        from backend.api import reindex_corpus

        signature = inspect.signature(reindex_corpus)
        self.assertIn("limit", signature.parameters)
        source = inspect.getsource(reindex_corpus)
        self.assertIn('"remaining"', source, "a caller cannot loop without this")
        # Bounded by the batch, and resuming rather than restarting.
        self.assertIn("pending[:limit]", source)
        self.assertIn("indexed_report_ids()", source)

    def test_a_reset_treats_every_report_as_pending(self):
        """It has just emptied the index, so "already indexed" is a lie."""
        import inspect

        from backend.api import reindex_corpus

        self.assertIn(
            "set() if reset else vector_store.indexed_report_ids()",
            inspect.getsource(reindex_corpus),
        )

    def test_the_client_stops_when_a_batch_indexes_nothing(self):
        """
        A report that cannot be embedded stays pending for ever.

        Looping on `remaining > 0` alone would spend the embedding quota on it
        until the tab is closed, so the loop also stops when a call makes no
        progress at all.
        """
        api = (PROJECT_ROOT / "frontend" / "src" / "services" / "api.ts").read_text()
        self.assertIn("batch.remaining <= 0 || batch.reports_indexed === 0", api)

    def test_one_call_is_given_far_less_than_the_edge_allows(self):
        api = (PROJECT_ROOT / "frontend" / "src" / "services" / "api.ts").read_text()
        match = re.search(r"REINDEX_TIMEOUT_MS = (\d+)", api)
        self.assertIsNotNone(match, "the batch call needs its own timeout")
        self.assertLess(
            int(match.group(1)), 300000,
            "a per-batch timeout at or above the edge's five minutes is the bug again",
        )


class IndexedReportIdsMakesResumingPossible(unittest.TestCase):
    def test_it_is_empty_rather_than_raising_when_the_index_is_unreachable(self):
        """Called on the way into a rebuild; it must not be the thing that fails."""
        original = vector_store.available
        vector_store.available = lambda: (False, "VECTOR_DATABASE_URL is not set.")
        try:
            self.assertEqual(vector_store.indexed_report_ids(), set())
        finally:
            vector_store.available = original


if __name__ == "__main__":
    unittest.main()
