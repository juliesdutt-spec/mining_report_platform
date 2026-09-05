"""
Diagnose why answers are stand-ins instead of model output.

Run from the project root:

    python doctor.py

Checks the AI configuration the way the backend does, then actually calls the
provider - the step /health cannot do, because it reports what is configured,
not what answers. Prints a verdict and the one thing to change.

Never prints a key, or any part of one.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

OK, BAD, INFO = "[ OK ]", "[FAIL]", "[ .. ]"


def main() -> int:
    print("\nDataForge AI doctor")
    print("=" * 64)

    # 1. Is there a .env at all, and which provider variables does it name?
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        # Names only - a value is never read out of this file for printing.
        names = sorted({
            line.split("=", 1)[0].strip()
            for line in env_path.read_text(errors="replace").splitlines()
            if "=" in line and not line.strip().startswith("#")
        })
        print(f"{OK} .env found  ({len(names)} settings: {', '.join(names) or 'none'})")
    else:
        print(f"{BAD} No .env file in {env_path.parent}")
        print("       Fix: copy .env.example to .env and add a provider key.")
        return 1

    # 2. What did the backend resolve from it?
    try:
        import ai_providers
    except Exception as exc:
        print(f"{BAD} Could not import ai_providers: {exc}")
        print("       Fix: run this from the project root, not from frontend/.")
        return 1

    described = ai_providers.describe()
    mode, model = described["mode"], described["model"]

    if mode == "mock":
        print(f"{BAD} No provider is active - answers will be stand-ins.")
        print(f"       Reason: {described['reason']}")
        print("       Fix: add a key to .env, then restart the backend.")
        return 1

    print(f"{OK} Provider resolved: {mode}  (model: {model})")

    # 3. The step /health cannot do: actually call it.
    print(f"{INFO} Calling {mode} for real...")
    try:
        reply = ai_providers.complete("Reply with the single word: ready", 20)
    except ai_providers.ProviderError as exc:
        print(f"{BAD} {mode} is configured but the call FAILED.")
        print(f"       {exc}")
        print()
        print("       This is why you see stand-in answers.")
        print("       " + _advice(str(exc)))
        return 1

    print(f"{OK} {mode} answered: {reply.strip()[:60]!r}")
    print()
    print("=" * 64)
    print("Your AI provider works. If Ask DataForge still shows a stand-in")
    print("answer, the browser is talking to a different backend than this")
    print("script - check the API base URL in Settings, and restart the")
    print("backend so it picks up the current .env.")
    return 0


def _advice(error: str) -> str:
    """Turn a provider error into the single next thing to do."""
    lowered = error.lower()
    if "api key not valid" in lowered or "api_key_invalid" in lowered:
        return ("Fix: the key is wrong. Re-copy it from "
                "https://aistudio.google.com/apikey - no quotes, no spaces.")
    if "no longer available" in lowered or "not found" in lowered:
        # Google's 404 names the model to move to; quoting it beats guessing.
        match = re.search(r"use models/([\w.-]+)", error)
        if match:
            return (f"Fix: that model is retired for your key. Set "
                    f"GEMINI_MODEL={match.group(1)} and restart.")
        return ("Fix: your key cannot use that model. Try another from "
                "https://ai.google.dev/gemini-api/docs/models")
    if "resource_exhausted" in lowered or "quota" in lowered or "429" in lowered:
        return "Fix: free-tier rate limit. Wait 60 seconds and run this again."
    if "permission" in lowered or "403" in lowered:
        return ("Fix: the key exists but is not enabled for this API. "
                "Create a fresh key in AI Studio.")
    if "could not reach" in lowered or "timed out" in lowered:
        return ("Fix: no network route to the provider. Check your internet, "
                "VPN or proxy, or raise AI_TIMEOUT_SECONDS in .env.")
    return "Fix: send this whole message to whoever is helping you debug."


if __name__ == "__main__":
    raise SystemExit(main())
