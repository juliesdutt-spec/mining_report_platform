"""
extract_text_and_pages must equal calling both extractors, exactly.

An upload needs the joined text and the per-page list. Asking for them
separately parses the PDF twice, and on a scan rasterises and OCRs every page
twice at OCR_DPI - measured at 6.7s where 3.9s would do on a two-page scan,
inside a request budget already shared with the model call.

Merging them is only safe if it changes nothing, so this compares the merged
function against the two it replaces over every document in the corpus:
English, Hindi, Telugu, scanned, incomplete and duplicate. Character for
character, because a difference in the joined text changes what the model is
asked about, and a difference in the page list changes which page a piece of
evidence cites.

The two originals stay - the evaluation harness and inspect_documents call
them individually - so this also pins that they keep agreeing.
"""
import unittest
from pathlib import Path

from document_processor import (
    OCR_AVAILABLE,
    extract_pages_from_pdf,
    extract_text_and_pages,
    extract_text_from_pdf,
)

CORPUS = Path(__file__).resolve().parent.parent / "samples" / "corpus"


def corpus_documents():
    return sorted(CORPUS.glob("*.pdf")) if CORPUS.is_dir() else []


class MergedExtractionMatchesTheSeparateCalls(unittest.TestCase):
    def test_corpus_is_present(self):
        # If the corpus moved, every case below would vacuously pass.
        self.assertTrue(corpus_documents(), f"no PDFs under {CORPUS}")

    def test_every_document_agrees(self):
        for path in corpus_documents():
            with self.subTest(document=path.name):
                data = path.read_bytes()
                want_text = extract_text_from_pdf(data, path.name)
                want_pages = extract_pages_from_pdf(data)
                got_text, got_pages = extract_text_and_pages(data, path.name)
                self.assertEqual(got_text, want_text, f"joined text differs for {path.name}")
                self.assertEqual(got_pages, want_pages, f"page list differs for {path.name}")

    def test_a_scan_still_reads_as_a_scan(self):
        # The merged function decides OCR from the same 100-character
        # threshold. If that drifted, a scan would come back empty and be
        # stored as a document with no contents - the failure this codebase
        # has already been bitten by once.
        if not OCR_AVAILABLE:
            self.skipTest("no tesseract on this host")
        scans = [p for p in corpus_documents() if "SCAN" in p.name]
        self.assertTrue(scans, "corpus has no scanned document to check")
        for path in scans:
            with self.subTest(document=path.name):
                text, pages = extract_text_and_pages(path.read_bytes(), path.name)
                self.assertGreater(len(text), 100, "a scan must come back with its text")
                self.assertTrue(any(pages), "a scan must come back with pages")


class UnreadableInput(unittest.TestCase):
    """The asymmetry between the two originals is deliberate, so pin it."""

    def test_a_non_pdf_matches_both_originals(self):
        data = b"this is not a PDF at all"
        want_text = extract_text_from_pdf(data, "broken.pdf")
        want_pages = extract_pages_from_pdf(data)
        got_text, got_pages = extract_text_and_pages(data, "broken.pdf")
        self.assertEqual(got_text, want_text)
        self.assertEqual(got_pages, want_pages)

    def test_empty_input_matches_both_originals(self):
        want_text = extract_text_from_pdf(b"", "empty.pdf")
        want_pages = extract_pages_from_pdf(b"")
        got_text, got_pages = extract_text_and_pages(b"", "empty.pdf")
        self.assertEqual(got_text, want_text)
        self.assertEqual(got_pages, want_pages)


if __name__ == "__main__":
    unittest.main()
