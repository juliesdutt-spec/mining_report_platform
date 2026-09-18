"""
Diagnose why the platform is not doing what it should.

Run from the project root:

    python doctor.py

Two halves, because there are two ways to get a meaningless result out of
this project and they fail differently.

The AI half checks configuration the way the backend does and then actually
calls the provider - the step /health cannot do, because it reports what is
configured, not what answers.

The OCR half checks whether scanned documents can be read, and in which
scripts. That is not one yes or no: pytesseract installs without the binary
it wraps, the binary installs without the language data, and tesseract with
only English reads a Devanagari page as Latin nonsense rather than failing.
Each of those looks like success from one step away.

Never prints a key, or any part of one.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

OK, BAD, INFO = "[ OK ]", "[FAIL]", "[ .. ]"


def main() -> int:
    """
    Both halves, always.

    They are independent problems: a missing API key says nothing about
    whether tesseract can read Devanagari, and someone with both wrong should
    learn that in one run rather than fixing one and discovering the other.
    This used to return on the first AI failure, which meant the OCR section
    was unreachable for exactly the person who needed it most.
    """
    ai = _check_ai()
    ocr = _check_ocr()
    return ai or ocr


def _check_ai() -> int:
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
    print("Your AI provider works. If Ask DataForge still shows a stand-in")
    print("answer, the browser is talking to a different backend than this")
    print("script - check the API base URL in Settings, and restart the")
    print("backend so it picks up the current .env.")
    return 0


def _check_ocr() -> int:
    """
    Whether scanned documents can be read here, and in which scripts.

    Returns non-zero for a setup that would produce a misleading measurement,
    not merely a limited one. A host that cannot read scans at all scores
    them all-missing; a host that reads Devanagari as Latin scores them
    confidently wrong, which is worse and looks better.
    """
    from document_processor import (
        OCR_LANGUAGES, installed_ocr_languages, ocr_status, tessdata_dir,
    )

    print()
    print("=" * 64)
    print("OCR (scanned documents)")
    print("=" * 64)

    status = ocr_status()
    if not status["ok"]:
        print(f"{BAD} Scanned PDFs cannot be read.")
        print(f"       {status['reason']}")
        return 1

    print(f"{OK} tesseract {status['version']} ({status['path']})")

    folder = tessdata_dir()
    if folder:
        print(f"{INFO} Language data folder: {folder}")

    installed = installed_ocr_languages()
    wanted = [c for c in OCR_LANGUAGES.split("+") if c.strip()]
    absent = [c for c in wanted if c not in installed]

    if not absent:
        print(f"{OK} All requested languages present: {'+'.join(wanted)}")
        print()
        print("Scanned documents in every supported script will read correctly.")
        return 0

    print(f"{BAD} Missing language data: {', '.join(absent)}")
    print("       tesseract will NOT fail on a page in those scripts. It reads")
    print("       them as Latin and returns confident nonsense, which then")
    print("       becomes extracted fields that are wrong rather than blank.")
    print()
    if folder:
        print("       Fix - download the missing files into the folder above.")
        print("       In PowerShell, as Administrator:")
        print()
        print(f'         $dir = "{folder.rstrip(chr(92) + "/")}"')
        print('         $base = "https://github.com/tesseract-ocr/tessdata/raw/main"')
        print(f'         foreach ($lang in {", ".join(chr(34) + c + chr(34) for c in absent)}) {{')
        print('           Invoke-WebRequest "$base/$lang.traineddata" -OutFile "$dir\\$lang.traineddata"')
        print("         }")
        print()
        print("       On Linux: sudo apt-get install " +
              " ".join(f"tesseract-ocr-{c}" for c in absent))
    else:
        print("       Fix: install the traineddata for " + ", ".join(absent) + ".")
    print()
    print("       Then run this again - it should report all languages present.")
    return 1


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
