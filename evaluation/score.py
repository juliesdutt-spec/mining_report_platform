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
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

LABELS_DIR = Path(__file__).resolve().parent / "labelled"

#: exact and equivalent both count as correct; they are kept apart so a run
#: can show how much of the score rests on the equivalence table.
EXACT, EQUIVALENT, MISSING, WRONG = "exact", "equivalent", "missing", "wrong"


#: Which set a labelled document belongs to. Every label written before real
#: documents existed describes a fixture this project generated, so a label
#: that does not say is synthetic - never the other way round, or a fixture
#: would be counted as evidence about real reports.
SYNTHETIC, REAL = "synthetic", "real"

#: A label someone has started but not checked against the PDF. Not scored by
#: default: a half-filled label scores the labeller, not the extractor.
DRAFT, VERIFIED = "draft", "verified"

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def corpus_of(label: dict) -> str:
    return label.get("corpus") or SYNTHETIC


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


#: Extractions already paid for, kept between runs.
#:
#: The free tier caps generation per day, not only per minute. A corpus of 13
#: documents needs 13 calls in one unbroken run, and a run that dies at
#: document 9 used to throw away the eight that had succeeded - so the next
#: attempt cost 13 more. Against a daily cap of 20 that is unfinishable: you
#: can retry every day and never once complete a score.
#:
#: Nothing here weakens the measurement. Every entry is a real model
#: extraction of that exact document, and the key includes the model and the
#: prompt, so changing either one invalidates the lot rather than silently
#: scoring yesterday's answers against today's code. Mock output is never
#: written, so a cache hit can never be a stand-in.
CACHE_DIR = Path(__file__).resolve().parent / ".extractions"


def _cache_key(pdf_bytes: bytes, model: str) -> str:
    """Document, model and prompt together - any change makes a new entry."""
    import ai_extractor
    import extraction_context

    digest = hashlib.sha256()
    digest.update(pdf_bytes)
    digest.update(b"\0")
    digest.update(model.encode("utf-8"))
    digest.update(b"\0")
    # The prompt is the third input to the result, so scoring an old
    # extraction against a reworded prompt would report the old prompt's
    # accuracy under the new one's name.
    #
    # The whole module file, not the extracting function's source: reading a
    # function object breaks the moment anything replaces it, and the key
    # must not depend on something that patchable. Hashing the file
    # over-invalidates - an unrelated edit to ai_extractor.py costs a
    # re-extraction - and that is the right way to be wrong. A stale hit
    # scores silently; a stale miss only costs calls.
    #
    # Both modules, because the prompt is now assembled from two: ai_extractor
    # writes the instructions and extraction_context chooses which passages go
    # in. Hashing only the first would let a change to selection - a different
    # 8000 characters, which is a different question - be scored against
    # results extracted before it.
    try:
        for module in (ai_extractor, extraction_context):
            digest.update(Path(module.__file__).read_bytes())
            digest.update(b"\0")
    except (OSError, TypeError, AttributeError):
        # No readable source: fall back to never reusing rather than reusing
        # across a prompt change nobody can detect.
        digest.update(os.urandom(16))
    return digest.hexdigest()


def _cached(key: str) -> Optional[dict]:
    path = CACHE_DIR / f"{key}.json"
    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    # Defensive: a hand-edited or truncated entry must not become a score.
    if not isinstance(entry.get("data"), dict) or entry.get("source") == "mock":
        return None
    return entry


