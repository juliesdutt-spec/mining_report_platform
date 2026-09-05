"""
Guards the .env bootstrap.

python-dotenv is a declared dependency and .env.example instructs operators to
put CLAUDE_API_KEY in .env, but for a long time nothing read that file, so a
configured key was silently ignored and the AI stayed in mock mode. These tests
fail if that regresses.
"""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def run_with_env(env_body: str, snippet: str) -> str:
    """Run `snippet` in a fresh interpreter against a temporary .env."""
    env_path = PROJECT_ROOT / ".env"
    backup = env_path.read_text() if env_path.exists() else None
    try:
        env_path.write_text(env_body)
        env = {k: v for k, v in os.environ.items() if k not in {
            "CLAUDE_API_KEY", "CLAUDE_MODEL", "USE_MOCK_AI",
        }}
        result = subprocess.run(
            [sys.executable, "-c", snippet],
            cwd=PROJECT_ROOT, env=env, capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        return result.stdout.strip()
    finally:
        if backup is None:
            env_path.unlink(missing_ok=True)
        else:
            env_path.write_text(backup)


class TestEnvBootstrap(unittest.TestCase):
    def test_key_in_dotenv_disables_mock_mode(self):
        out = run_with_env(
            "CLAUDE_API_KEY=placeholder\nUSE_MOCK_AI=false\n",
            "import ai_extractor as a; print(a.USE_MOCK)",
        )
        self.assertEqual(out, "False", "A key in .env must switch off mock mode")

    def test_model_is_read_from_dotenv(self):
        out = run_with_env(
            "CLAUDE_API_KEY=placeholder\nCLAUDE_MODEL=claude-sonnet-5\n",
            "import ai_extractor as a; print(a.CLAUDE_MODEL)",
        )
        self.assertEqual(out, "claude-sonnet-5")

    def test_use_mock_ai_forces_mock_even_with_a_key(self):
        out = run_with_env(
            "CLAUDE_API_KEY=placeholder\nUSE_MOCK_AI=true\n",
            "import ai_extractor as a; print(a.USE_MOCK)",
        )
        self.assertEqual(out, "True")

    def test_no_key_falls_back_to_mock(self):
        out = run_with_env(
            "USE_MOCK_AI=false\n",
            "import ai_extractor as a; print(a.USE_MOCK)",
        )
        self.assertEqual(out, "True", "Without a key the platform must still run")

    def test_exported_environment_wins_over_dotenv(self):
        """An explicitly exported value must not be clobbered by the file."""
        env_path = PROJECT_ROOT / ".env"
        backup = env_path.read_text() if env_path.exists() else None
        try:
            env_path.write_text("CLAUDE_MODEL=from-dotenv\n")
            env = dict(os.environ, CLAUDE_MODEL="from-shell")
            result = subprocess.run(
                [sys.executable, "-c", "import ai_extractor as a; print(a.CLAUDE_MODEL)"],
                cwd=PROJECT_ROOT, env=env, capture_output=True, text=True, timeout=60,
            )
            self.assertEqual(result.stdout.strip(), "from-shell", result.stderr)
        finally:
            if backup is None:
                env_path.unlink(missing_ok=True)
            else:
                env_path.write_text(backup)

    def test_missing_dotenv_is_not_an_error(self):
        with tempfile.TemporaryDirectory():
            env_path = PROJECT_ROOT / ".env"
            backup = env_path.read_text() if env_path.exists() else None
            try:
                env_path.unlink(missing_ok=True)
                result = subprocess.run(
                    [sys.executable, "-c", "import utils.env; print('ok')"],
                    cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=60,
                )
                self.assertEqual(result.stdout.strip(), "ok", result.stderr)
            finally:
                if backup is not None:
                    env_path.write_text(backup)


if __name__ == "__main__":
    unittest.main()
