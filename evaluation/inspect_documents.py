# -*- coding: utf-8 -*-
"""
Report what the pipeline makes of real documents, before you trust it with them.

Everything DataForge has been tested against so far is a fixture this project
generated. Fixtures are clean: the text layer is there, the pages are the size
the generator chose, the scans were rendered rather than photocopied. Real
departmental reporting is a different distribution, and the bad way to find
that out is on demo day.

This reads actual PDFs and says what will happen to them - page count, whether
there is a text layer at all or OCR has to carry it, how much text comes out,
which script it is in, how many passages it will index to, and whether the
upload ceiling will refuse it. **It needs no API key**, because none of that
involves a model: it is the document-processing half of the pipeline, which is
the half that either works on a real scan or does not.

    python -m evaluation.inspect_documents ~/Downloads/cmpdi
    python -m evaluation.inspect_documents report.pdf --labels

`--labels` writes a skeleton into evaluation/labelled/ for each document, with
the fields the scorer knows about left blank, so hand-labelling is filling in
what the document says rather than remembering the schema.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

LABELS_DIR = Path(__file__).resolve().parent / "labelled"

SCRIPTS = (
    ("Devanagari", re.compile(r"[ऀ-ॿ]")),
    ("Telugu", re.compile(r"[ఀ-౿]")),
    ("Bengali", re.compile(r"[ঀ-৿]")),
    ("Tamil", re.compile(r"[஀-௿]")),
    ("Gujarati", re.compile(r"[઀-૿]")),
    ("Odia", re.compile(r"[଀-୿]")),
)


def _scripts_in(text: str) -> str:
    """Which non-Latin scripts appear, and whether anything is unsupported."""
    found = [name for name, pattern in SCRIPTS if pattern.search(text)]
    if not found:
        return "Latin"
    return "Latin + " + ", ".join(found)


def _describe(path: Path) -> dict:
    from document_processor import (
        TEXT_LAYER_MIN_CHARS_PER_PAGE,
        extract_pages_from_pdf,
        has_usable_text_layer,
        page_count,
    )
    from vector_store import chunk_pages

    size = path.stat().st_size
    data = path.read_bytes()

    # The raw text layer, read without the OCR fallback, so the two can be
    # told apart. extract_pages_from_pdf hides that difference on purpose -
    # the app does not care which one answered, and this does.
    pages = page_count(data)
    has_layer = has_usable_text_layer(data)

    extracted = extract_pages_from_pdf(data)
    chars = sum(len(t.strip()) for t in extracted)
    passages = len(chunk_pages(extracted, "\n".join(extracted)))

    max_upload = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

    notes = []
    if size > max_upload:
        notes.append(f"OVER the {max_upload // (1024 * 1024)} MB upload ceiling")
    if not has_layer:
        notes.append("no usable text layer - OCR carries this one")
    if pages and chars / max(pages, 1) < TEXT_LAYER_MIN_CHARS_PER_PAGE:
        notes.append("almost no text extracted - check this by eye before labelling")
    if pages > 200:
        notes.append(f"{pages} pages - OCR runs on every one of them, synchronously")

    return {
        "path": path,
        "size_mb": size / (1024 * 1024),
        "pages": pages,
        "text_layer": has_layer,
        "chars": chars,
        "passages": passages,
        "script": _scripts_in("\n".join(extracted)),
        "notes": notes,
    }


def _pdfs(targets: Iterable[str]) -> list[Path]:
    found: list[Path] = []
    for target in targets:
        path = Path(target).expanduser()
        if path.is_dir():
            found.extend(sorted(path.rglob("*.pdf")))
        elif path.suffix.lower() == ".pdf":
            found.append(path)
        else:
            print(f"  ! {path} is not a PDF or a directory, skipped")
    return found


def _write_label(row: dict) -> Path:
    """A skeleton to fill in by hand, not a guess at the answers."""
    from validation_engine import COMPARABLE_FIELDS, REQUIRED_FIELDS

    fields = {f for f, *_ in COMPARABLE_FIELDS} | {f for f, _ in REQUIRED_FIELDS}
    fields |= {"mine_name", "company_name", "district", "state", "report_date"}

    try:
        document = str(row["path"].resolve().relative_to(PROJECT_ROOT))
    except ValueError:
        document = str(row["path"].resolve())

    destination = LABELS_DIR / f"{row['path'].stem}.json"
    destination.write_text(
        json.dumps(
            {
                "document": document,
                "language": "en",
                "note": (
                    "Hand-read from the PDF. Delete any field the document does "
                    "not state - a field left in with a guessed value scores the "
                    "labeller, not the extractor."
                ),
                "expected": {field: "" for field in sorted(fields)},
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return destination


#: What this tool cannot run without, and what to type. The pip name is not
#: always the import name, which is exactly the point of spelling both out.
REQUIRED = [("pypdf", "pypdf"), ("PIL", "Pillow")]


def _require_dependencies() -> None:
    """
    Fail with an instruction rather than a traceback.

    This is the first command anyone runs against a fresh checkout, and it is
    the one advertised as needing no API key - so a stack trace ending in
    ModuleNotFoundError is the worst possible first impression of the
    project. It also cannot tell you that the answer is one pip command,
    because the module that is missing is rarely the package you install.
    """
    import importlib

    missing = []
    for module, package in REQUIRED:
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(package)
    if missing:
        sys.exit(
            f"Missing: {', '.join(missing)}.\n"
            "Install everything this project needs with:\n"
            "  python -m pip install -r requirements.txt\n"
            "(on Windows, `py -m pip install -r requirements.txt`)"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("targets", nargs="+", help="PDF files, or directories of them")
    parser.add_argument("--labels", action="store_true",
                        help="also write a blank label skeleton for each document")
    args = parser.parse_args()

    documents = _pdfs(args.targets)
    if not documents:
        sys.exit("No PDFs found.")

    _require_dependencies()

    from document_processor import ocr_status

    status = ocr_status()
    rows = [_describe(path) for path in documents]

    print(f"\n{'document':<44}{'MB':>6}{'pages':>7}{'text':>6}{'chars':>9}{'passages':>10}  script")
    print(f"{'-' * 44}{'-' * 6}{'-' * 7}{'-' * 6}{'-' * 9}{'-' * 10}  {'-' * 20}")
    for row in rows:
        print(
            f"{row['path'].name[:43]:<44}{row['size_mb']:>6.1f}{row['pages']:>7}"
            f"{('yes' if row['text_layer'] else 'OCR'):>6}{row['chars']:>9}"
            f"{row['passages']:>10}  {row['script']}"
        )

    flagged = [r for r in rows if r["notes"]]
    if flagged:
        print("\nworth looking at before you trust these:")
        for row in flagged:
            for note in row["notes"]:
                print(f"  {row['path'].name}: {note}")

    total_passages = sum(r["passages"] for r in rows)
    print(
        f"\n{len(rows)} document(s), {sum(r['pages'] for r in rows)} pages, "
        f"{total_passages} passages"
    )
    # The free tier paces embeddings at 100 a minute; see benchmarks/.
    minutes = total_passages / 100
    print(
        "  indexing these costs "
        + ("under a minute" if minutes < 1 else f"about {minutes:.0f} minute(s)")
        + " on the free tier"
    )
    scanned = sum(1 for r in rows if not r["text_layer"])
    if scanned:
        print(f"  {scanned} of them go through OCR rather than a text layer")
        # Said here rather than left to the per-document rows: a broken OCR
        # install makes those rows read "0 chars", which looks like a bad scan
        # rather than a missing binary.
        if status["ok"]:
            print(f"  OCR is working (tesseract {status['version']}, {status['languages']})")
        else:
            print(f"  ! OCR IS NOT WORKING - those {scanned} will extract to nothing")
            print(f"    {status['reason']}")

    if args.labels:
        print()
        for row in rows:
            print(f"  wrote {_write_label(row)}")
        print("\nFill in what each document actually states, delete the rest, then:")
        print("  python -m evaluation.score --json")


if __name__ == "__main__":
    main()
