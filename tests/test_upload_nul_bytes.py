"""
A document carrying NUL (0x00) bytes must not fail its upload, and must never
fail it by looking like an outage.

Both halves of that sentence are a real defect that reached production, and
they compound: one bad document in a 13-document corpus reported the whole
backend as unreachable while /health was answering 200 throughout.

    File "/app/backend/api.py", line 439, in upload_report
        db.commit()
    ValueError: A string literal cannot contain NUL (0x00) characters.

The chain was: a subset-embedded font extracts unmapped glyphs as 0x00 ->
raw_text goes to Postgres unsanitised -> psycopg2 refuses it at flush ->
the `except Exception` handler commits again on the now-unusable session and
raises PendingRollbackError -> the HTTPException it was about to raise never
runs -> an *unhandled* exception skips CORSMiddleware, which sits inside
ServerErrorMiddleware -> the 500 arrives with no Access-Control-Allow-Origin
-> the browser blocks it -> fetch() rejects with a TypeError the frontend
cannot tell from a dead host -> "Cannot reach the DataForge backend".

So there are three things to pin, and the third is the one that turned a
document-level failure into an apparent service-level one.
"""
import unittest

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

import sqlalchemy as sa
from sqlalchemy.orm import Session, declarative_base

from document_processor import without_nul


class StripsNulFromExtractedText(unittest.TestCase):
    """The single choke point every consumer of document text shares."""

    def test_nul_is_removed(self):
        self.assertEqual(without_nul("21.9 million\x00 tonnes"), "21.9 million tonnes")

    def test_surrounding_text_is_untouched(self):
        # Including non-Latin scripts: the corpus carries Hindi and Telugu
        # reports, and a stripper that normalised or re-encoded would quietly
        # damage them.
        for text in ("Jayant Opencast, Singrauli", "सिंगरौली, मध्य प्रदेश", "కొత్తగూడెం"):
            self.assertEqual(without_nul(text), text)

    def test_other_control_characters_survive(self):
        # Only NUL is rejected by Postgres. Tabs and newlines carry the page
        # and column structure that evidence locating depends on, so widening
        # this to "strip control characters" would cost real information.
        self.assertEqual(without_nul("a\tb\nc"), "a\tb\nc")

    def test_empty_and_falsy_input(self):
        self.assertEqual(without_nul(""), "")
        self.assertIsNone(without_nul(None))

    def test_a_page_of_only_nul_becomes_empty_not_whitespace(self):
        # It must read as "this page yielded nothing", so the scan detection
        # upstream still sees an empty text layer rather than a page of
        # characters it cannot show.
        self.assertEqual(without_nul("\x00\x00\x00"), "")

    def test_whitespace_collapsing_downstream_would_not_have_caught_it(self):
        # vector_store._tidy collapses [ \t]+ only. NUL is not whitespace to
        # it or to Python, which is why nothing downstream removed one.
        import re
        self.assertIn("\x00", re.compile(r"[ \t]+").sub(" ", "a\x00b"))
        self.assertFalse("\x00".isspace())


class FailedCommitLeavesTheSessionUnusable(unittest.TestCase):
    """Why the old handler's second commit could not work."""

    def _poisoned_session(self):
        Base = declarative_base()

        class Report(Base):
            __tablename__ = "reports"
            id = sa.Column(sa.Integer, primary_key=True)
            raw_text = sa.Column(sa.String)
            status = sa.Column(sa.String)
            error_message = sa.Column(sa.String)

        engine = sa.create_engine("sqlite://")
        Base.metadata.create_all(engine)

        @sa.event.listens_for(engine, "before_cursor_execute")
        def refuse_nul(conn, cursor, statement, params, context, executemany):
            values = params if isinstance(params, (list, tuple)) else []
            if any("\x00" in str(v) for v in values):
                # psycopg2 raises exactly this, client-side, at flush.
                raise ValueError(
                    "A string literal cannot contain NUL (0x00) characters."
                )

        db = Session(engine)
        report = Report(raw_text="ok", status="processing")
        db.add(report)
        db.commit()
        report.raw_text = "annual report\x00text"
        with self.assertRaises(ValueError):
            db.commit()
        return db, report

    def test_committing_again_without_rollback_raises(self):
        db, report = self._poisoned_session()
        report.status = "error"
        with self.assertRaises(sa.exc.PendingRollbackError):
            db.commit()

    def test_rolling_back_first_lets_the_failure_be_recorded(self):
        db, report = self._poisoned_session()
        db.rollback()
        report.status = "error"
        report.error_message = "A string literal cannot contain NUL"
        db.commit()
        self.assertEqual(report.status, "error")


class UnhandledExceptionsLoseTheirCorsHeaders(unittest.TestCase):
    """
    The link that made a broken document look like a broken backend.

    CORSMiddleware runs inside ServerErrorMiddleware, so it never sees a 500
    produced by an exception escaping the endpoint. The response is valid
    HTTP; the browser is the thing that refuses it, which is why the server
    logs look healthy while the user is told nothing is reachable.
    """

    ORIGIN = "https://getdataforge.online"

    def _client(self):
        app = FastAPI()
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[self.ORIGIN],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.post("/unhandled")
        def unhandled():
            raise RuntimeError("stands in for PendingRollbackError")

        @app.post("/handled")
        def handled():
            raise HTTPException(
                status_code=500,
                detail="Could not process this document. It may be corrupt or unreadable.",
            )

        return TestClient(app, raise_server_exceptions=False)

    def test_a_raised_httpexception_keeps_them(self):
        res = self._client().post("/handled", headers={"Origin": self.ORIGIN})
        self.assertEqual(res.status_code, 500)
        self.assertEqual(
            res.headers.get("access-control-allow-origin"), self.ORIGIN,
            "the browser must be able to read this, or the frontend reports an outage",
        )
        self.assertIn("Could not process this document", res.json()["detail"])

    def test_an_escaping_exception_loses_them(self):
        res = self._client().post("/unhandled", headers={"Origin": self.ORIGIN})
        self.assertEqual(res.status_code, 500)
        self.assertIsNone(
            res.headers.get("access-control-allow-origin"),
            "if this ever passes, the CORS-on-500 hazard is gone and the "
            "handler's rollback is no longer load-bearing for the error message",
        )


if __name__ == "__main__":
    unittest.main()
