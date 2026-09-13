"""
Tests for retrieval.

Retrieval is an optimisation on top of a working feature. The thing worth
pinning is that it never becomes the reason a question goes unanswered: every
way it can fail has to come back as a reason the caller falls back from, not
an exception the caller has to know about.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_providers
import retrieval
import vector_store
from ai_providers import ProviderError


class FakeReport:
    def __init__(self, id=1, filename="r.pdf", pages=None, raw_text=None, org=None):
        self.id = id
        self.filename = filename
        self.page_texts = pages
        self.raw_text = raw_text
        self.company_name = org


class _Patched(unittest.TestCase):
    """Swaps the two collaborators out and puts them back."""

    def setUp(self):
        self._available = vector_store.available
        self._describe = ai_providers.embeddings_describe
        self._embed = ai_providers.embed
        self._index = vector_store.index_report
        self._search = vector_store.search

    def tearDown(self):
        vector_store.available = self._available
        ai_providers.embeddings_describe = self._describe
        ai_providers.embed = self._embed
        vector_store.index_report = self._index
        vector_store.search = self._search

    def given_store(self, ok, reason=None):
        vector_store.available = lambda: (ok, reason)

    def given_embeddings(self, available, reason=None, model="m"):
        ai_providers.embeddings_describe = lambda: {
            "available": available, "provider": "p", "model": model, "reason": reason
        }


class RetrieveDegradesTests(_Patched):
    def test_no_vector_database_is_a_reason_not_an_error(self):
        self.given_store(False, "VECTOR_DATABASE_URL is not set.")
        result = retrieval.retrieve("how much coal?")
        self.assertEqual(result["passages"], [])
        self.assertIn("VECTOR_DATABASE_URL", result["reason"])

    def test_a_provider_without_embeddings_is_a_reason_not_an_error(self):
        # Anthropic publishes no embeddings endpoint, and that is a different
        # thing from being misconfigured.
        self.given_store(True)
        self.given_embeddings(False, "claude has no embeddings API.")
        result = retrieval.retrieve("how much coal?")
        self.assertEqual(result["passages"], [])
        self.assertIn("no embeddings API", result["reason"])

    def test_an_embedding_failure_does_not_escape(self):
        self.given_store(True)
        self.given_embeddings(True)
        def boom(texts):
            raise ProviderError("HTTP 429 from generativelanguage.googleapis.com")
        ai_providers.embed = boom
        result = retrieval.retrieve("how much coal?")
        self.assertEqual(result["passages"], [])
        self.assertIn("429", result["reason"])

    def test_an_unexpected_failure_does_not_escape_either(self):
        # A question must still get an answer when the index is broken in a
        # way nobody anticipated.
        self.given_store(True)
        self.given_embeddings(True)
        ai_providers.embed = lambda texts: [[0.0]]
        def boom(*a, **k):
            raise RuntimeError("connection reset by peer")
        vector_store.search = boom
        result = retrieval.retrieve("how much coal?")
        self.assertEqual(result["passages"], [])
        self.assertIn("connection reset", result["reason"])

    def test_an_empty_index_is_not_a_failure(self):
        # No reason means retrieval worked; the corpus simply has nothing
        # indexed yet. The caller must be able to tell those apart.
        self.given_store(True)
        self.given_embeddings(True)
        ai_providers.embed = lambda texts: [[0.0]]
        vector_store.search = lambda *a, **k: []
        result = retrieval.retrieve("how much coal?")
        self.assertEqual(result["passages"], [])
        self.assertIsNone(result["reason"])


class IndexReportTests(_Patched):
    def test_indexing_failure_is_reported_not_raised(self):
        # Ingestion must not lose a document because a secondary index was
        # unreachable.
        self.given_store(True)
        self.given_embeddings(True)
        def boom(texts):
            raise ProviderError("quota exhausted")
        ai_providers.embed = boom
        written, error = retrieval.index_report(FakeReport(pages=["some text"]))
        self.assertEqual(written, 0)
        self.assertIn("quota", error)

    def test_a_document_with_no_text_says_so(self):
        self.given_store(True)
        self.given_embeddings(True)
        written, error = retrieval.index_report(FakeReport(pages=None, raw_text=None))
        self.assertEqual(written, 0)
        self.assertIn("no extractable text", error)

    def test_a_scanned_document_is_indexed_from_its_pages(self):
        self.given_store(True)
        self.given_embeddings(True, model="m")
        seen = {}
        ai_providers.embed = lambda texts: [[float(len(t))] for t in texts]
        def capture(report_id, chunks, embeddings, **kwargs):
            seen.update(report_id=report_id, chunks=chunks, kwargs=kwargs)
            return len(chunks)
        vector_store.index_report = capture
        written, error = retrieval.index_report(
            FakeReport(id=9, pages=["page one", "page two"], org="CIL")
        )
        self.assertIsNone(error)
        self.assertEqual(written, 2)
        self.assertEqual(seen["report_id"], 9)
        self.assertEqual([c["page"] for c in seen["chunks"]], [1, 2])
        self.assertEqual(seen["kwargs"]["organisation"], "CIL")


class ContextTests(unittest.TestCase):
    def test_every_passage_carries_its_citation(self):
        # The model can only attribute a figure to a page if the page is in
        # front of it, which is the claim the rest of this platform makes.
        context = retrieval.as_context([
            {"filename": "jharia.pdf", "page": 4, "content": "1,25,000 MT", "report_id": 1},
        ])
        self.assertIn("jharia.pdf, page 4", context)
        self.assertIn("1,25,000 MT", context)

    def test_a_passage_with_no_page_is_not_given_a_fake_one(self):
        context = retrieval.as_context([
            {"filename": "old.pdf", "page": 0, "content": "text", "report_id": 2},
        ])
        self.assertIn("old.pdf", context)
        self.assertNotIn("page 0", context)


if __name__ == "__main__":
    unittest.main()
