"""
Exercises each provider over a real HTTP socket.

Selection is covered in test_ai_providers; this covers the part that only
fails in production: whether the request body, auth header and response
parsing match what each API actually speaks. A stand-in server answers in the
documented response shape of Gemini, OpenRouter and Ollama, records what it
received, and the assertions run against that record.

It also pins the security promise: the API key must travel in a header, never
in the request path or query string, where proxies and access logs would
capture it.
"""
import json
import os
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

#: Filled in by the handler so assertions can inspect the last request.
RECEIVED: dict = {}

#: Set per-test to the body the stand-in should answer with.
RESPONSE: dict = {}


class StandInHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        RECEIVED.clear()
        RECEIVED.update({
            "path": self.path,
            "headers": dict(self.headers),
            "body": json.loads(body) if body else {},
        })
        payload = json.dumps(RESPONSE).encode("utf-8")
        self.send_response(RESPONSE.pop("_status", 200) if RESPONSE else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass  # keep the test output readable


class ProviderTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), StandInHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        RECEIVED.clear()
        RESPONSE.clear()

    def _provider(self, env: dict):
        """Import ai_providers fresh under `env` and hand back the module."""
        import importlib
        for key, value in env.items():
            os.environ[key] = value
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in env])
        import ai_providers
        return importlib.reload(ai_providers)

    # ------------------------------------------------------------ gemini ---
    def test_gemini_request_and_response(self):
        RESPONSE.update(
            {"candidates": [{"content": {"parts": [{"text": "  coal, mostly  "}]}}]}
        )
        mod = self._provider({
            "GEMINI_API_KEY": "secret-gemini",
            "GEMINI_MODEL": "gemini-2.5-flash",
            "GEMINI_BASE_URL": f"{self.base}/v1beta",
            "AI_PROVIDER": "gemini",
        })

        self.assertEqual(mod.complete("what mineral?", max_tokens=64), "coal, mostly")
        self.assertIn("gemini-2.5-flash:generateContent", RECEIVED["path"])
        self.assertEqual(
            RECEIVED["body"]["contents"][0]["parts"][0]["text"], "what mineral?"
        )
        self.assertEqual(RECEIVED["body"]["generationConfig"]["maxOutputTokens"], 64)

    def test_gemini_key_travels_in_a_header_not_the_url(self):
        RESPONSE.update({"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
        mod = self._provider({
            "GEMINI_API_KEY": "secret-gemini",
            "GEMINI_BASE_URL": f"{self.base}/v1beta",
            "AI_PROVIDER": "gemini",
        })
        mod.complete("hello")

        self.assertNotIn("secret-gemini", RECEIVED["path"])
        headers = {k.lower(): v for k, v in RECEIVED["headers"].items()}
        self.assertEqual(headers.get("x-goog-api-key"), "secret-gemini")

    def test_gemini_refusal_is_reported_not_swallowed(self):
        RESPONSE.update({"promptFeedback": {"blockReason": "SAFETY"}})
        mod = self._provider({
            "GEMINI_API_KEY": "k",
            "GEMINI_BASE_URL": f"{self.base}/v1beta",
            "AI_PROVIDER": "gemini",
        })
        with self.assertRaises(mod.ProviderError) as caught:
            mod.complete("hello")
        self.assertIn("SAFETY", str(caught.exception))

    # -------------------------------------------------------- openrouter ---
    def test_openrouter_request_and_response(self):
        RESPONSE.update({"choices": [{"message": {"content": "42 MT"}}]})
        mod = self._provider({
            "OPENROUTER_API_KEY": "secret-router",
            "OPENROUTER_MODEL": "vendor/model:free",
            "OPENROUTER_BASE_URL": f"{self.base}/api/v1",
            "AI_PROVIDER": "openrouter",
        })

        self.assertEqual(mod.complete("how much?", max_tokens=99), "42 MT")
        self.assertEqual(RECEIVED["path"], "/api/v1/chat/completions")
        self.assertEqual(RECEIVED["body"]["model"], "vendor/model:free")
        self.assertEqual(RECEIVED["body"]["max_tokens"], 99)
        headers = {k.lower(): v for k, v in RECEIVED["headers"].items()}
        self.assertEqual(headers.get("authorization"), "Bearer secret-router")

    def test_openrouter_reports_an_error_body_returned_with_http_200(self):
        """Upstream failures arrive as a 200 with an error body, not a 4xx."""
        RESPONSE.update({"error": {"message": "model is temporarily offline"}})
        mod = self._provider({
            "OPENROUTER_API_KEY": "k",
            "OPENROUTER_MODEL": "vendor/model:free",
            "OPENROUTER_BASE_URL": f"{self.base}/api/v1",
            "AI_PROVIDER": "openrouter",
        })
        with self.assertRaises(mod.ProviderError) as caught:
            mod.complete("hello")
        self.assertIn("temporarily offline", str(caught.exception))

    # ------------------------------------------------------------ ollama ---
    def test_ollama_request_and_response(self):
        RESPONSE.update({"message": {"role": "assistant", "content": "opencast"}})
        mod = self._provider({
            "OLLAMA_HOST": self.base,
            "OLLAMA_MODEL": "llama3.2",
            "AI_PROVIDER": "ollama",
        })

        self.assertEqual(mod.complete("method?", max_tokens=32), "opencast")
        self.assertEqual(RECEIVED["path"], "/api/chat")
        self.assertEqual(RECEIVED["body"]["model"], "llama3.2")
        self.assertIs(RECEIVED["body"]["stream"], False)
        self.assertEqual(RECEIVED["body"]["options"]["num_predict"], 32)

    def test_ollama_sends_no_authorization_header(self):
        RESPONSE.update({"message": {"content": "ok"}})
        mod = self._provider({
            "OLLAMA_HOST": self.base, "OLLAMA_MODEL": "llama3.2",
            "AI_PROVIDER": "ollama",
        })
        mod.complete("hello")
        headers = {k.lower() for k in RECEIVED["headers"]}
        self.assertNotIn("authorization", headers)

    def test_ollama_missing_model_names_the_pull_command(self):
        RESPONSE.update({"message": {"content": ""}})
        mod = self._provider({
            "OLLAMA_HOST": self.base, "OLLAMA_MODEL": "mistral",
            "AI_PROVIDER": "ollama",
        })
        with self.assertRaises(mod.ProviderError) as caught:
            mod.complete("hello")
        self.assertIn("ollama pull mistral", str(caught.exception))

    # -------------------------------------------------------------- claude ---
    def test_claude_rest_path_used_when_sdk_is_absent(self):
        """Claude must still work if the anthropic SDK is not installed."""
        RESPONSE.update({"content": [{"type": "text", "text": "underground"}]})
        mod = self._provider({
            "CLAUDE_API_KEY": "secret-claude", "AI_PROVIDER": "claude",
        })
        provider = mod.ClaudeProvider()
        # Call the REST path directly: it is the fallback the SDK hides.
        mod.HTTP_TIMEOUT = 10
        original = mod._post_json
        captured = {}

        def spy(url, payload, headers=None):
            captured["url"] = url
            captured["headers"] = headers
            return RESPONSE

        mod._post_json = spy
        try:
            self.assertEqual(provider._complete_over_rest("q", 10), "underground")
        finally:
            mod._post_json = original

        self.assertEqual(captured["url"], "https://api.anthropic.com/v1/messages")
        self.assertEqual(captured["headers"]["x-api-key"], "secret-claude")
        self.assertIn("anthropic-version", captured["headers"])

    # ------------------------------------------------------------ errors ---
    def test_http_error_body_is_scrubbed_of_the_key(self):
        RESPONSE.update({"_status": 401, "error": "bad key secret-gemini"})
        mod = self._provider({
            "GEMINI_API_KEY": "secret-gemini",
            "GEMINI_BASE_URL": f"{self.base}/v1beta",
            "AI_PROVIDER": "gemini",
        })
        with self.assertRaises(mod.ProviderError) as caught:
            mod.complete("hello")
        message = str(caught.exception)
        self.assertNotIn("secret-gemini", message, "An error must never echo the key")
        self.assertIn("401", message, "It should still say what went wrong")

    def test_unreachable_host_names_only_the_origin(self):
        mod = self._provider({
            "OLLAMA_HOST": "http://127.0.0.1:1", "OLLAMA_MODEL": "llama3.2",
            "AI_PROVIDER": "ollama", "AI_TIMEOUT_SECONDS": "5",
        })
        with self.assertRaises(mod.ProviderError) as caught:
            mod.complete("hello")
        self.assertIn("127.0.0.1:1", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
