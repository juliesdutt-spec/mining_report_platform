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
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

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


class TesseractIsFoundWithoutEditingPATH(unittest.TestCase):
    """
    Reported from a real Windows machine: tesseract installed, PATH not
    updated, and every scanned document silently extracting to nothing. The
    UB Mannheim installer offers to add itself to PATH and the box is easy to
    miss, so this is the normal outcome rather than an unlucky one.
    """

    def test_PATH_wins_and_pytesseract_is_left_alone(self):
        with mock.patch.object(document_processor.shutil, "which", return_value="/usr/bin/tesseract"):
            self.assertIsNone(document_processor._locate_tesseract())

    def test_an_explicit_setting_is_used_when_PATH_has_nothing(self):
        with mock.patch.object(document_processor.shutil, "which", return_value=None), \
             mock.patch.object(document_processor, "TESSERACT_CMD", r"D:\tools\tesseract.exe"):
            self.assertEqual(document_processor._locate_tesseract(), r"D:\tools\tesseract.exe")

    def test_a_wrong_setting_is_not_quietly_replaced_by_a_guess(self):
        # It must fail naming what the operator asked for. Falling through to
        # a working guess would report a different problem than the one they
        # created, and they would never find their typo.
        with mock.patch.object(document_processor.shutil, "which", return_value=None), \
             mock.patch.object(document_processor, "TESSERACT_CMD", r"C:\typo\tesseract.exe"), \
             mock.patch.object(sys, "platform", "win32"), \
             mock.patch.object(os.path, "isfile", return_value=True):
            self.assertEqual(document_processor._locate_tesseract(), r"C:\typo\tesseract.exe")

    def test_the_standard_windows_install_is_found_on_its_own(self):
        expected = document_processor._WINDOWS_TESSERACT_PATHS[0]
        with mock.patch.object(document_processor.shutil, "which", return_value=None), \
             mock.patch.object(document_processor, "TESSERACT_CMD", ""), \
             mock.patch.object(sys, "platform", "win32"), \
             mock.patch.object(os.path, "isfile", lambda p: p == expected):
            self.assertEqual(document_processor._locate_tesseract(), expected)

    def test_nothing_anywhere_gives_up_rather_than_inventing_a_path(self):
        with mock.patch.object(document_processor.shutil, "which", return_value=None), \
             mock.patch.object(document_processor, "TESSERACT_CMD", ""), \
             mock.patch.object(sys, "platform", "win32"), \
             mock.patch.object(os.path, "isfile", return_value=False):
            self.assertIsNone(document_processor._locate_tesseract())

    def test_the_windows_hint_offers_the_env_var_not_only_a_PATH_edit(self):
        with mock.patch.object(sys, "platform", "win32"):
            hint = document_processor._install_hint()
        self.assertIn("TESSERACT_CMD", hint)
        self.assertIn("UB-Mannheim", hint)

    def test_status_says_where_the_binary_came_from(self):
        status = document_processor.ocr_status()
        self.assertIn("path", status)
        if status["ok"]:
            self.assertTrue(status["path"], "a working install must say where it is")


class TheDoctorDiagnosesBothHalvesIndependently(unittest.TestCase):
    """
    Someone with no API key and no Hindi language data has two problems, and
    one run should tell them both. The AI half used to return on its first
    failure, which made the OCR section unreachable for exactly the person
    who most needed it.
    """

    def test_ocr_is_checked_even_when_the_ai_half_fails(self):
        import doctor

        with mock.patch.object(doctor, "_check_ai", return_value=1) as ai, \
             mock.patch.object(doctor, "_check_ocr", return_value=0) as ocr:
            code = doctor.main()
        ai.assert_called_once()
        ocr.assert_called_once()
        self.assertEqual(code, 1, "a failing half must still fail the run")

    def test_either_half_failing_fails_the_run(self):
        import doctor

        with mock.patch.object(doctor, "_check_ai", return_value=0), \
             mock.patch.object(doctor, "_check_ocr", return_value=1):
            self.assertEqual(doctor.main(), 1)
        with mock.patch.object(doctor, "_check_ai", return_value=0), \
             mock.patch.object(doctor, "_check_ocr", return_value=0):
            self.assertEqual(doctor.main(), 0)

    def test_missing_language_data_is_a_failure_not_a_note(self):
        import doctor

        with mock.patch.object(document_processor, "installed_ocr_languages",
                               return_value={"eng", "osd"}):
            if not document_processor.ocr_status()["ok"]:
                self.skipTest("no tesseract on this host")
            code = doctor._check_ocr()
        self.assertEqual(code, 1, "reading Devanagari as Latin is not a pass")

    def test_tessdata_dir_is_reported_so_files_land_in_the_right_place(self):
        # Dropping a .traineddata into the wrong tessdata folder is
        # indistinguishable from never downloading it, and a machine with two
        # tesseract installs has two such folders.
        if not document_processor.ocr_status()["ok"]:
            self.skipTest("no tesseract on this host")
        folder = document_processor.tessdata_dir()
        self.assertTrue(folder, "tesseract should report where it reads data from")
        self.assertIn("tessdata", folder)


