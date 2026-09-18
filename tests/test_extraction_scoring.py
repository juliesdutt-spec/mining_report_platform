# -*- coding: utf-8 -*-
"""
The scorer that finally puts a number on extraction.

Its own logic has to be right, or the measurement is worse than none: a
generous scorer would report accuracy the platform does not have.
"""
import builtins
import json
import re
import unittest
from pathlib import Path

from unittest import mock

import document_processor
from evaluation.score import (
    DASHBOARD_PATH, EQUIVALENT, EXACT, MISSING, WRONG, _classify, _load_labels,
    _refuse_if_ocr_unavailable, refuse_to_record,
)

LABELS = Path(__file__).resolve().parent.parent / "evaluation" / "labelled"


class EachFieldLandsInTheRightBucket(unittest.TestCase):
    def test_an_identical_value_is_exact(self):
        self.assertEqual(_classify("Jharia Coal Mine", "Jharia Coal Mine"), EXACT)

    def test_casing_and_spacing_are_still_exact(self):
        self.assertEqual(_classify("Open Cast", "open  cast"), EXACT)

    def test_wording_the_platform_treats_as_agreement_is_equivalent(self):
        # Scored against what the product actually does, not a stricter
        # standard it never applies - otherwise the number describes a
        # different system than the one that ships.
        self.assertEqual(_classify("Open Cast", "opencast"), EQUIVALENT)
        self.assertEqual(_classify("coal", "कोयला"), EQUIVALENT)
        self.assertEqual(
            _classify("Singareni Collieries", "Singareni Collieries Company Ltd"),
            EQUIVALENT,
        )

    def test_nothing_extracted_is_missing_not_wrong(self):
        # Kept apart because they fail differently: a blank is a gap someone
        # can see and fill, a wrong value quietly corrupts a conflict report.
        for empty in (None, "", "   "):
            self.assertEqual(_classify("Coal", empty), MISSING)

    def test_a_different_value_is_wrong(self):
        self.assertEqual(_classify("coal", "iron ore"), WRONG)
        self.assertEqual(_classify("Jharia Colliery", "Raniganj Colliery"), WRONG)

    def test_a_near_miss_number_is_not_excused(self):
        self.assertEqual(_classify("45,000 t", "52,000 t"), WRONG)

    def test_the_same_number_written_differently_is_not_wrong(self):
        self.assertIn(_classify("45,000 t", "45000 tonnes"), (EXACT, EQUIVALENT))


class TheLabelledSetIsWellFormed(unittest.TestCase):
    def test_every_label_file_parses_and_names_a_document(self):
        files = list(LABELS.glob("*.json"))
        self.assertTrue(files, "no labelled documents to score against")
        for path in files:
            label = json.loads(path.read_text(encoding="utf-8"))
            self.assertIn("document", label, path.name)
            self.assertIn("expected", label, path.name)
            self.assertTrue(label["expected"], f"{path.name} labels no fields")

    def test_every_labelled_document_exists(self):
        root = LABELS.parent.parent
        for path in LABELS.glob("*.json"):
            label = json.loads(path.read_text(encoding="utf-8"))
            self.assertTrue(
                (root / label["document"]).exists(),
                f"{path.name} points at a missing file: {label['document']}",
            )

    def test_filtering_by_language_selects_a_subset(self):
        everything = _load_labels(None)
        english = _load_labels("en")
        self.assertLessEqual(len(english), len(everything))
        self.assertTrue(all(l.get("language") == "en" for l in english))


class RecordingARunCannotMisrepresentIt(unittest.TestCase):
    """
    The dashboard presents one file as the accuracy of the whole corpus.

    Two ways that goes wrong, and both are the failure this harness exists to
    prevent: a run written somewhere the dashboard never reads (measured, and
    the card still says "Not measured", with nothing to say why), and a
    single-language run recorded as the figure for every document.
    """

    def test_the_default_json_path_is_the_one_the_dashboard_reads(self):
        import extraction_quality

        self.assertEqual(
            DASHBOARD_PATH.resolve(),
            extraction_quality.MEASUREMENT_PATH.resolve(),
            "score --json must land where the dashboard looks, or measuring "
            "extraction changes nothing anyone can see",
        )

    def test_a_single_language_run_is_refused_as_the_corpus_figure(self):
        refusal = refuse_to_record("hi", DASHBOARD_PATH)
        self.assertIsNotNone(refusal)
        self.assertIn("--language hi", refusal)
        self.assertIn(DASHBOARD_PATH.name, refusal)

    def test_a_full_run_records_freely(self):
        self.assertIsNone(refuse_to_record(None, DASHBOARD_PATH))

    def test_a_filtered_run_may_still_be_kept_under_its_own_name(self):
        """Keeping a Hindi-only score for yourself is fine; publishing it is not."""
        self.assertIsNone(refuse_to_record("hi", Path("hindi-only.json")))

    def test_nothing_is_refused_when_nothing_is_being_written(self):
        self.assertIsNone(refuse_to_record("hi", None))

    def test_the_refusal_happens_before_the_provider_is_called(self):
        # Scoring spends one provider call per document. Refusing to record
        # the result afterwards is a bill for nothing.
        source = (Path(__file__).resolve().parent.parent / "evaluation" / "score.py").read_text()
        body = source[source.index("def main()"):]
        self.assertLess(
            body.index("refuse_to_record("), body.index("score(args.language)"),
            "the check must run before scoring, not after",
        )


