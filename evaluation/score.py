# -*- coding: utf-8 -*-
"""
Score extraction against documents a person has read.

Every figure this platform reports, and every conflict it raises, comes out
of the extraction step. Until this existed there was no measured accuracy for
it in any language, which made "the platform works" an assumption rather than
a claim anyone could check.

Run with `python -m evaluation.score`. See evaluation/README.md.
"""
import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

LABELS_DIR = Path(__file__).resolve().parent / "labelled"

#: exact and equivalent both count as correct; they are kept apart so a run
#: can show how much of the score rests on the equivalence table.
EXACT, EQUIVALENT, MISSING, WRONG = "exact", "equivalent", "missing", "wrong"


def _load_labels(language: Optional[str]) -> List[dict]:
    labels = []
    for path in sorted(LABELS_DIR.glob("*.json")):
        label = json.loads(path.read_text(encoding="utf-8"))
        if language and label.get("language") != language:
            continue
        label["_label_file"] = path.name
        labels.append(label)
    return labels


def _classify(expected: str, actual: Optional[str]) -> str:
    """Which bucket one field falls into."""
    from validation_engine import _canonical, _values_conflict

    if actual is None or not str(actual).strip():
        return MISSING
    if _canonical(expected) == _canonical(actual):
        return EXACT
    # Reuse the platform's own notion of agreement: a value the conflict
    # detector would treat as matching must not be scored as wrong here, or
    # the number would describe a stricter system than the one that ships.
    if not _values_conflict(expected, actual):
        return EQUIVALENT
    return WRONG


def _extract(pdf_path: Path) -> dict:
    from document_processor import extract_text_from_pdf
    from ai_extractor import extract_structured_data

    data = pdf_path.read_bytes()
    text = extract_text_from_pdf(data, pdf_path.name)
    return extract_structured_data(text, pdf_path.name) or {}


def _refuse_if_mocked() -> None:
    """A mock run produces a number that means nothing. Say so and stop."""
    import ai_providers

    described = ai_providers.describe()
    if described.get("mode") in (None, "mock"):
        sys.exit(
            "Refusing to score against mock extraction - the result would be\n"
            "a fabricated accuracy figure. Configure a provider first:\n"
            f"  {described.get('reason', 'no provider configured')}"
        )


def score(language: Optional[str] = None) -> dict:
    labels = _load_labels(language)
    if not labels:
        sys.exit(f"No labelled documents{' for ' + language if language else ''}.")

    _refuse_if_mocked()

    per_field: Dict[str, Counter] = {}
    documents = []

    for label in labels:
        pdf_path = (PROJECT_ROOT / label["document"]).resolve()
        if not pdf_path.exists():
            print(f"  ! {label['_label_file']}: {label['document']} not found, skipped")
            continue

        extracted = _extract(pdf_path)
        outcomes = {}
        for field, expected in label["expected"].items():
            verdict = _classify(str(expected), extracted.get(field))
            outcomes[field] = {
                "expected": expected,
                "actual": extracted.get(field),
                "verdict": verdict,
            }
            per_field.setdefault(field, Counter())[verdict] += 1

        documents.append({
            "document": label["document"],
            "language": label.get("language", "unknown"),
            "fields": outcomes,
        })

    totals = Counter()
    for counts in per_field.values():
        totals.update(counts)

    scored = sum(totals.values())
    correct = totals[EXACT] + totals[EQUIVALENT]
    return {
        "documents": documents,
        "perField": {f: dict(c) for f, c in per_field.items()},
        "totals": dict(totals),
        "fieldsScored": scored,
        "accuracy": (correct / scored) if scored else 0.0,
    }


def _render(result: dict) -> None:
    print()
    print(f"  {'field':22} {'exact':>6} {'equiv':>6} {'missing':>8} {'wrong':>6}")
    print(f"  {'-' * 22} {'-' * 6} {'-' * 6} {'-' * 8} {'-' * 6}")
    for field, counts in sorted(result["perField"].items()):
        print(
            f"  {field:22} {counts.get(EXACT, 0):6} {counts.get(EQUIVALENT, 0):6} "
            f"{counts.get(MISSING, 0):8} {counts.get(WRONG, 0):6}"
        )

    totals = result["totals"]
    print()
    print(f"  {len(result['documents'])} document(s), {result['fieldsScored']} fields scored")
    print(f"  accuracy {result['accuracy'] * 100:.1f}%"
          f"  ({totals.get(EXACT, 0)} exact + {totals.get(EQUIVALENT, 0)} equivalent)")
    if totals.get(WRONG):
        print(f"  {totals[WRONG]} wrong - a blank field is a gap someone can see, "
              "a confidently wrong one is what corrupts a conflict report")

    for document in result["documents"]:
        bad = {f: o for f, o in document["fields"].items() if o["verdict"] in (MISSING, WRONG)}
        if not bad:
            continue
        print(f"\n  {document['document']}")
        for field, outcome in bad.items():
            print(f"    {outcome['verdict']:8} {field}")
            print(f"      expected {outcome['expected']!r}")
            print(f"      got      {outcome['actual']!r}")


#: Where the dashboard looks for a recorded run. Writing anywhere else scores
#: extraction and shows nobody: the Extraction accuracy card goes on reading
#: "Not measured", with nothing to say why. `--json` with no path lands here.
DASHBOARD_PATH = PROJECT_ROOT / "evaluation" / "latest.json"


def refuse_to_record(language: Optional[str], destination: Optional[Path]) -> Optional[str]:
    """
    Why this run must not be written to `destination`, or None if it may be.

    One case, and it is the failure the whole harness exists to prevent: a
    single-language run recorded as the corpus figure. The dashboard presents
    that file as the accuracy of every document, so a Hindi-only score saved
    there is an accuracy nobody measured - which is exactly the fabricated
    number the scorer refuses to produce from mock extraction.

    Keeping such a run for yourself is fine. Publishing it is not.
    """
    if destination is None or not language:
        return None
    if destination.resolve() != DASHBOARD_PATH.resolve():
        return None
    return (
        f"Refusing to record a --language {language} run as the corpus accuracy.\n"
        f"The dashboard presents {DASHBOARD_PATH.name} as the figure for every "
        "document, and this run scores a subset.\n"
        "Run without --language to record, or pass an explicit path to keep this "
        "one for yourself."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--language", help="score only documents in this language")
    parser.add_argument(
        "--json", dest="json_path", nargs="?", const=str(DASHBOARD_PATH), default=None,
        help=f"write the result as JSON; with no path, to {DASHBOARD_PATH.name}, "
             "which is the file the dashboard reads",
    )
    args = parser.parse_args()

    destination = Path(args.json_path) if args.json_path else None
    # Checked before scoring, not after. Scoring calls the provider once per
    # document and spends real quota; refusing to record the result at the end
    # of that is a bill for nothing.
    refusal = refuse_to_record(args.language, destination)
    if refusal:
        sys.exit(refusal)

    result = score(args.language)
    result["language"] = args.language or "all"
    _render(result)

    if destination is None:
        return

    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  written to {destination}")
    if destination.resolve() == DASHBOARD_PATH.resolve():
        # The backend runs from the repository and has no writable volume, so
        # a run recorded on a laptop reaches the deployment by being committed.
        print("  the dashboard reads this file - commit it for the deployed one to see it")


if __name__ == "__main__":
    main()