def _remember(key: str, document: str, data: dict, source: str, model: str) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (CACHE_DIR / f"{key}.json").write_text(
            json.dumps({
                "document": document,
                "data": data,
                "source": source,
                "model": model,
                "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError as exc:
        # A cache that cannot be written is a slower run, not a failed one.
        print(f"  ! could not cache {document}: {exc}")


def _extract(pdf_path: Path, use_cache: bool = True) -> tuple[dict, str, bool]:
    """
    The extracted fields, which provider produced them, and whether it cost a call.

    Re-reading the PDF on a cache hit is deliberate: the key is the document's
    bytes, so a document that changed must miss.
    """
    from document_processor import extract_text_and_pages
    from ai_extractor import extract_structured_data_detailed
    import ai_providers

    data = pdf_path.read_bytes()
    model = str(ai_providers.describe().get("model") or "unknown")
    key = _cache_key(data, model)

    if use_cache:
        entry = _cached(key)
        if entry is not None:
            return entry["data"], entry["source"], True

    # Both views, the way an upload gets them: the harness has to measure the
    # pipeline production runs, and extraction now chooses which passages to
    # read rather than taking the first 8000 characters.
    text, page_texts = extract_text_and_pages(data, pdf_path.name)
    result = extract_structured_data_detailed(text, pdf_path.name, page_texts)
    fields, source = (result.get("data") or {}), result.get("source", "mock")
    if source != "mock":
        _remember(key, pdf_path.name, fields, source, model)
    return fields, source, False


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


def _refuse_if_ocr_unavailable(labels: List[dict]) -> None:
    """
    A scan this host cannot read scores all-missing and says nothing about it.

    The mock refusals catch a provider that is absent or rate-limited. This is
    the same failure one step earlier: extraction cannot be wrong about a
    document whose text never arrived, so every field comes back missing, the
    run completes, and the percentage that lands on the dashboard is the
    accuracy of the extractor on documents that happened to have a text layer -
    presented as its accuracy on the corpus.

    Two of the thirteen labelled documents are scans. They carry 20 of the 124
    fields, so a run without working OCR tops out at 83.9% and reads as though
    the extractor got a fifth of the corpus wrong.

    Checked before any document is extracted, so a run that cannot produce a
    publishable number does not spend quota discovering it.
    """
    from document_processor import (
        OCR_LANGUAGE_CODES, has_usable_text_layer, installed_ocr_languages,
        ocr_status,
    )

    scans = []
    for label in labels:
        path = (PROJECT_ROOT / label["document"]).resolve()
        try:
            data = path.read_bytes()
        except OSError:
            # Unreadable is not the same as scanned. The scoring loop below
            # reports a missing document by name; refusing the whole run over
            # one would be a worse error than the one it is guarding against.
            continue
        if not has_usable_text_layer(data):
            scans.append(label)
    if not scans:
        return

    total = sum(len(l["expected"]) for l in labels)

    def _stop(headline: str, affected: List[dict], detail: str, remedy: str) -> None:
        listed = "\n".join(f"    {l['document']}" for l in affected)
        fields = sum(len(l["expected"]) for l in affected)
        sys.exit(
            f"{headline}\n{listed}\n\n  {detail}\n\n"
            f"That is {fields} of {total} scored fields ({fields / total * 100:.0f}%), "
            f"and the run would report the result as the extractor's accuracy\n"
            f"rather than this machine's setup. {remedy}"
        )

    status = ocr_status()
    if not status["ok"]:
        _stop(
            f"{len(scans)} of {len(labels)} labelled document(s) are scans, and OCR "
            "is not working here:",
            scans,
            status["reason"],
            "Install OCR and run again, or pass --language to score a subset that\n"
            "excludes them and keep the result for yourself.",
        )

    # OCR running is not the same as OCR able to read this document. tesseract
    # with only `eng` does not fail on a Devanagari page - it returns confident
    # Latin nonsense, which extraction then reads and answers over. That is
    # worse than the case above: missing fields are a visible gap, whereas
    # fields extracted from garbage are confidently wrong, and `wrong` is the
    # bucket that corrupts a conflict report.
    installed = installed_ocr_languages()
    unreadable = [
        label for label in scans
        if (code := OCR_LANGUAGE_CODES.get(label.get("language", ""))) and code not in installed
    ]
    if unreadable:
        needed = sorted({
            OCR_LANGUAGE_CODES[l["language"]] for l in unreadable
        })
        _stop(
            f"{len(unreadable)} labelled document(s) are scans in a script this host "
            "has no OCR data for:",
            unreadable,
            f"tesseract is installed but missing: {', '.join(needed)}. It will not "
            f"fail on those pages - it will read them as Latin and return nonsense.",
            f"Install the {', '.join(needed)} language data and run again.",
        )


def label_problems(label: dict) -> List[str]:
    """
    Why this label cannot be scored as it stands, or an empty list.

    The bar is higher for a real document than for a fixture, because the
    fixture's answers are known by construction and a real report's are only
    known because somebody read it. A real label therefore has to say where
    each value was read - page and the words on it - so anyone can open the
    PDF and check the answer key rather than trusting it. An answer key
    nobody can audit is how a benchmark ends up measuring its author.
    """
    name = label.get("_label_file", label.get("document", "?"))
    expected = label.get("expected") or {}
    problems = []

    if not expected:
        problems.append(f"{name}: labels no fields")
    for field, value in expected.items():
        # A skeleton field left blank is not "the document says nothing" -
        # that is expressed by deleting the field. Scored, a blank would
        # count any extracted value as wrong.
        if value is None or not str(value).strip():
            problems.append(
                f"{name}: {field} is blank - delete fields the document does not state"
            )

    if corpus_of(label) != REAL:
        return problems

    status = label.get("status")
    if status not in (DRAFT, VERIFIED):
        problems.append(f"{name}: status must be \"{DRAFT}\" or \"{VERIFIED}\"")

    source = label.get("source") or {}
    if not str(source.get("url") or "").startswith(("http://", "https://")):
        problems.append(f"{name}: source.url must say where the PDF was published")
    if not _SHA256.match(str(source.get("sha256") or "")):
        problems.append(f"{name}: source.sha256 must pin the exact PDF that was read")

    if status == VERIFIED and not str(label.get("labelled_by") or "").strip():
        problems.append(f"{name}: a verified label must say who checked it (labelled_by)")

    evidence = label.get("evidence") or {}
    for field in expected:
        cited = evidence.get(field)
        cited = cited if isinstance(cited, dict) else {}
        page = cited.get("page")
        if not isinstance(page, int) or isinstance(page, bool) or page < 1:
            problems.append(f"{name}: {field} needs evidence.page - the page it was read on")
        if not str(cited.get("quote") or "").strip():
            problems.append(f"{name}: {field} needs evidence.quote - the words on that page")
    for field in evidence:
        if field not in expected:
            problems.append(
                f"{name}: evidence for {field}, which is not labelled - "
                "delete it from both, or label it"
            )
    return problems


def _refuse_if_malformed(labels: List[dict]) -> None:
    problems = [p for label in labels for p in label_problems(label)]
    if problems:
        listed = "\n".join(f"  {p}" for p in problems)
        sys.exit(
            f"{len(problems)} problem(s) in the labels, so nothing was scored "
            f"and no quota was spent:\n{listed}\n\n"
            "See evaluation/real/README.md for what a label needs."
        )


def _refuse_if_changed(labels: List[dict]) -> None:
    """
    Stop when a real document is not the file its label was written against.

    Reports are revised and re-published under the same name. A label read
    from last year's PDF, scored against this year's, would mark the
    extractor wrong for reading the document correctly.
    """
    changed = []
    for label in labels:
        pinned = (label.get("source") or {}).get("sha256")
        if not pinned:
            continue
        path = (PROJECT_ROOT / label["document"]).resolve()
        if not path.exists():
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != pinned:
            changed.append(f"  {label['document']}\n    label pins {pinned}\n    file is    {actual}")
    if changed:
        listed = "\n".join(changed)
        sys.exit(
            "These PDFs are not the files their labels were read from:\n"
            f"{listed}\n\n"
            "Download the exact version from source.url, or re-read the new one "
            "and update the label."
        )


def missing_documents(labels: List[dict]) -> List[dict]:
    return [l for l in labels if not (PROJECT_ROOT / l["document"]).resolve().exists()]


def _where_to_get(label: dict) -> str:
    url = (label.get("source") or {}).get("url")
    return f" - download it from {url}" if url else ""


def check(language: Optional[str] = None) -> Optional[str]:
    """
    Everything the scorer would refuse over, without calling the provider.

    Labelling a real report takes an hour; finding out it was malformed
    should not cost a day's quota. Returns None when all is in order (so
    `sys.exit(check())` exits 0), or the reason it is not.
    """
    loaded = _load_labels(language)
    by_corpus = Counter(corpus_of(l) for l in loaded)
    drafts = [l for l in loaded if l.get("status") == DRAFT]
    print(f"\n  {len(loaded)} label(s): "
          + ", ".join(f"{n} {c}" for c, n in sorted(by_corpus.items()))
          + (f"; {len(drafts)} still draft" if drafts else ""))

    problems = [p for label in loaded for p in label_problems(label)]
    for label in missing_documents(loaded):
        problems.append(f"{label['document']} is not on this machine{_where_to_get(label)}")
    for label in loaded:
        pinned = (label.get("source") or {}).get("sha256")
        path = (PROJECT_ROOT / label["document"]).resolve()
        if pinned and path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() != pinned:
            problems.append(f"{label['document']} is not the file its label pins (sha256 differs)")

    if problems:
        return "\n".join(["", *(f"  {p}" for p in problems), "",
                          f"  {len(problems)} problem(s). See evaluation/real/README.md."])
    print("  all labels are in order"
          + (" - mark drafts verified once checked against their pages" if drafts else ""))
    return None


def _provider_name() -> str:
    """Which provider is about to be billed, for the line before the wait."""
    import ai_providers

    described = ai_providers.describe()
    model = described.get("model")
    return f"{described.get('mode')} ({model})" if model else str(described.get("mode"))


def score(
    language: Optional[str] = None,
    use_cache: bool = True,
    include_drafts: bool = False,
) -> dict:
    loaded = _load_labels(language)
    labels = [l for l in loaded if include_drafts or l.get("status") != DRAFT]
    drafts = len(loaded) - len(labels)
    if not labels:
        sys.exit(
            f"No labelled documents{' for ' + language if language else ''}"
            + (f" ({drafts} draft label(s) not scored; pass --include-drafts)." if drafts else ".")
        )

    # All three before the provider is called: each one is a reason the
    # number would be wrong, and finding it after the run is a bill for
    # nothing.
    _refuse_if_malformed(labels)
    _refuse_if_changed(labels)
    _refuse_if_mocked()
    _refuse_if_ocr_unavailable(labels)

    per_field: Dict[str, Counter] = {}
    documents = []
    contaminated: List[str] = []
    reused = 0

    # Printed per document, flushed, before the call rather than after.
    #
    # The run used to print nothing at all until every document was done.
    # Thirteen documents at up to 90 seconds each is twenty minutes of an
    # utterly silent terminal, which is indistinguishable from a hang - and
    # was reported as one. A scorer whose whole purpose is to be trusted
    # should not be the least legible thing in the project. OCR on a scan
    # adds to it: rasterising two pages at 200 dpi and running tesseract
    # happens before the call and takes seconds on its own.
    print(f"\nScoring {len(labels)} document(s) with "
          f"{_provider_name()}. Ctrl-C is safe: what has been extracted is saved.\n")
    if drafts:
        print(f"  {drafts} draft label(s) not scored - verify them, or pass --include-drafts\n")

    for position, label in enumerate(labels, start=1):
        pdf_path = (PROJECT_ROOT / label["document"]).resolve()
        if not pdf_path.exists():
            print(f"  ! {label['_label_file']}: {label['document']} not found, "
                  f"skipped{_where_to_get(label)}")
            continue

        name = Path(label["document"]).name
        print(f"  [{position}/{len(labels)}] {name[:52]:54}", end="", flush=True)
        extracted, source, from_cache = _extract(pdf_path, use_cache)
        if from_cache:
            reused += 1
        print("saved" if from_cache else ("MOCK" if source == "mock" else "ok"), flush=True)
        # The extractor falls back to mock output when a call fails, which is
        # right for an upload and fatal here: one 429 in the middle of a run
        # would score fabricated fields against hand-read labels and fold the
        # result into a single published percentage. Checking the configured
        # mode once at the start cannot see this - it happens per document.
        if source == "mock":
            contaminated.append(label["document"])
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
            "corpus": corpus_of(label),
            "language": label.get("language", "unknown"),
            "source": source,
            "fields": outcomes,
        })

    totals = Counter()
    for counts in per_field.values():
        totals.update(counts)

    scored = sum(totals.values())
    correct = totals[EXACT] + totals[EQUIVALENT]
    if contaminated:
        listed = "\n".join(f"    {d}" for d in contaminated)
        done = len(documents) - len(contaminated)
        sys.exit(
            f"{len(contaminated)} of {len(documents)} document(s) fell back to mock\n"
            f"extraction, so this score would be part measurement and part\n"
            f"fiction:\n{listed}\n\n"
            f"The other {done} are extracted and saved, so running again costs "
            f"{len(contaminated)} call(s), not {len(documents)}.\n"
            "That matters against a daily quota: the free tier caps requests per\n"
            "day as well as per minute, so a corpus can be finished across several\n"
            "runs rather than needing one unbroken one.\n\n"
            "Wait for the limit to clear and run exactly this command again."
        )

    return {
        "documents": documents,
        # Kept apart because they answer different questions. The synthetic
        # set says whether extraction works on documents whose answers are
        # known by construction; the real set says whether it works on what
        # departments actually publish. One blended percentage would let the
        # first stand in for the second.
        "byCorpus": _by_corpus(documents),
        "perField": {f: dict(c) for f, c in per_field.items()},
        "totals": dict(totals),
        "fieldsScored": scored,
        "accuracy": (correct / scored) if scored else 0.0,
        # Provenance, because a run assembled over three days is still a real
        # measurement but should not pretend to be one sitting. Every reused
        # extraction was a live model call on the same document, model and
        # prompt - the cache key is all three.
        "reusedExtractions": reused,
        "recordedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _by_corpus(documents: List[dict]) -> Dict[str, dict]:
    grouped: Dict[str, dict] = {}
    for document in documents:
        entry = grouped.setdefault(
            document.get("corpus", SYNTHETIC), {"documents": 0, "totals": Counter()}
        )
        entry["documents"] += 1
        entry["totals"].update(o["verdict"] for o in document["fields"].values())
    summary = {}
    for corpus, entry in grouped.items():
        totals = entry["totals"]
        scored = sum(totals.values())
        summary[corpus] = {
            "documents": entry["documents"],
            "fieldsScored": scored,
            "accuracy": ((totals[EXACT] + totals[EQUIVALENT]) / scored) if scored else 0.0,
            "totals": dict(totals),
        }
    return summary


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
    if result.get("reusedExtractions"):
        print(f"  {result['reusedExtractions']} reused a saved extraction "
              f"(same document, model and prompt) - pass --fresh to re-call")
    print(f"  accuracy {result['accuracy'] * 100:.1f}%"
          f"  ({totals.get(EXACT, 0)} exact + {totals.get(EQUIVALENT, 0)} equivalent)")
    for corpus, part in sorted((result.get("byCorpus") or {}).items()):
        print(f"    {corpus:10} {part['accuracy'] * 100:5.1f}%  over {part['fieldsScored']} "
              f"field(s) in {part['documents']} document(s)")
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


def refuse_to_record(
    language: Optional[str],
    destination: Optional[Path],
    include_drafts: bool = False,
    missing: Optional[List[dict]] = None,
) -> Optional[str]:
    """
    Why this run must not be written to `destination`, or None if it may be.

    One case, and it is the failure the whole harness exists to prevent: a
    single-language run recorded as the corpus figure. The dashboard presents
    that file as the accuracy of every document, so a Hindi-only score saved
    there is an accuracy nobody measured - which is exactly the fabricated
    number the scorer refuses to produce from mock extraction.

    Keeping such a run for yourself is fine. Publishing it is not.
    """
    if destination is None or destination.resolve() != DASHBOARD_PATH.resolve():
        return None
    if include_drafts:
        # A draft is an answer key nobody has checked. Scoring against it is
        # a reasonable thing to do while labelling; publishing the result as
        # the platform's accuracy is not.
        return (
            "Refusing to record an --include-drafts run as the corpus accuracy.\n"
            "Draft labels have not been checked against their PDFs. Mark them "
            "\"verified\" once checked, or pass an explicit path to keep this run."
        )
    if missing:
        # Skipping a document on screen is fine. Publishing a figure that
        # quietly left documents out is a different corpus under the same name.
        listed = "\n".join(f"  {l['document']}{_where_to_get(l)}" for l in missing)
        return (
            f"Refusing to record: {len(missing)} labelled document(s) are not on "
            f"this machine, so the figure would describe a smaller corpus:\n{listed}"
        )
    if not language:
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
        "--fresh", action="store_true",
        help="ignore saved extractions and call the provider for every document "
             "(costs one request each - check your daily quota first)",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="only check the labels and PDFs are in order - no provider calls, no quota",
    )
    parser.add_argument(
        "--include-drafts", action="store_true",
        help="also score labels still marked draft (never recorded to the dashboard)",
    )
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
    candidates = [
        l for l in _load_labels(args.language)
        if args.include_drafts or l.get("status") != DRAFT
    ]
    if args.check:
        sys.exit(check(args.language))
    refusal = refuse_to_record(
        args.language, destination, args.include_drafts, missing_documents(candidates)
    )
    if refusal:
        sys.exit(refusal)

    result = score(args.language, use_cache=not args.fresh, include_drafts=args.include_drafts)
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
