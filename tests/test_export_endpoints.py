"""
Guards the file-serving endpoints.

Content-Disposition is the whole bug surface here: a browser honours
`attachment` inside an <object> or <iframe> too, so the Documents preview -
which embeds the PDF URL - saved a file on every mount instead of rendering
one. Serving the same document under both dispositions is what fixes that,
and these tests fail if either half regresses.

They run against a temporary SQLite database so nothing touches a real one.
"""
import os
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class ExportEndpointTests(unittest.TestCase):
    #: Set for this class only. These are process-wide, and the provider tests
    #: reload ai_providers against their own environment - leaving USE_MOCK_AI
    #: behind would force every later provider case into mock mode.
    OVERRIDES = ("DATABASE_URL", "USE_MOCK_AI")

    @classmethod
    def setUpClass(cls):
        cls._saved = {k: os.environ.get(k) for k in cls.OVERRIDES}

        # Point the app at a throwaway database before importing it - the
        # engine is built at import time from DATABASE_URL.
        cls._tmp = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{cls._tmp.name}/test.db"
        os.environ["USE_MOCK_AI"] = "true"

        import sys
        sys.path.insert(0, str(PROJECT_ROOT))
        cls._poisoned = ("database", "ai_providers", "ai_extractor", "backend.api")
        for name in cls._poisoned:
            sys.modules.pop(name, None)

        from fastapi.testclient import TestClient
        from backend.api import app
        from database import init_db

        init_db()
        cls.client = TestClient(app)

        # One real upload, so every export has genuine extracted data behind it.
        pdf = PROJECT_ROOT / "sample_mining_report.pdf"
        with pdf.open("rb") as handle:
            response = cls.client.post(
                "/upload",
                files={"file": ("sample_mining_report.pdf", handle, "application/pdf")},
            )
        assert response.status_code == 200, response.text
        cls.report_id = cls.client.get("/reports").json()["reports"][0]["id"]

    @classmethod
    def tearDownClass(cls):
        # Restore the environment and drop the modules imported under it, so a
        # later test importing them resolves against its own configuration.
        import sys
        for key, value in cls._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        for name in cls._poisoned:
            sys.modules.pop(name, None)
        cls._tmp.cleanup()

    # ------------------------------------------------- PDF disposition ---
    def test_pdf_download_defaults_to_attachment(self):
        response = self.client.get(f"/reports/{self.report_id}/download")
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response.headers["content-disposition"])

    def test_pdf_preview_is_served_inline(self):
        """The Documents preview embeds this URL; attachment would download."""
        response = self.client.get(
            f"/reports/{self.report_id}/download", params={"inline": "true"}
        )
        self.assertEqual(response.status_code, 200)
        disposition = response.headers["content-disposition"]
        self.assertIn("inline", disposition)
        self.assertNotIn("attachment", disposition)

    def test_both_dispositions_return_the_same_valid_pdf(self):
        attachment = self.client.get(f"/reports/{self.report_id}/download").content
        inline = self.client.get(
            f"/reports/{self.report_id}/download", params={"inline": "true"}
        ).content
        self.assertTrue(attachment.startswith(b"%PDF"), "not a PDF")
        self.assertTrue(inline.startswith(b"%PDF"), "not a PDF")
        self.assertEqual(attachment, inline, "disposition must not change the bytes")

    def test_missing_report_is_404_not_an_empty_file(self):
        self.assertEqual(self.client.get("/reports/99999/download").status_code, 404)


if __name__ == "__main__":
    unittest.main()
