# -*- coding: utf-8 -*-
"""
Show exactly what the model sends back for one document.

When the scorer reports every field missing, there are only two
possibilities and they need completely different fixes: the model answered
and the pipeline could not read it, or the model did not answer the question.
From the score table those look identical - thirteen rows of `missing`,
`got None` - and the difference is one HTTP response nobody has looked at.

    python -m evaluation.show_reply samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf

Prints the extracted text's size, the raw reply, and what the parser makes of
it. One provider call. Nothing is cached, so this never changes a later score.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", help="a PDF to send")
    parser.add_argument("--full", action="store_true",
                        help="print the whole reply rather than the first 3000 characters")
    args = parser.parse_args()

    import ai_extractor
    import ai_providers
    from document_processor import extract_text_from_pdf

    path = Path(args.document).expanduser()
    if not path.exists():
        sys.exit(f"No such file: {path}")

    described = ai_providers.describe()
    if described["mode"] == "mock":
        sys.exit(
            "No provider is configured, so there is no reply to show.\n"
            f"  {described['reason']}"
        )

    data = path.read_bytes()
    text = extract_text_from_pdf(data, path.name)
    print(f"\nDocument : {path.name}")
    print(f"Text     : {len(text)} characters extracted"
          + ("  <- nothing to send; this is an OCR problem, not a model one"
             if len(text.strip()) < 50 else ""))
    print(f"Provider : {described['mode']} ({described['model']})")
    print("\nCalling...\n")

    prompt = ai_extractor.extraction_prompt(text, path.name)
    try:
        reply = ai_providers.complete(prompt, max_tokens=2000)
    except ai_providers.ProviderError as exc:
        print(f"The call itself failed: {exc}")
        return 1

    shown = reply if args.full else reply[:3000]
    print("=" * 64)
    print("RAW REPLY")
    print("=" * 64)
    print(shown)
    if not args.full and len(reply) > len(shown):
        print(f"\n... {len(reply) - len(shown)} more characters (--full to see them)")

    print()
    print("=" * 64)
    print("WHAT THE PARSER MAKES OF IT")
    print("=" * 64)
    parsed = ai_extractor._parse_json_response(reply)
    if parsed is None:
        print("Nothing - no JSON object could be read out of that.")
        print("The model did not follow the output format. Try a different")
        print("OPENROUTER_MODEL, or raise max_tokens if the reply looks cut off.")
        return 1

    if not ai_extractor._looks_like_our_schema(parsed):
        print("A JSON object, but not an answer to the prompt - it carries none")
        print("of the fields that were asked for. Keys it did send:")
        print(f"  {sorted(parsed)[:20]}")
        print("\nThis is the case that scores 0.0% without any warning: valid")
        print("JSON, so the provider 'answered', and every field reads as")
        print("missing. A different model usually fixes it.")
        return 1

    filled = {k: v for k, v in parsed.items() if v not in (None, "", [], {})}
    print(json.dumps(parsed, indent=2, ensure_ascii=False)[:2000])
    print(f"\n{len(filled)} of {len(parsed)} field(s) have a value.")
    if not filled:
        print("Every field came back null. The model answered in the right")
        print("shape and found nothing - check the extracted text above is")
        print("really the document's content.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