class AMidRunFallbackCannotBeScored(unittest.TestCase):
    """
    The extractor answers with mock fields when a provider call fails.

    That is right for an upload - a bad minute from Gemini should not 500
    somebody's ingest - and fatal for a measurement. One 429 partway through
    a run would score fabricated fields against hand-read labels and fold the
    result into a single published percentage, with nothing on the page
    saying which documents were real. Checking the configured mode once at
    the start cannot catch it, because it happens per document.
    """

    def test_the_extractor_reports_which_provider_answered(self):
        import ai_extractor

        result = ai_extractor.extract_structured_data_detailed("coal in Jharkhand", "t.pdf")
        self.assertIn("data", result)
        self.assertIn(result["source"], {"mock", "claude", "gemini", "openrouter", "ollama"})

    def test_the_plain_extractor_still_returns_just_the_fields(self):
        """Every existing caller keeps the shape it had."""
        import ai_extractor

        data = ai_extractor.extract_structured_data("coal in Jharkhand", "t.pdf")
        self.assertIsInstance(data, dict)
        self.assertNotIn("source", data)
        self.assertIn("mineral_type", data)

    def test_scoring_stops_when_a_document_fell_back(self):
        from unittest import mock

        from evaluation import score as scorer

        real = {"mine_name": "Jharia Coal Mine"}
        calls = iter([(real, "gemini"), (real, "mock")])

        with mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_load_labels", lambda language: [
                 {"document": "a.pdf", "language": "en", "expected": real, "_label_file": "a.json"},
                 {"document": "b.pdf", "language": "en", "expected": real, "_label_file": "b.json"},
             ]), \
             mock.patch.object(Path, "exists", lambda self: True), \
             mock.patch.object(scorer, "_extract", lambda path: next(calls)):
            with self.assertRaises(SystemExit) as stop:
                scorer.score(None)

        message = str(stop.exception)
        self.assertIn("b.pdf", message, "the contaminated document must be named")
        self.assertNotIn("a.pdf", message, "the clean one is not the problem")
        self.assertIn("mock", message)

    def test_a_fully_real_run_scores_normally(self):
        from unittest import mock

        from evaluation import score as scorer

        real = {"mine_name": "Jharia Coal Mine"}
        with mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_load_labels", lambda language: [
                 {"document": "a.pdf", "language": "en", "expected": real, "_label_file": "a.json"},
             ]), \
             mock.patch.object(Path, "exists", lambda self: True), \
             mock.patch.object(scorer, "_extract", lambda path: (real, "gemini")):
            result = scorer.score(None)

        self.assertEqual(result["accuracy"], 1.0)
        self.assertEqual(result["documents"][0]["source"], "gemini")


