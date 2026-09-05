"""
Load .env before any module reads its configuration.

`python-dotenv` is a declared dependency and `.env.example` tells operators to
put CLAUDE_API_KEY in `.env`, but nothing used to read that file: the backend
saw only variables already exported in the shell, so a key placed in `.env`
was silently ignored and the AI stayed in mock mode.

Importing this module loads `.env` from the project root. It is safe to import
more than once (load_dotenv is idempotent) and it never overrides a variable
that is already set in the environment, so an explicitly exported value still
wins. A missing `.env` or a missing python-dotenv is not an error — the
platform is designed to run without a key.
"""
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"


def load_env() -> bool:
    """Load .env if it exists. Returns True when a file was read."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return False
    if not ENV_PATH.exists():
        return False
    return load_dotenv(ENV_PATH, override=False)


load_env()
