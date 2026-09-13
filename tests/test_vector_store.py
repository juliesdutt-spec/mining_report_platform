"""
Tests for vector_store.

The chunking tests are pure and always run. The store tests need a real
Postgres with pgvector, so they skip where there is not one — the SQL they
cover is the part that cannot be checked by reading it, particularly the
psycopg2 cast, which fails at runtime rather than at import.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import vector_store


class ChunkPagesTests(unittest.TestCase):
    def test_each_chunk_knows_its_page(self):
        chunks = vector_store.chunk_pages(["first page text", "second page text"])
        self.assertEqual([c["page"] for c in chunks], [1, 2])

    def test_a_document_with_no_pages_falls_back_to_raw_text(self):
        # Reports ingested before page_texts existed have none. Page 0 means
        # "somewhere in this document" — inventing a page number would put a
        # fabricated citation in front of an auditor.
        chunks = vector_store.chunk_pages(None, "text with no page structure")
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["page"], 0)

    def test_nothing_to_index_yields_nothing(self):
        self.assertEqual(vector_store.chunk_pages(None, None), [])
        self.assertEqual(vector_store.chunk_pages([], ""), [])
        self.assertEqual(vector_store.chunk_pages(["   ", "\n"]), [])

    def test_a_long_page_is_split_with_overlap(self):
        page = " ".join(f"word{i}" for i in range(2000))
        chunks = vector_store.chunk_pages([page])
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(c["page"] == 1 for c in chunks))
        # The overlap is what stops a sentence straddling a boundary from
        # being retrievable by neither half.
        first_tail = chunks[0]["content"][-40:]
        self.assertTrue(
            any(word in chunks[1]["content"] for word in first_tail.split()),
            "consecutive chunks share no text, so a straddling sentence is lost",
        )

    def test_chunks_do_not_split_mid_word(self):
        page = " ".join(f"word{i}" for i in range(2000))
        for chunk in vector_store.chunk_pages([page]):
            self.assertFalse(chunk["content"].startswith("ord"))
            self.assertRegex(chunk["content"], r"^\S")

    def test_indic_text_survives_chunking(self):
        # Devanagari and Telugu combining marks are separate code points; a
        # chunker that sliced blindly could separate a vowel sign from its
        # consonant.
        hindi = "कोयला उत्पादन " * 200
        chunks = vector_store.chunk_pages([hindi])
        self.assertTrue(chunks)
        self.assertIn("कोयला", "".join(c["content"] for c in chunks))


class AvailabilityCacheTests(unittest.TestCase):
    """
    /health calls available(), and Railway polls /health.

    Without a cache each poll opened a connection to the vector database —
    and while that database was unreachable, each poll blocked for the
    connect timeout, so an outage of the *search index* could fail the
    platform's healthcheck and restart the whole API. The index going down
    must never take the API with it.
    """

    def setUp(self):
        self._url = vector_store.VECTOR_DATABASE_URL
        vector_store.forget_availability()

    def tearDown(self):
        vector_store.VECTOR_DATABASE_URL = self._url
        vector_store.forget_availability()

    def test_an_unreachable_database_is_probed_once_per_ttl(self):
        vector_store.VECTOR_DATABASE_URL = "postgresql://nobody:nobody@127.0.0.1:5999/nope"
        calls = []
        real_connect = vector_store._connect

        import contextlib

        @contextlib.contextmanager
        def counting():
            calls.append(1)
            with real_connect() as conn:
                yield conn

        vector_store._connect = counting
        try:
            for _ in range(5):
                ok, reason = vector_store.available()
                self.assertFalse(ok)
                self.assertIn("Could not reach", reason)
            self.assertEqual(len(calls), 1, "the probe was repeated inside its TTL")
        finally:
            vector_store._connect = real_connect

    def test_forgetting_forces_a_fresh_probe(self):
        # A write that succeeds proves the database is up; a verdict cached
        # while it was being provisioned must not outlive that proof.
        vector_store.VECTOR_DATABASE_URL = "postgresql://nobody:nobody@127.0.0.1:5999/nope"
        first, _ = vector_store.available()
        self.assertFalse(first)
        vector_store.forget_availability()
        self.assertIsNone(vector_store._availability_cache)

    def test_an_unset_url_never_touches_the_cache(self):
        vector_store.VECTOR_DATABASE_URL = ""
        ok, reason = vector_store.available()
        self.assertFalse(ok)
        self.assertIn("not set", reason)
        self.assertIsNone(vector_store._availability_cache)


def _store_ready() -> bool:
    if not vector_store.configured():
        return False
    ok, _ = vector_store.available()
    return ok


@unittest.skipUnless(
    _store_ready(),
    "needs VECTOR_DATABASE_URL pointing at a Postgres with pgvector",
)
class VectorStoreTests(unittest.TestCase):
    """Against a real database, because this is SQL that fails at runtime."""

    DIM = 8
    MODEL = "test-embed"

    def setUp(self):
        vector_store.reset()

    def tearDown(self):
        vector_store.reset()

    @staticmethod
    def vec(*values):
        padded = list(values) + [0.0] * (VectorStoreTests.DIM - len(values))
        return padded[: VectorStoreTests.DIM]

    def test_a_report_can_be_indexed_and_found(self):
        vector_store.index_report(
            1,
            [{"page": 3, "content": "opencast production reached 1,25,000 MT"}],
            [self.vec(1.0)],
            model=self.MODEL,
            filename="a.pdf",
        )
        hits = vector_store.search(self.vec(1.0), limit=5)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["page"], 3)
        self.assertAlmostEqual(hits[0]["similarity"], 1.0, places=3)

    def test_reindexing_replaces_rather_than_appends(self):
        # A re-extracted document that left its old passages behind would have
        # them quoted back as current.
        chunks = [{"page": 1, "content": f"passage {i}"} for i in range(3)]
        vector_store.index_report(1, chunks, [self.vec(1.0), self.vec(0, 1.0), self.vec(0, 0, 1.0)],
                                  model=self.MODEL)
        vector_store.index_report(1, chunks[:1], [self.vec(1.0)], model=self.MODEL)
        self.assertEqual(vector_store.stats()["chunks"], 1)

    def test_deleting_a_report_removes_its_passages(self):
        vector_store.index_report(7, [{"page": 1, "content": "gone"}], [self.vec(1.0)],
                                  model=self.MODEL)
        self.assertEqual(vector_store.forget_report(7), 1)
        self.assertEqual(vector_store.search(self.vec(1.0)), [])

    def test_the_organisation_filter_is_applied_in_sql(self):
        # Filtering after the fact would let one organisation's documents
        # consume the top-k and hand back nothing from a corpus with plenty.
        vector_store.index_report(1, [{"page": 1, "content": "cil passage"}], [self.vec(1.0)],
                                  model=self.MODEL, organisation="CIL")
        vector_store.index_report(2, [{"page": 1, "content": "sccl passage"}], [self.vec(0.99, 0.01)],
                                  model=self.MODEL, organisation="SCCL")
        hits = vector_store.search(self.vec(1.0), limit=1, organisation="SCCL")
        self.assertEqual([h["report_id"] for h in hits], [2])

    def test_the_same_passage_in_many_reports_is_returned_once(self):
        # This platform exists partly to find documents ingested twice, so the
        # same paragraph legitimately sits under several report ids. Spending
        # the model's context window on four copies of it helps nobody.
        for report_id in range(1, 5):
            vector_store.index_report(
                report_id, [{"page": 1, "content": "identical paragraph"}],
                [self.vec(1.0)], model=self.MODEL,
            )
        hits = vector_store.search(self.vec(1.0), limit=5)
        self.assertEqual(len(hits), 1)
        # Which copy is kept is the tiebreaker's business; that every copy is
        # accounted for is the guarantee.
        self.assertEqual(
            sorted([hits[0]["report_id"], *hits[0]["also_in"]]), [1, 2, 3, 4]
        )

    def test_the_same_question_cites_the_same_passage_twice_running(self):
        for report_id in range(1, 5):
            vector_store.index_report(
                report_id, [{"page": 1, "content": "identical paragraph"}],
                [self.vec(1.0)], model=self.MODEL,
            )
        first = vector_store.search(self.vec(1.0), limit=5)
        second = vector_store.search(self.vec(1.0), limit=5)
        self.assertEqual(first[0]["report_id"], second[0]["report_id"])

    def test_a_database_that_can_create_the_extension_is_available(self):
        """
        A freshly provisioned pgvector database has the extension available
        but not yet created — ensure_schema creates it on the first write.

        Checking only pg_extension made that state indistinguishable from
        Railway's standard image, so an operator who had provisioned exactly
        the right database was told to go and use the pgvector template.
        """
        with vector_store._connect() as conn, conn.cursor() as cur:
            cur.execute("DROP EXTENSION IF EXISTS vector CASCADE")
        vector_store._SCHEMA_READY = False

        with vector_store._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM pg_extension WHERE extname = 'vector'")
            self.assertEqual(cur.fetchone()[0], 0, "the extension should be gone for this test")

        ok, reason = vector_store.available()
        self.assertTrue(ok, f"refused a usable database: {reason}")

        # And the first write creates it rather than failing.
        vector_store.index_report(
            1, [{"page": 1, "content": "x"}], [self.vec(1.0)], model=self.MODEL
        )
        self.assertEqual(vector_store.stats()["chunks"], 1)

    def test_two_embedding_models_are_never_mixed(self):
        # Vectors from different models are not comparable, and a search
        # across both returns nonsense that looks exactly like a working one.
        vector_store.index_report(1, [{"page": 1, "content": "x"}], [self.vec(1.0)],
                                  model=self.MODEL)
        vector_store._SCHEMA_READY = False
        with self.assertRaises(vector_store.VectorStoreError):
            vector_store.ensure_schema(self.DIM, "a-different-model")

    def test_mismatched_chunk_and_embedding_counts_are_refused(self):
        # Writing these misaligned would pair each passage with its
        # neighbour's vector, which no later test would catch.
        with self.assertRaises(vector_store.VectorStoreError):
            vector_store.index_report(
                1, [{"page": 1, "content": "a"}, {"page": 1, "content": "b"}],
                [self.vec(1.0)], model=self.MODEL,
            )


if __name__ == "__main__":
    unittest.main()
