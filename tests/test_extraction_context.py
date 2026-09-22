# -*- coding: utf-8 -*-
"""
Which 8000 characters extraction reads.

The prompt has always sent `text[:8000]`. On the corpus that is the whole
document, so the choice never showed. On a 342-page annual report - roughly
750,000 characters - the first 8000 are the cover, the contents and the
foreword, and every extracted field comes from there. The platform reports
"completed" over values read from about one percent of the document.

extraction_context picks the passages likeliest to carry the schema's fields
instead, from anywhere in the document, within the same budget. Same model
cost, no embedding quota, no network.

Two properties are worth more than the selection itself:

  A document that fits the budget must come back whole. Every document in the
  evaluation corpus does, so the accuracy measured on them cannot move, and a
  later change to those numbers is attributable to the real documents added
  rather than to this.

  Selection must not be English-only. The corpus is English, Hindi and
  Telugu; a Latin-only cue list would rank a whole Devanagari report below an
  English page footer, quietly turning a trilingual system monolingual.
"""
import io
import re
import unittest
from pathlib import Path

from pypdf import PdfReader

import extraction_context as ec
from document_processor import extract_text_and_pages

CORPUS = Path(__file__).resolve().parent.parent / "samples" / "corpus"

FILLER = (
    "The Board places on record its appreciation of the co-operation extended "
    "by the Ministry of Coal and the Government of India. Corporate governance "
    "disclosures follow in the annexures. "
) * 12


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def bury(real_pages, at: int = 200, total: int = 342):
    """A real document's pages, sunk inside a long report's worth of filler."""
    pages = []
    for index in range(total):
        offset = index - at
        if 0 <= offset < len(real_pages):
            pages.append(real_pages[offset])
        else:
            pages.append(FILLER)
    return pages


def page_texts_of(path: Path):
    return [(page.extract_text() or "") for page in PdfReader(io.BytesIO(path.read_bytes())).pages]


class ShortDocumentsAreUntouched(unittest.TestCase):
    """The no-op property the corpus accuracy depends on."""

    def test_every_corpus_document_survives(self):
        documents = sorted(CORPUS.glob("*.pdf"))
        self.assertTrue(documents, f"no corpus under {CORPUS}")
        for path in documents:
            with self.subTest(document=path.name):
                text, pages = extract_text_and_pages(path.read_bytes(), path.name)
                selected, _ = ec.select_passages(pages, text)
                # Every page's content still present: nothing was dropped for
                # being low-scoring in a document that fits whole.
                self.assertGreaterEqual(
                    len(norm(selected)), len(norm(text)) * 0.95,
                    f"{path.name} lost content it had budget to keep",
                )

    def test_empty_input(self):
        self.assertEqual(ec.select_passages([], None), ("", []))
        self.assertEqual(ec.select_passages(None, None), ("", []))

    def test_pages_are_reported(self):
        path = CORPUS / "EN-01_Jharia_BCCL_FY2024-25.pdf"
        _, pages = ec.select_passages(page_texts_of(path))
        self.assertEqual(pages, [1, 2])


class LongDocumentsReachTheirContent(unittest.TestCase):
    """The reason this module exists."""

    NEEDLES = ("Jharia", "BCCL", "Bharat Coking", "Dhanbad", "Jharkhand")

    def setUp(self):
        self.pages = bury(page_texts_of(CORPUS / "EN-01_Jharia_BCCL_FY2024-25.pdf"))
        self.whole = "\n\n".join(self.pages)

    def test_the_old_slice_finds_none_of_it(self):
        # Pins the problem, so this test file explains itself if the default
        # budget or the corpus ever changes.
        head = self.whole[: ec.DEFAULT_BUDGET_CHARS]
        for needle in self.NEEDLES:
            self.assertNotIn(needle.lower(), head.lower())

    def test_selection_finds_it(self):
        selected, pages = ec.select_passages(self.pages)
        found = [n for n in self.NEEDLES if n.lower() in selected.lower()]
        self.assertGreaterEqual(
            len(found), 4, f"only found {found} of {list(self.NEEDLES)}"
        )
        self.assertIn(201, pages, "the page carrying the content was not selected")

    def test_the_budget_is_respected_and_mostly_spent(self):
        selected, _ = ec.select_passages(self.pages)
        self.assertLessEqual(len(selected), ec.DEFAULT_BUDGET_CHARS * 1.05)
        # Underspending sends the model less evidence than it would have read.
        self.assertGreater(len(selected), ec.DEFAULT_BUDGET_CHARS * 0.7)

    def test_the_head_of_the_document_is_always_kept(self):
        # Company, mine and reporting period live on the title page and score
        # badly, so scoring alone would drop the fields that identify the
        # document.
        _, pages = ec.select_passages(self.pages)
        self.assertIn(1, pages)

    def test_a_custom_budget_is_honoured(self):
        selected, _ = ec.select_passages(self.pages, budget=3000)
        self.assertLessEqual(len(selected), 3150)


class SelectionIsNotEnglishOnly(unittest.TestCase):
    def test_hindi_and_telugu_documents_are_reached_when_buried(self):
        for name, needles in (
            ("HI-01_Jayant_NCL_FY2024-25.pdf", ("जयंत", "उत्पादन", "कोयला")),
            ("TE-01_Ramagundam_SCCL_FY2024-25.pdf", ("రామగుండం", "ఉత్పత్తి", "బొగ్గు")),
        ):
            with self.subTest(document=name):
                pages = bury(page_texts_of(CORPUS / name))
                selected, page_numbers = ec.select_passages(pages)
                self.assertIn(201, page_numbers, f"{name}: its content was not selected")
                hits = [n for n in needles if n in selected]
                self.assertTrue(hits, f"{name}: none of {needles} survived selection")

    def test_scoring_credits_non_latin_cues(self):
        hindi = "वित्तीय वर्ष में कुल कोयला उत्पादन 21.9 मिलियन टन रहा। जिला सिंगरौली।"
        latin_noise = "The annexures follow. Please refer to the schedules appended hereto."
        self.assertGreater(ec._score(hindi)[0], ec._score(latin_noise)[0])


if __name__ == "__main__":
    unittest.main()
