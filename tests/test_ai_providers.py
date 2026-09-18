"""
Guards provider selection.

The platform must run with no AI credentials at all, must pick up a free
provider (Gemini, OpenRouter, Ollama) as readily as a paid one, and must never
echo a key back through /health or an error message. These tests fail if any
of that regresses.

Selection happens at import time, so each case runs a fresh interpreter
against a temporary .env - importing once per process would freeze the first
case's configuration for every case after it.
"""
import os
import subprocess
import sys
import re
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

#: Cleared from the inherited environment so a developer's real shell config
#: cannot make a case pass or fail for the wrong reason.
PROVIDER_VARS = {
    "AI_PROVIDER", "AI_TIMEOUT_SECONDS", "USE_MOCK_AI",
    "CLAUDE_API_KEY", "CLAUDE_MODEL",
    "GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL",
    "OPENROUTER_API_KEY", "OPENROUTER_MODEL",
    "OLLAMA_HOST", "OLLAMA_MODEL",
}


def run_with_env(env_body: str, snippet: str) -> str:
    """Run `snippet` in a fresh interpreter against a temporary .env."""
    env_path = PROJECT_ROOT / ".env"
    backup = env_path.read_text() if env_path.exists() else None
    try:
        env_path.write_text(env_body)
        env = {k: v for k, v in os.environ.items() if k not in PROVIDER_VARS}
        result = subprocess.run(
            [sys.executable, "-c", snippet],
            cwd=PROJECT_ROOT, env=env, capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        # Fallback paths log a diagnostic line before printing; the value under
        # test is the last line of stdout.
        return result.stdout.strip().splitlines()[-1].strip()
    finally:
        if backup is None:
            env_path.unlink(missing_ok=True)
        else:
            env_path.write_text(backup)


MODE = "import ai_providers as p; print(p.describe()['mode'])"
MODEL = "import ai_providers as p; print(p.describe()['model'])"
REASON = "import ai_providers as p; print(p.describe()['reason'])"


class TestProviderSelection(unittest.TestCase):
    def test_no_credentials_falls_back_to_mock(self):
        self.assertEqual(
            run_with_env("AI_PROVIDER=auto\n", MODE), "mock",
            "The platform must run with no AI credentials at all",
        )

    def test_gemini_key_alone_selects_gemini(self):
        self.assertEqual(run_with_env("GEMINI_API_KEY=placeholder\n", MODE), "gemini")

    def test_google_api_key_is_accepted_for_gemini(self):
        """Google's own tooling exports GOOGLE_API_KEY; honour it too."""
        self.assertEqual(run_with_env("GOOGLE_API_KEY=placeholder\n", MODE), "gemini")

    def test_gemini_model_defaults_to_one_a_new_key_can_use(self):
        """
        Google retires models for new keys first. gemini-2.5-flash 404s with
        "no longer available to new users" on a freshly created key while
        still serving older ones, so the default has to be current.
        """
        self.assertEqual(
            run_with_env("GEMINI_API_KEY=placeholder\n", MODEL), "gemini-3.6-flash",
        )

    def test_gemini_model_is_overridable(self):
        self.assertEqual(
            run_with_env("GEMINI_API_KEY=placeholder\nGEMINI_MODEL=gemini-3.8-flash\n", MODEL),
            "gemini-3.8-flash",
        )

    def test_openrouter_needs_both_key_and_model(self):
        out = run_with_env("OPENROUTER_API_KEY=placeholder\n", MODE)
        self.assertEqual(out, "mock", "A key with no model id cannot be called")

    def test_openrouter_missing_model_says_where_to_find_one(self):
        reason = run_with_env("OPENROUTER_API_KEY=placeholder\n", REASON)
        self.assertIn("OPENROUTER_MODEL", reason)
        self.assertIn("openrouter.ai/models", reason)

    def test_openrouter_with_key_and_model_is_selected(self):
        out = run_with_env(
            "OPENROUTER_API_KEY=placeholder\nOPENROUTER_MODEL=vendor/model:free\n", MODE,
        )
        self.assertEqual(out, "openrouter")

    def test_ollama_needs_no_key_when_asked_for_explicitly(self):
        self.assertEqual(run_with_env("AI_PROVIDER=ollama\n", MODE), "ollama")

    def test_ollama_is_not_auto_selected_by_default(self):
        """Ollama always looks 'configured', so auto must not pick it blindly."""
        self.assertEqual(run_with_env("AI_PROVIDER=auto\n", MODE), "mock")

    def test_ollama_joins_auto_once_pointed_at(self):
        self.assertEqual(
            run_with_env("AI_PROVIDER=auto\nOLLAMA_MODEL=llama3.2\n", MODE), "ollama",
        )

    def test_auto_prefers_claude_when_several_are_configured(self):
        out = run_with_env(
            "CLAUDE_API_KEY=placeholder\nGEMINI_API_KEY=placeholder\n", MODE,
        )
        self.assertEqual(out, "claude", "An existing paid setup must keep working")

    def test_explicit_provider_overrides_auto_order(self):
        out = run_with_env(
            "AI_PROVIDER=gemini\nCLAUDE_API_KEY=placeholder\nGEMINI_API_KEY=placeholder\n",
            MODE,
        )
        self.assertEqual(out, "gemini")

    def test_explicit_provider_without_its_key_does_not_fall_through(self):
        """Asking for gemini and getting claude would spend money unasked."""
        out = run_with_env("AI_PROVIDER=gemini\nCLAUDE_API_KEY=placeholder\n", MODE)
        self.assertEqual(out, "mock")

    def test_use_mock_ai_overrides_every_key(self):
        out = run_with_env("USE_MOCK_AI=true\nGEMINI_API_KEY=placeholder\n", MODE)
        self.assertEqual(out, "mock")

    def test_unknown_provider_name_is_reported(self):
        reason = run_with_env("AI_PROVIDER=gpt4\n", REASON)
        self.assertIn("gpt4", reason)
        self.assertIn("gemini", reason, "The message should list the valid names")


class TestNoKeyLeaks(unittest.TestCase):
    def test_describe_never_contains_the_key(self):
        out = run_with_env(
            "GEMINI_API_KEY=super-secret-value\n",
            "import ai_providers as p; print(p.describe())",
        )
        self.assertNotIn("super-secret-value", out)
        self.assertIn("gemini", out, "It should still report the provider")

    def test_errors_are_scrubbed_of_configured_keys(self):
        out = run_with_env(
            "GEMINI_API_KEY=super-secret-value\n",
            "import ai_providers as p; print(p._redact('failed with key super-secret-value'))",
        )
        self.assertNotIn("super-secret-value", out)
        self.assertIn("***", out)


class TestDegradedAnswersAreDisclosed(unittest.TestCase):
    """
    A configured provider whose call fails must not pass for a working one.

    /health reports the provider as configured, so without a note on the answer
    itself a rejected key looks exactly like a healthy demo - which is how a
    broken setup gets mistaken for a working one.
    """

    UNREACHABLE = (
        "AI_PROVIDER=ollama\nOLLAMA_HOST=http://127.0.0.1:1\n"
        "AI_TIMEOUT_SECONDS=5\n"
    )

    def test_working_mock_mode_carries_no_note(self):
        out = run_with_env(
            "USE_MOCK_AI=true\n",
            "import ai_extractor as a;"
            "r=a.query_reports_detailed('q','ctx');"
            "print(r['source'], r['note'])",
        )
        self.assertEqual(out, "mock None", "Plain mock mode is not a failure")

    def test_failed_provider_call_is_labelled_mock(self):
        out = run_with_env(
            self.UNREACHABLE,
            "import ai_extractor as a;"
            "print(a.query_reports_detailed('q','ctx')['source'])",
        )
        self.assertEqual(out, "mock")

    def test_failed_provider_call_names_the_provider_and_reason(self):
        out = run_with_env(
            self.UNREACHABLE,
            "import ai_extractor as a;"
            "print(a.query_reports_detailed('q','ctx')['note'])",
        )
        self.assertIn("ollama", out, "The note must name which provider failed")
        self.assertIn("127.0.0.1:1", out, "and why it failed")

    def test_note_never_carries_the_key(self):
        out = run_with_env(
            "AI_PROVIDER=gemini\nGEMINI_API_KEY=super-secret-value\n"
            "GEMINI_BASE_URL=http://127.0.0.1:1/v1beta\nAI_TIMEOUT_SECONDS=5\n",
            "import ai_extractor as a;"
            "print(a.query_reports_detailed('q','ctx')['note'])",
        )
        self.assertNotIn("super-secret-value", out)
        self.assertIn("gemini", out)

    def test_plain_query_reports_still_returns_a_string(self):
        """The old signature stays usable for callers that only want text."""
        out = run_with_env(
            "USE_MOCK_AI=true\n",
            "import ai_extractor as a;"
            "print(type(a.query_reports('q','ctx')).__name__)",
        )
        self.assertEqual(out, "str")


class TestExtractorFallsBackCleanly(unittest.TestCase):
    def test_mock_mode_answers_without_touching_the_network(self):
        out = run_with_env(
            "USE_MOCK_AI=true\n",
            "import ai_extractor as a; print(bool(a.query_reports('how much coal?', '')))",
        )
        self.assertEqual(out, "True")

    def test_provider_failure_falls_back_to_mock_answer(self):
        """An unreachable provider must degrade to a mock answer, not a 500."""
        out = run_with_env(
            "AI_PROVIDER=ollama\nOLLAMA_HOST=http://127.0.0.1:1\nAI_TIMEOUT_SECONDS=5\n",
            "import ai_extractor as a; print('Answer' in a.query_reports('q', 'ctx'))",
        )
        self.assertEqual(out, "True")

    def test_extraction_falls_back_to_mock_on_provider_failure(self):
        out = run_with_env(
            "AI_PROVIDER=ollama\nOLLAMA_HOST=http://127.0.0.1:1\nAI_TIMEOUT_SECONDS=5\n",
            "import ai_extractor as a; print(a.extract_structured_data('coal in Jharkhand')['mineral_type'])",
        )
        self.assertEqual(out, "Coal")


class AnEmptyGeminiResponseSaysWhyItWasEmpty(unittest.TestCase):
    """
    "Gemini returned an empty response." reads like an outage.

    It is almost never one. A reasoning model spends tokens thinking before
    it writes, billed against the same maxOutputTokens budget, so a small
    budget is consumed entirely by reasoning and no text is produced. The
    old message sent a real debugging session chasing a rate limit that did
    not exist - waiting, retrying, and concluding the API was down while a
    2000-token call would have worked first time.
    """

    def setUp(self):
        # Imported here rather than at module scope: provider selection
        # happens at import time, which is why every other case in this file
        # runs in a subprocess. _empty_response_reason is pure, so it is safe
        # to call directly - but the import must not leak to the top.
        import ai_providers
        self.reason = ai_providers._empty_response_reason

    def test_a_budget_exhausted_by_reasoning_is_not_reported_as_an_outage(self):
        reason = self.reason(
            {"finishReason": "MAX_TOKENS"},
            {"usageMetadata": {"thoughtsTokenCount": 20, "candidatesTokenCount": 0}},
            20,
        )
        self.assertIn("20-token output limit", reason)
        self.assertIn("reasoning", reason)
        # The sentence that stops someone waiting it out.
        self.assertIn("not a rate limit", reason)

    def test_a_content_refusal_says_the_provider_itself_is_fine(self):
        reason = self.reason({"finishReason": "SAFETY"}, {}, 2000)
        self.assertIn("declined", reason)
        self.assertIn("working", reason)

    def test_an_unknown_reason_still_rules_out_quota_and_network(self):
        reason = self.reason({"finishReason": "OTHER"}, {}, 2000)
        self.assertIn("OTHER", reason)
        self.assertIn("not a quota or network problem", reason)

    def test_the_doctor_probes_with_a_budget_the_app_actually_uses(self):
        # A probe smaller than every real call can fail on a provider that
        # serves the app perfectly, which is the worst kind of false alarm.
        source = (Path(__file__).resolve().parent.parent / "doctor.py").read_text(encoding="utf-8")
        match = re.search(r'complete\("Reply with the single word: ready",\s*(\d+)\)', source)
        self.assertIsNotNone(match, "the doctor should still make a real call")
        self.assertGreaterEqual(int(match.group(1)), 500,
                                "the app's smallest real call is 500 tokens")


if __name__ == "__main__":
    unittest.main()
