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

        # VITE_* in the root .env does nothing whatsoever. Vite reads
        # frontend/.env, and this file is the backend's - so a setting put
        # here is not overriding anything, it is simply inert. Worth saying
        # out loud: a .env that looks populated is the strongest possible
        # reason to stop suspecting the .env, and someone who put the
        # frontend's URL here may well have replaced the backend's keys doing
        # it.
        frontend_only = [n for n in names if n.startswith("VITE_")]
        if frontend_only:
            print(f"{INFO} {', '.join(frontend_only)} belongs in frontend/.env, not here.")
            print("       Vite reads that file; this one is the backend's, so these")
            print("       settings have no effect at all where they are.")
            if len(frontend_only) == len(names):
                print(f"{BAD} This .env contains nothing but frontend settings.")
                print("       If the backend used to work, its keys were overwritten.")
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

    # Said separately because it can differ, and when it does, silence here
    # is how semantic search goes missing without anyone connecting it to a
    # provider change. OpenRouter has no embeddings endpoint at all.
    embeddings = ai_providers.embeddings_describe()
    if embeddings["available"]:
        if embeddings["provider"] != mode:
            print(f"{OK} Embeddings: {embeddings['provider']} ({embeddings['model']})"
                  f" - a different provider from {mode}, which is fine and deliberate")
        else:
            print(f"{OK} Embeddings: {embeddings['provider']} ({embeddings['model']})")
    else:
        print(f"{BAD} Embeddings unavailable - semantic search cannot be built.")
        print(f"       {embeddings['reason']}")

    # 3. The step /health cannot do: actually call it.
    print(f"{INFO} Calling {mode} for real...")
    try:
        # 500, not 20. The app's smallest real call is 500, and a reasoning
        # model bills its thinking against this same budget - so a 20-token
        # probe is consumed entirely by thinking, returns no text, and fails
        # a provider that works perfectly for every call the app makes. A
        # doctor that fails where the patient is healthy is worse than none:
        # it cost a real debugging session an hour chasing a rate limit.
        reply = ai_providers.complete("Reply with the single word: ready", 500)
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
    if "unavailable for free" in lowered:
        # OpenRouter names a replacement slug, and it is the PAID one - the
        # message says so in passing ("the paid version is available now")
        # and it is easy to read as a fix rather than a bill. Free ids rotate
        # as promotions end, which is exactly why OPENROUTER_MODEL has no
        # default in this project.
        suggested = re.search(r"use this slug instead:\s*([\w./:-]+)", error)
        paid = f" ({suggested.group(1)})" if suggested else ""
        return (
            "Fix: that free model has been withdrawn. The slug OpenRouter "
            f"suggests{paid} is the PAID one - using it spends credits.\n"
            "       Pick a current free id from "
            "https://openrouter.ai/models?max_price=0 (they end in ':free'), "
            "set OPENROUTER_MODEL to it, and run this again."
        )
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
    if "output limit" in lowered or "reasoning models bill" in lowered:
        return ("Fix: this is a token budget, not an outage. The message above "
                "says what to raise.")
    if "declined to answer" in lowered or "content filter" in lowered:
        return ("Fix: nothing - the provider works. This particular prompt was "
                "refused; try the pipeline on a real document.")
    if "could not reach" in lowered or "timed out" in lowered:
        return ("Fix: no network route to the provider. Check your internet, "
                "VPN or proxy, or raise AI_TIMEOUT_SECONDS in .env.")
    return "Fix: send this whole message to whoever is helping you debug."


if __name__ == "__main__":
    raise SystemExit(main())