class TheDoctorNamesFrontendSettingsInTheBackendEnv(unittest.TestCase):
    """
    Reported state: `.env found (1 settings: VITE_API_URL)`.

    VITE_* is read by Vite out of frontend/.env. In the root .env it is
    inert - not overriding anything, just absent of effect. The failure mode
    is that the file looks populated, so the .env is the last place anyone
    looks, while the backend key it used to hold is gone.
    """

    def _run(self, contents):
        import doctor

        with tempfile.TemporaryDirectory() as folder:
            env = pathlib.Path(folder) / ".env"
            env.write_text(contents, encoding="utf-8")
            printed = []
            with mock.patch.object(doctor.Path, "resolve", autospec=True,
                                   side_effect=lambda self: pathlib.Path(folder) / "doctor.py"), \
                 mock.patch("builtins.print", lambda *a, **k: printed.append(" ".join(map(str, a)))):
                try:
                    doctor._check_ai()
                except Exception:
                    pass
            return "\n".join(printed)

    def test_a_vite_only_env_is_called_out_as_the_likely_cause(self):
        out = self._run("VITE_API_URL=https://example.invalid\n")
        self.assertIn("VITE_API_URL", out)
        self.assertIn("frontend/.env", out)
        self.assertIn("nothing but frontend settings", out)

    def test_a_backend_env_is_not_nagged_about(self):
        out = self._run("GEMINI_API_KEY=xx\nAUTH_SECRET=yy\n")
        self.assertNotIn("frontend/.env", out)
        # And a key is never echoed back, whatever else is printed.
        self.assertNotIn("xx", out)

    def test_a_mixed_env_warns_without_claiming_the_backend_is_empty(self):
        out = self._run("VITE_API_URL=https://example.invalid\nGEMINI_API_KEY=xx\n")
        self.assertIn("frontend/.env", out)
        self.assertNotIn("nothing but frontend settings", out)


class TheTessdataPathSurvivesAWindowsDriveLetter(unittest.TestCase):
    """
    Reported from a Windows run: `Language data folder: C`.

    The capture was non-greedy up to a colon, and the first colon on Windows
    is the one in the drive letter. The truncated path then went into a
    generated install command as $dir = "C", which would have put the
    language files somewhere tesseract never looks - and looked like they had
    downloaded fine.
    """

    def _dir_from(self, output):
        with mock.patch.object(document_processor, "OCR_AVAILABLE", True), \
             mock.patch.object(document_processor.subprocess, "run",
                               return_value=mock.Mock(stdout=output, stderr="")):
            return document_processor.tessdata_dir()

    def test_a_windows_path_keeps_its_drive_letter(self):
        folder = self._dir_from(
            'List of available languages in "C:\\Program Files\\Tesseract-OCR'
            '\\tessdata/" (4):\neng\nhin\n'
        )
        self.assertEqual(folder, "C:\\Program Files\\Tesseract-OCR\\tessdata/")
        self.assertNotEqual(folder, "C")

    def test_a_posix_path_is_unchanged(self):
        folder = self._dir_from(
            'List of available languages in "/usr/share/tesseract-ocr/5/tessdata/" (4):\neng\n'
        )
        self.assertEqual(folder, "/usr/share/tesseract-ocr/5/tessdata/")

    def test_an_unquoted_path_still_parses(self):
        folder = self._dir_from(
            "List of available languages in /usr/share/tessdata/ (3):\neng\n"
        )
        self.assertEqual(folder, "/usr/share/tessdata/")

    def test_output_that_says_nothing_about_a_folder_gives_none(self):
        # Better than a wrong path: a wrong one sends files somewhere real
        # that tesseract does not read, which looks like success.
        self.assertIsNone(self._dir_from("eng\nhin\n"))


if __name__ == "__main__":
    unittest.main()
