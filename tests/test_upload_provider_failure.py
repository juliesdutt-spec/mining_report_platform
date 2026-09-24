# -*- coding: utf-8 -*-
"""
An upload whose model call fails must not store invented values.

It used to. extract_structured_data falls back to mock fields when the
provider errors, the upload stored them, and the browser was told
"extracted and indexed" under a green tick. The report table has no column
for where an extraction came from, so from then on the stand-in was
indistinguishable from a real reading - in the document view, in analytics,
and in the conflict detector, which would happily reconcile a real figure
against an invented one.

It happened on production: Gemini answered 503 "This model is currently
experiencing high demand", the upload returned 200, and a Hindi report from
Jayant was stored as "Coal, Opencast, 1,25,000 MT, District: Not specified"
with a mine name built from its filename.

The rule now:

  a configured provider that fails  -> 503, a reason, nothing stored
  no provider configured at all      -> mock, stored, as before - that is
                                        local development, where everyone
                                        knows the answers are stand-ins

The second half matters as much as the first: test_ask and others upload in
mock mode and must keep working.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PDF = PROJECT_ROOT / "samples" / "corpus" / "HI-01_Jayant_NCL_FY2024-25.pdf"

GEMINI_503 = (
    "gemini was configured but the call failed: HTTP 503 from "
    "https://generativelanguage.googleapis.com: { \"error\": { \"code\": 503, "
    "\"message\": \"This model is currently experiencing high demand.\", "
    "\"status\": \"UNAVAILABLE\" } }"
)
GEMINI_429 = (
    "gemini was configured but the call failed: HTTP 429 from "
    "https://generativelanguage.googleapis.com: RESOURCE_EXHAUSTED quota exceeded"
)
TIMED_OUT = "openrouter was configured but the call failed: The read operation timed out"
OTHER = "openrouter was configured but the call failed: something unforeseen"


class UploadRefusesToStoreStandIns(unittest.TestCase):
    OVERRIDES = ("DATABASE_URL", "USE_MOCK_AI", "AUTH_USERS", "AUTH_SECRET",
                 "DEMO_ACCOUNT", "ALLOWED_ORIGINS")
    ORIGIN = "https://getdataforge.online"

    @classmethod
    def setUpClass(cls):
        cls._saved = {k: os.environ.get(k) for k in cls.OVERRIDES}
        cls._tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{cls._tmp.name}/test.db"
        os.environ["USE_MOCK_AI"] = "true"
        os.environ["AUTH_SECRET"] = "test-secret-not-a-real-one"
        os.environ["AUTH_USERS"] = "tester:test-password:Test User"
        os.environ["DEMO_ACCOUNT"] = "off"
        os.environ["ALLOWED_ORIGINS"] = cls.ORIGIN

        sys.path.insert(0, str(PROJECT_ROOT))
        cls._poisoned = ("database", "auth", "auth_seed", "ai_providers",
                         "ai_extractor", "rate_limit", "backend.api")
        for name in cls._poisoned:
            sys.modules.pop(name, None)

        from fastapi.testclient import TestClient
        import backend.api as api
        from database import init_db
        from auth_seed import seed_users

        init_db()
        seed_users()
        cls.api = api
        cls.client = TestClient(api.app, raise_server_exceptions=False)
        login = cls.client.post(
            "/auth/login", json={"username": "tester", "password": "test-password"}
        )
        assert login.status_code == 200, login.text
        cls.client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        cls.client.headers["Origin"] = cls.ORIGIN

    @classmethod
    def tearDownClass(cls):
        for key, value in cls._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        cls._tmp.cleanup()
        for name in cls._poisoned:
            sys.modules.pop(name, None)

    # ------------------------------------------------------------ helpers
    def _upload(self, name="HI-01_Jayant_NCL_FY2024-25.pdf"):
        with PDF.open("rb") as handle:
            return self.client.post(
                "/upload", files={"file": (name, handle, "application/pdf")}
            )

    def _stored_filenames(self):
        body = self.client.get("/reports?limit=100").json()
        rows = body.get("reports", body if isinstance(body, list) else [])
        return [row.get("filename") for row in rows]

    def _failing(self, note):
        """Make the model call fail the way a configured provider does."""
        from ai_extractor import _mock_extraction
        return mock.patch.object(
            self.api, "extract_structured_data_detailed",
            side_effect=lambda text, filename="", page_texts=None: {
                "data": _mock_extraction(text, filename),
                "source": "mock",
                "note": note,
            },
        )

    # -------------------------------------------------------------- tests
    def test_an_overloaded_provider_is_a_503_not_a_success(self):
        with self._failing(GEMINI_503):
            response = self._upload("overloaded.pdf")
        self.assertEqual(response.status_code, 503, response.text)
        detail = response.json()["detail"]
        self.assertIn("overloaded", detail)
        self.assertIn("503", detail)
        self.assertIn("Nothing was stored", detail)
        self.assertIn("Try again in a few minutes", detail)

    def test_nothing_is_stored_when_the_provider_fails(self):
        # Including no row stuck on "processing": it is committed before the
        # model is called, so it has to be removed, not just left.
        with self._failing(GEMINI_503):
            self._upload("must-not-appear.pdf")
        self.assertNotIn("must-not-appear.pdf", self._stored_filenames())

    def test_the_browser_can_read_the_refusal(self):
        # An unhandled error would arrive without CORS headers and read, in the
        # browser, as "Cannot reach the DataForge backend".
        with self._failing(GEMINI_503):
            response = self._upload("cors.pdf")
        # The status first: a 200 carries CORS headers too, so without it this
        # would pass on code that never refuses anything.
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers.get("access-control-allow-origin"), self.ORIGIN)

    def test_quota_exhaustion_says_so(self):
        with self._failing(GEMINI_429):
            response = self._upload("quota.pdf")
        self.assertEqual(response.status_code, 503)
        detail = response.json()["detail"]
        self.assertIn("quota", detail)
        self.assertIn("429", detail)

    def test_a_timeout_says_so(self):
        with self._failing(TIMED_OUT):
            response = self._upload("slow.pdf")
        self.assertEqual(response.status_code, 503)
        self.assertIn("did not answer in time", response.json()["detail"])

    def test_an_unclassified_failure_still_refuses(self):
        with self._failing(OTHER):
            response = self._upload("other.pdf")
        self.assertEqual(response.status_code, 503)
        self.assertIn("could not extract this document", response.json()["detail"])

    def test_the_provider_error_body_is_not_returned(self):
        # The note carries the provider's raw error, which belongs in the log.
        with self._failing(GEMINI_503):
            detail = self._upload("leak.pdf").json()["detail"]
        self.assertNotIn("generativelanguage.googleapis.com", detail)
        self.assertNotIn("{", detail)

    def test_deliberate_mock_mode_still_uploads(self):
        # No provider configured: USE_MOCK_AI, note None. This is how local
        # development and the rest of the test suite run.
        response = self._upload("mock-mode.pdf")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("mock-mode.pdf", self._stored_filenames())

    def test_a_real_extraction_is_stored(self):
        real = {
            "data": {"mineral_type": "Coal", "mine_name": "Jayant",
                     "company_name": "Northern Coalfields Limited"},
            "source": "gemini",
            "note": None,
        }
        with mock.patch.object(self.api, "extract_structured_data_detailed", return_value=real):
            response = self._upload("real.pdf")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["extracted_data"]["mine_name"], "Jayant")
        self.assertIn("real.pdf", self._stored_filenames())


if __name__ == "__main__":
    unittest.main()