class InspectingRealDocumentsNeedsNoKey(unittest.TestCase):
    """
    The step before labelling: what does the pipeline make of this PDF?

    Everything scored so far is a fixture this project generated, which is
    clean in ways real departmental reporting is not. The point of this tool
    is that it runs without a provider - it exercises the document-processing
    half, which is the half that either survives a real scan or does not.
    """

    ROOT = Path(__file__).resolve().parent.parent

    def test_it_separates_a_text_layer_from_a_scan(self):
        from evaluation.inspect_documents import _describe

        text_layer = _describe(self.ROOT / "samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf")
        scanned = _describe(self.ROOT / "samples/corpus/SCAN-01_Sohagpur_SECL_FY2024-25_scanned.pdf")

        self.assertTrue(text_layer["text_layer"])
        self.assertFalse(scanned["text_layer"], "a rendered scan has no usable text layer")
        # And it still gets text out of the scan, via OCR.
        self.assertGreater(scanned["chars"], 500)
        self.assertTrue(any("OCR carries" in n for n in scanned["notes"]))

    def test_it_names_the_scripts_it_found(self):
        from evaluation.inspect_documents import _describe

        hindi = _describe(self.ROOT / "samples/corpus/HI-01_Jayant_NCL_FY2024-25.pdf")
        telugu = _describe(self.ROOT / "samples/corpus/TE-01_Ramagundam_SCCL_FY2024-25.pdf")
        self.assertIn("Devanagari", hindi["script"])
        self.assertIn("Telugu", telugu["script"])

    def test_it_flags_a_file_the_server_would_refuse(self):
        import os
        from unittest import mock

        from evaluation.inspect_documents import _describe

        # The ceiling it reports is the server's, not a second copy of it.
        with mock.patch.dict(os.environ, {"MAX_UPLOAD_MB": "0"}):
            row = _describe(self.ROOT / "samples/corpus/SCAN-01_Sohagpur_SECL_FY2024-25_scanned.pdf")
        self.assertTrue(any("upload ceiling" in n for n in row["notes"]))

    def test_the_label_skeleton_covers_every_scored_field(self):
        """A skeleton missing a field is a field nobody remembers to label."""
        import json
        import tempfile

        from evaluation import inspect_documents
        from validation_engine import COMPARABLE_FIELDS, REQUIRED_FIELDS

        source = self.ROOT / "samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf"
        with tempfile.TemporaryDirectory() as directory:
            original = inspect_documents.LABELS_DIR
            inspect_documents.LABELS_DIR = Path(directory)
            try:
                written = inspect_documents._write_label({"path": source})
            finally:
                inspect_documents.LABELS_DIR = original

            label = json.loads(written.read_text(encoding="utf-8"))

        for field, *_ in COMPARABLE_FIELDS:
            self.assertIn(field, label["expected"], f"{field} is scored but not offered")
        for field, _ in REQUIRED_FIELDS:
            self.assertIn(field, label["expected"])
        # Blank, not guessed: a prefilled value would score the labeller.
        self.assertTrue(all(v == "" for v in label["expected"].values()))
        self.assertTrue(label["document"].startswith("samples/corpus/"))


class AHostThatCannotReadScansIsNotAllowedToScoreThem(unittest.TestCase):
    """
    The 83.9% failure, as a test.

    pytesseract installs cleanly on a machine with no tesseract binary, so
    OCR_AVAILABLE goes True and every page raises TesseractNotFoundError
    inside a caught-and-logged block. The scans then extract to nothing,
    score all-missing, and the run publishes the result as the extractor's
    accuracy. Nothing about that run looks wrong from outside, which is why
    it needs catching before it starts rather than explaining afterwards.
    """

    def setUp(self):
        self.labels = _load_labels(None)
        self.assertTrue(self.labels, "the corpus labels are the fixture here")

    def test_the_corpus_contains_scans_to_refuse_over(self):
        # If this ever fails the refusal has nothing to fire on, and the rest
        # of this class would pass by measuring nothing.
        scans = [
            l for l in self.labels
            if not document_processor.has_usable_text_layer(
                (Path(__file__).resolve().parent.parent / l["document"]).read_bytes()
            )
        ]
        self.assertEqual(len(scans), 2, "expected SCAN-01 and SCAN-02")

    def test_a_missing_binary_stops_the_run_before_it_spends_quota(self):
        broken = {
            "ok": False,
            "reason": "the tesseract binary it wraps is not on PATH",
            "version": None,
            "languages": None,
        }
        with mock.patch.object(document_processor, "ocr_status", return_value=broken):
            with self.assertRaises(SystemExit) as caught:
                _refuse_if_ocr_unavailable(self.labels)

        message = str(caught.exception)
        self.assertIn("SCAN-01", message)
        self.assertIn("SCAN-02", message)
        self.assertIn("not on PATH", message)
        # The share at stake is the point: a bare "OCR is off" leaves someone
        # to guess whether it matters.
        self.assertIn("of 124", message)

    def test_a_working_install_scores_normally(self):
        working = {"ok": True, "reason": None, "version": "5.3.4", "languages": "eng+hin+tel"}
        with mock.patch.object(document_processor, "ocr_status", return_value=working):
            self.assertIsNone(_refuse_if_ocr_unavailable(self.labels))

    def test_a_corpus_of_text_layer_documents_never_asks_about_OCR(self):
        # No scans, no reason to care whether OCR works - and no reason to pay
        # the probe's subprocess call either.
        text_only = [l for l in self.labels if "SCAN-" not in l["document"]]
        with mock.patch.object(document_processor, "ocr_status") as probe:
            self.assertIsNone(_refuse_if_ocr_unavailable(text_only))
        probe.assert_not_called()


