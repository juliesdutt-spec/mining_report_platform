"""
PDF generation must not crash on characters that are not ASCII.

Found in production: downloading a report returned 500 with
FPDFUnicodeEncodingException. fpdf2's built-in fonts encode latin-1 only, and
the text these documents carry comes out of uploaded PDFs and out of a language
model. An em dash or a curly quote is enough to raise - and generated summaries
produce both constantly - as does the rupee sign in Indian mining figures.

The cases below are the characters that actually crashed it.
"""
import unittest

from report_generator import (
    FPDF_AVAILABLE,
    generate_dossier,
    generate_dossier_docx,
    generate_pdf_report,
)
from database import MiningReport


def a_report(**overrides):
    """A stub carrying every column a real row has."""
    row = MiningReport()
    for column in MiningReport.__table__.columns:
        setattr(row, column.name, None)
    row.status = "completed"
    row.extracted_data = {}
    row.filename = "report.pdf"
    for key, value in overrides.items():
        setattr(row, key, value)
    return row


# Each of these raised FPDFUnicodeEncodingException before the fix.
CRASHING_TEXT = {
    "em dash": "Jharia — Block B",
    "curly quotes": "The “North” seam",
    "rupee sign": "Cost ₹12 crore",
    "en dash": "January–March",
    "ellipsis": "Continued…",
    "devanagari": "घाटी खान",
    "degree and prime": "23°47′N",
}


@unittest.skipUnless(FPDF_AVAILABLE, "fpdf2 is not installed")
class PdfUnicodeTests(unittest.TestCase):
    def test_single_report_renders_every_character_that_used_to_crash(self):
        for label, text in CRASHING_TEXT.items():
            with self.subTest(character=label):
                data = generate_pdf_report({"mine_name": text, "summary": text})
                self.assertTrue(data.startswith(b"%PDF"), f"{label} did not produce a PDF")

    def test_dossier_renders_them_too(self):
        # The dossier is a separate construction path through the same class.
        for label, text in CRASHING_TEXT.items():
            with self.subTest(character=label):
                data = generate_dossier(
                    [a_report(mine_name=text, summary=text, company_name=text)],
                    {"exec_summary": True, "production_overview": True},
                    title=text,
                    period=text,
                )
                self.assertTrue(data.startswith(b"%PDF"), f"{label} did not produce a PDF")

    def test_docx_renders_them(self):
        for label, text in CRASHING_TEXT.items():
            with self.subTest(character=label):
                data = generate_dossier_docx(
                    [a_report(mine_name=text, summary=text)],
                    {"exec_summary": True},
                    title=text,
                    period=text,
                )
                self.assertTrue(data.startswith(b"PK"), f"{label} did not produce a DOCX")

    def test_ascii_still_works(self):
        # The fix swaps the font for every document, not only unusual ones, so
        # the ordinary path has to be checked too.
        data = generate_pdf_report({"mine_name": "Jharia Colliery", "summary": "Output steady."})
        self.assertTrue(data.startswith(b"%PDF"))

    def test_a_document_still_renders_without_the_unicode_font(self):
        # If DejaVu cannot be registered the document must still be produced,
        # with unsupported characters replaced - losing one character beats
        # losing the download.
        import report_generator

        saved = report_generator._register_unicode_font
        report_generator._register_unicode_font = lambda pdf: False
        try:
            data = generate_pdf_report({"mine_name": "Jharia — ₹12cr", "summary": "Fallback."})
            self.assertTrue(data.startswith(b"%PDF"))
        finally:
            report_generator._register_unicode_font = saved


if __name__ == "__main__":
    unittest.main()
