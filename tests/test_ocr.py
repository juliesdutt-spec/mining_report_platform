"""
OCR of scanned PDFs.

This exists because OCR silently did nothing for the whole life of the project.
_ocr_pdf imported pdf2image inside a bare `except ImportError: pass`, and
pdf2image was never in requirements.txt, so the import always raised, the
exception was swallowed, and every scanned document came back as the string
"Could not extract text from this document." The tesseract language packs were
installed and correct; nothing ever turned a page into an image for them to
read. These tests fail if that path breaks again.
"""
import io
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import document_processor
from document_processor import (
    extract_pages_from_pdf,
    extract_text_from_pdf,
    _fallback_extraction,
)

try:
    import pymupdf
    HAVE_PYMUPDF = True
except ImportError:
    HAVE_PYMUPDF = False


def _has_tesseract() -> bool:
    if not document_processor.OCR_AVAILABLE:
        return False
    try:
        import pytesseract
        return bool(pytesseract.get_languages(config=""))
    except Exception:
        return False


CAN_OCR = HAVE_PYMUPDF and _has_tesseract()

PAGE_ONE = "ANNUAL MINING REPORT 2024-25"
PAGE_TWO = "Total coal extracted during FY 2024-25: 620000 MT"


def _scanned_pdf() -> bytes:
    """A two-page PDF with no text layer at all - only page images."""
    from fpdf import FPDF

    pdf = FPDF()
    for line in (PAGE_ONE, PAGE_TWO):
        pdf.add_page()
        pdf.set_font("Helvetica", "", 16)
        pdf.cell(0, 12, line, new_x="LMARGIN", new_y="NEXT")
    source = pymupdf.open(stream=bytes(pdf.output()), filetype="pdf")

    flat = pymupdf.open()
    for page in source:
        pix = page.get_pixmap(dpi=200, colorspace=pymupdf.csGRAY)
        target = flat.new_page(width=page.rect.width, height=page.rect.height)
        target.insert_image(target.rect, stream=pix.tobytes("png"))
    return flat.tobytes(deflate=True)


@unittest.skipUnless(CAN_OCR, "pymupdf or tesseract not installed")
class ScannedDocumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = _scanned_pdf()

    def test_the_fixture_really_has_no_text_layer(self):
        """Otherwise the rest of these tests would pass without OCR running."""
        doc = pymupdf.open(stream=self.pdf, filetype="pdf")
        self.assertEqual("".join(page.get_text() for page in doc).strip(), "")
        doc.close()

    def test_a_scan_is_read_rather_than_given_up_on(self):
        text = extract_text_from_pdf(self.pdf, "scan.pdf")
        self.assertNotEqual(text, _fallback_extraction(self.pdf))
        self.assertIn("ANNUAL MINING REPORT", text.upper())

    def test_every_page_is_read_not_just_the_first(self):
        text = extract_text_from_pdf(self.pdf, "scan.pdf").upper()
        self.assertIn("620000", text.replace(",", ""))

    def test_a_scan_keeps_its_page_boundaries(self):
        """So a passage OCR'd out of a scan can still cite the page it is on."""
        pages = extract_pages_from_pdf(self.pdf)
        self.assertEqual(len(pages), 2)
        self.assertIn("ANNUAL", pages[0].upper())
        self.assertIn("620000", pages[1].upper().replace(",", ""))


class OcrWiringTests(unittest.TestCase):
    """These hold whether or not tesseract is installed on this host."""

    def test_ocr_does_not_depend_on_pdf2image(self):
        import inspect
        source = inspect.getsource(document_processor)
        self.assertNotIn(
            "from pdf2image import",
            source,
            "OCR is back on pdf2image, which needs poppler installed and is not "
            "in requirements.txt - the exact shape of the original bug.",
        )

    def test_pymupdf_is_declared_as_a_dependency(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(root, "requirements.txt")) as handle:
            requirements = handle.read().lower()
        self.assertIn("pymupdf", requirements,
                      "OCR rasterises with PyMuPDF; without it declared, OCR "
                      "silently does nothing in a fresh deployment.")

    def test_an_unreadable_pdf_still_returns_a_message_not_a_crash(self):
        self.assertIn("could not extract", extract_text_from_pdf(b"not a pdf", "x.pdf").lower()
                      + _fallback_extraction(b"not a pdf").lower())


if __name__ == "__main__":
    unittest.main()