class TheOCRProbeTellsAHalfInstallFromAWorkingOne(unittest.TestCase):
    def test_no_module_is_reported_as_no_module(self):
        with mock.patch.object(document_processor, "OCR_AVAILABLE", False):
            status = document_processor.ocr_status()
        self.assertFalse(status["ok"])
        self.assertIn("pytesseract", status["reason"])

    def test_a_module_without_its_binary_is_not_reported_as_working(self):
        # The case that matters: importing succeeded, so every other check in
        # the codebase believes OCR is present.
        with mock.patch.object(document_processor, "OCR_AVAILABLE", True), \
             mock.patch.object(
                 document_processor.pytesseract, "get_tesseract_version",
                 side_effect=OSError("tesseract is not installed"),
             ):
            status = document_processor.ocr_status()
        self.assertFalse(status["ok"])
        self.assertIn("binary", status["reason"])
        # And it says what to do about it, on the platform actually running.
        self.assertTrue(len(status["reason"]) > 60, status["reason"])


class TheInspectorRunsOnAFreshWindowsCheckout(unittest.TestCase):
    """
    The first command in the evaluation README, and the one sold as needing no
    API key. It crashed on a real machine with `No module named 'fitz'`.
    """

    def test_nothing_imports_the_deprecated_fitz_alias(self):
        # PyMuPDF is `pymupdf`; `fitz` is the legacy alias, kept for
        # compatibility and not guaranteed to be installed. The rest of the
        # codebase already imports pymupdf, so the one module still asking for
        # fitz was the one tool meant to run before anything else is set up.
        root = Path(__file__).resolve().parent.parent
        offenders = []
        for path in root.rglob("*.py"):
            if "node_modules" in path.parts or ".git" in path.parts:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if re.search(r"^\s*import fitz\b|^\s*from fitz\b", text, re.M):
                offenders.append(str(path.relative_to(root)))
        self.assertEqual(offenders, [], "use pymupdf, not the fitz alias")

    def test_the_text_layer_check_survives_without_pymupdf(self):
        """
        pymupdf missing must not make every document look like a scan.

        It did: has_usable_text_layer returned False on ImportError, so a
        machine without it would have the scorer refuse over thirteen
        documents, eleven of which read perfectly through pypdf.
        """
        real_import = builtins.__import__

        def without_pymupdf(name, *args, **kwargs):
            if name == "pymupdf":
                raise ImportError("simulated: pymupdf is not installed")
            return real_import(name, *args, **kwargs)

        corpus = Path(__file__).resolve().parent.parent / "samples" / "corpus"
        text_layer = (corpus / "EN-01_Jharia_BCCL_FY2024-25.pdf").read_bytes()
        scan = (corpus / "SCAN-01_Sohagpur_SECL_FY2024-25_scanned.pdf").read_bytes()

        with mock.patch.object(builtins, "__import__", without_pymupdf):
            self.assertTrue(document_processor.has_usable_text_layer(text_layer))
            self.assertFalse(document_processor.has_usable_text_layer(scan))
            self.assertEqual(document_processor.page_count(text_layer), 2)

        # And the verdict is the same one pymupdf gives, or the fallback would
        # quietly change which documents the scorer refuses over.
        self.assertTrue(document_processor.has_usable_text_layer(text_layer))
        self.assertFalse(document_processor.has_usable_text_layer(scan))

    def test_a_missing_dependency_is_an_instruction_not_a_traceback(self):
        from evaluation import inspect_documents

        with mock.patch.object(inspect_documents, "REQUIRED", [("no_such_module", "somepkg")]):
            with self.assertRaises(SystemExit) as caught:
                inspect_documents._require_dependencies()
        message = str(caught.exception)
        self.assertIn("somepkg", message)
        self.assertIn("pip install -r requirements.txt", message)

    def test_an_unreadable_file_has_no_pages_rather_than_raising(self):
        self.assertEqual(document_processor.page_count(b"not a pdf"), 0)
        self.assertFalse(document_processor.has_usable_text_layer(b"not a pdf"))


if __name__ == "__main__":
    unittest.main()
