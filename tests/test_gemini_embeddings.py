"""
Gemini embeddings: batching, and which model to call.

Both of these were found by pressing "Build search index" against the live
deployment, which reported them per document in the provider's own words:

  HTTP 400 ... "* BatchEmbedContentsRequest.requests: at most 100 requests
  can be in one batch"

  HTTP 404 ... "models/text-embedding-004 is not found for API version
  v1beta, or is not supported for embedContent. Call ModelService.ListModels
  to see the list of available models and their supported methods."

The first is a document longer than the batch ceiling. The second is a model
name that was correct when it was written and has since been retired - which
is an argument against ever hardcoding one.
"""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_providers
from ai_providers import GeminiProvider, ProviderError


def _models(*names_with_embed):
    """A ListModels payload. Each entry is (name, supports_embedContent)."""
    return {
        "models": [
            {
                "name": f"models/{name}",
                "supportedGenerationMethods": (
                    ["embedContent"] if embeds else ["generateContent"]
                ),
            }
            for name, embeds in names_with_embed
        ]
    }


def _embeddings(count, dim=4):
    return {"embeddings": [{"values": [float(i)] * dim} for i in range(count)]}


class EmbedBatchingTests(unittest.TestCase):
    def setUp(self):
        GeminiProvider._resolved_embed_model = None
        self.provider = GeminiProvider()

    def tearDown(self):
        GeminiProvider._resolved_embed_model = None

    def test_a_document_past_the_ceiling_is_sent_in_slices(self):
        """The live failure: 250 chunks in one request is refused outright."""
        posts = []

        def fake_post(url, payload, headers=None):
            posts.append(payload["requests"])
            return _embeddings(len(payload["requests"]))

        with mock.patch.object(ai_providers, "_post_json", fake_post), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", "pinned-model"):
            vectors = self.provider.embed([f"chunk {i}" for i in range(250)])

        self.assertEqual(len(vectors), 250)
        self.assertEqual([len(p) for p in posts], [100, 100, 50])
        for batch in posts:
            self.assertLessEqual(len(batch), ai_providers.GEMINI_EMBED_BATCH)

    def test_slicing_keeps_the_chunks_in_order(self):
        """Out-of-order vectors pair each passage with a neighbour's meaning."""
        def fake_post(url, payload, headers=None):
            # Echo the chunk's own number back as its vector.
            return {
                "embeddings": [
                    {"values": [float(r["content"]["parts"][0]["text"].split()[-1])]}
                    for r in payload["requests"]
                ]
            }

        with mock.patch.object(ai_providers, "_post_json", fake_post), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", "pinned-model"):
            vectors = self.provider.embed([f"chunk {i}" for i in range(150)])

        self.assertEqual([v[0] for v in vectors], [float(i) for i in range(150)])

    def test_a_short_slice_is_still_refused(self):
        """Slicing must not weaken the guard against a misaligned write."""
        with mock.patch.object(ai_providers, "_post_json",
                               lambda url, payload, headers=None: _embeddings(3)), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", "pinned-model"):
            with self.assertRaises(ProviderError):
                self.provider.embed([f"chunk {i}" for i in range(120)])

    def test_no_texts_makes_no_request(self):
        def explode(*args, **kwargs):
            raise AssertionError("should not have called the API")

        with mock.patch.object(ai_providers, "_post_json", explode):
            self.assertEqual(self.provider.embed([]), [])


class EmbedModelResolutionTests(unittest.TestCase):
    def setUp(self):
        GeminiProvider._resolved_embed_model = None
        self.provider = GeminiProvider()

    def tearDown(self):
        GeminiProvider._resolved_embed_model = None

    def test_the_model_is_asked_for_rather_than_assumed(self):
        """The live 404: a name that is no longer served."""
        listed = _models(("gemini-3.6-flash", False), ("gemini-embedding-001", True))
        with mock.patch.object(ai_providers, "_get_json", lambda url, headers=None: listed), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", ""):
            self.assertEqual(self.provider.resolve_embed_model(), "gemini-embedding-001")

    def test_a_retired_candidate_is_skipped_not_attempted(self):
        # text-embedding-004 is first in nobody's list once it stops being served.
        listed = _models(("text-embedding-004", False), ("some-new-embedder", True))
        with mock.patch.object(ai_providers, "_get_json", lambda url, headers=None: listed), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", ""):
            self.assertEqual(self.provider.resolve_embed_model(), "some-new-embedder")

    def test_a_pinned_model_is_used_exactly_as_given(self):
        """An operator naming a model must not be silently overridden."""
        def explode(*args, **kwargs):
            raise AssertionError("a pinned model needs no lookup")

        with mock.patch.object(ai_providers, "_get_json", explode), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", "text-embedding-004"):
            self.assertEqual(self.provider.resolve_embed_model(), "text-embedding-004")

    def test_the_resolved_model_is_the_one_called(self):
        listed = _models(("gemini-embedding-001", True))
        urls = []

        def fake_post(url, payload, headers=None):
            urls.append(url)
            return _embeddings(len(payload["requests"]))

        with mock.patch.object(ai_providers, "_get_json", lambda url, headers=None: listed), \
             mock.patch.object(ai_providers, "_post_json", fake_post), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", ""):
            self.provider.embed(["one"])

        self.assertIn("gemini-embedding-001:batchEmbedContents", urls[0])
        self.assertNotIn("text-embedding-004", urls[0])

    def test_the_lookup_happens_once_not_per_document(self):
        listed = _models(("gemini-embedding-001", True))
        calls = []

        def counting_get(url, headers=None):
            calls.append(url)
            return listed

        with mock.patch.object(ai_providers, "_get_json", counting_get), \
             mock.patch.object(ai_providers, "_post_json",
                               lambda url, payload, headers=None: _embeddings(len(payload["requests"]))), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", ""):
            self.provider.embed(["a"])
            self.provider.embed(["b"])
            GeminiProvider().embed(["c"])

        self.assertEqual(len(calls), 1, "ListModels should be asked once, not per call")

    def test_a_key_that_can_embed_nothing_says_so(self):
        listed = _models(("gemini-3.6-flash", False))
        with mock.patch.object(ai_providers, "_get_json", lambda url, headers=None: listed), \
             mock.patch.object(ai_providers, "GEMINI_EMBED_MODEL", ""):
            with self.assertRaises(ProviderError) as caught:
                self.provider.resolve_embed_model()
        self.assertIn("embedContent", str(caught.exception))


class HealthMustNotCallTheApiTests(unittest.TestCase):
    def test_describing_embeddings_never_reaches_the_network(self):
        """
        /health is polled by the platform. A lookup per poll is how a health
        check turns into an outage, which is the same mistake the vector
        availability probe already had to be rescued from.
        """
        def explode(*args, **kwargs):
            raise AssertionError("embeddings_describe must not make a request")

        with mock.patch.object(ai_providers, "_get_json", explode), \
             mock.patch.object(ai_providers, "_post_json", explode):
            described = ai_providers.embeddings_describe()

        self.assertIn("available", described)


if __name__ == "__main__":
    unittest.main()
