# -*- coding: utf-8 -*-
"""
The scorer that finally puts a number on extraction.

Its own logic has to be right, or the measurement is worse than none: a
generous scorer would report accuracy the platform does not have.
"""
import builtins
import json
import re
import tempfile
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
            if label.get("corpus") == "real":
                # Not committed by design (evaluation/real/README.md); the
                # label pins the file by URL and hash instead, which
                # TheRealSetCanBeAudited checks.
                continue
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
        # Matched without the closing paren: score() has grown arguments
        # since, and pinning the exact call text made this fail on a change
        # that had nothing to do with the ordering it is guarding.
        self.assertLess(
            body.index("refuse_to_record("), body.index("score(args.language"),
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
        calls = iter([(real, "gemini", False), (real, "mock", False)])

        with mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_load_labels", lambda language: [
                 {"document": "a.pdf", "language": "en", "expected": real, "_label_file": "a.json"},
                 {"document": "b.pdf", "language": "en", "expected": real, "_label_file": "b.json"},
             ]), \
             mock.patch.object(Path, "exists", lambda self: True), \
             mock.patch.object(scorer, "_extract", lambda path, use_cache=True: next(calls)):
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
             mock.patch.object(scorer, "_extract", lambda path, use_cache=True: (real, "gemini", False)):
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


class AScanInAScriptTheHostCannotReadIsRefusedToo(unittest.TestCase):
    """
    The second-order version of the OCR gap, and the more dangerous one.

    tesseract with only `eng` does not fail on a Devanagari page. It reads it
    as Latin and returns confident nonsense, which extraction then parses into
    fields. Those score `wrong` rather than `missing` - and `wrong` is the
    bucket that corrupts a conflict report, where a blank is a visible gap.

    Found on a real Windows install where the language checkboxes in the
    installer were missed: OCR reported as working, SCAN-02 (Hindi) extracted
    1664 characters, and the script detector called it Latin.
    """

    def setUp(self):
        self.labels = _load_labels(None)
        self.working = {
            "ok": True, "reason": None, "version": "5.5.3",
            "languages": "eng", "missing_languages": ["hin", "tel"], "path": "on PATH",
        }

    def test_english_only_OCR_refuses_over_the_hindi_scan(self):
        with mock.patch.object(document_processor, "ocr_status", return_value=self.working), \
             mock.patch.object(document_processor, "installed_ocr_languages",
                               return_value={"eng", "osd"}):
            with self.assertRaises(SystemExit) as caught:
                _refuse_if_ocr_unavailable(self.labels)

        message = str(caught.exception)
        self.assertIn("SCAN-02", message)
        self.assertIn("hin", message)
        # The English scan is readable, so it must not be swept in.
        self.assertNotIn("SCAN-01", message)
        # And it must say why this is worse than a blank, or someone will
        # reasonably decide to just accept the missing fields.
        self.assertIn("nonsense", message)

    def test_all_language_data_present_scores_normally(self):
        full = dict(self.working, languages="eng+hin+tel", missing_languages=[])
        with mock.patch.object(document_processor, "ocr_status", return_value=full), \
             mock.patch.object(document_processor, "installed_ocr_languages",
                               return_value={"eng", "hin", "tel", "osd"}):
            self.assertIsNone(_refuse_if_ocr_unavailable(self.labels))

    def test_a_missing_language_only_matters_for_a_scan(self):
        # HI-01 is Hindi with a real text layer. No OCR is involved, so
        # missing Hindi traineddata is irrelevant to it and refusing would be
        # a false alarm over a document that reads perfectly.
        text_layer_hindi = [
            l for l in self.labels
            if l["language"] == "hi" and "SCAN-" not in l["document"]
        ]
        self.assertTrue(text_layer_hindi, "expected a Hindi text-layer document")
        with mock.patch.object(document_processor, "ocr_status", return_value=self.working), \
             mock.patch.object(document_processor, "installed_ocr_languages",
                               return_value={"eng"}):
            self.assertIsNone(_refuse_if_ocr_unavailable(text_layer_hindi))

    def test_no_OCR_at_all_is_still_reported_as_the_bigger_problem_first(self):
        broken = {
            "ok": False, "reason": "tesseract is not installed",
            "version": None, "languages": None, "missing_languages": [], "path": None,
        }
        with mock.patch.object(document_processor, "ocr_status", return_value=broken), \
             mock.patch.object(document_processor, "installed_ocr_languages", return_value=set()):
            with self.assertRaises(SystemExit) as caught:
                _refuse_if_ocr_unavailable(self.labels)
        message = str(caught.exception)
        self.assertIn("not installed", message)
        self.assertIn("SCAN-01", message, "both scans are affected when OCR is absent")
        self.assertIn("SCAN-02", message)


class ExtractionsSurviveAQuotaFailure(unittest.TestCase):
    """
    The free tier caps generation per day, not only per minute.

    13 documents needed 13 calls in one unbroken run. A run that died at
    document 9 discarded the eight that had succeeded, so the next attempt
    cost 13 again - against a daily cap of 20 that is unfinishable. Reported
    from a real machine: "Quota exceeded for metric:
    generate_content_free_tier_requests, limit: 20".
    """

    def setUp(self):
        from evaluation import score as scorer

        self.scorer = scorer
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        patch = mock.patch.object(scorer, "CACHE_DIR", Path(self.folder.name))
        patch.start()
        self.addCleanup(patch.stop)
        self.pdf = (Path(__file__).resolve().parent.parent
                    / "samples" / "corpus" / "EN-01_Jharia_BCCL_FY2024-25.pdf")

    def _extract_returning(self, data, source):
        return mock.patch(
            "ai_extractor.extract_structured_data_detailed",
            return_value={"data": data, "source": source, "note": None},
        )

    def test_a_real_extraction_is_saved_and_reused_without_a_second_call(self):
        fields = {"mine_name": "Jharia Coal Mine"}

        with self._extract_returning(fields, "gemini") as called:
            first, source, from_cache = self.scorer._extract(self.pdf)
        self.assertEqual(first, fields)
        self.assertFalse(from_cache, "the first run must actually call")
        self.assertEqual(called.call_count, 1)

        with self._extract_returning({"mine_name": "SHOULD NOT BE USED"}, "gemini") as again:
            second, _, from_cache = self.scorer._extract(self.pdf)
        self.assertTrue(from_cache)
        self.assertEqual(second, fields, "the saved extraction should win")
        again.assert_not_called()

    def test_mock_output_is_never_saved(self):
        # The whole point of the cache is that a hit is as trustworthy as a
        # call. A stand-in written here would be indistinguishable later.
        with self._extract_returning({"mine_name": "invented"}, "mock"):
            self.scorer._extract(self.pdf)
        self.assertEqual(list(Path(self.folder.name).glob("*.json")), [])

    def test_fresh_ignores_what_was_saved(self):
        with self._extract_returning({"mine_name": "old"}, "gemini"):
            self.scorer._extract(self.pdf)
        with self._extract_returning({"mine_name": "new"}, "gemini"):
            fields, _, from_cache = self.scorer._extract(self.pdf, use_cache=False)
        self.assertEqual(fields, {"mine_name": "new"})
        self.assertFalse(from_cache)

    def test_a_different_model_does_not_reuse_the_first_model_s_answer(self):
        with mock.patch("ai_providers.describe", return_value={"mode": "gemini", "model": "model-a"}), \
             self._extract_returning({"mine_name": "from A"}, "gemini"):
            self.scorer._extract(self.pdf)

        with mock.patch("ai_providers.describe", return_value={"mode": "gemini", "model": "model-b"}), \
             self._extract_returning({"mine_name": "from B"}, "gemini") as called:
            fields, _, from_cache = self.scorer._extract(self.pdf)
        self.assertFalse(from_cache, "a different model is a different measurement")
        self.assertEqual(fields, {"mine_name": "from B"})
        called.assert_called_once()

    def test_a_corrupt_entry_is_ignored_rather_than_scored(self):
        with self._extract_returning({"mine_name": "real"}, "gemini"):
            self.scorer._extract(self.pdf)
        written = next(Path(self.folder.name).glob("*.json"))
        written.write_text("{ truncated", encoding="utf-8")

        with self._extract_returning({"mine_name": "recalled"}, "gemini") as called:
            fields, _, from_cache = self.scorer._extract(self.pdf)
        self.assertFalse(from_cache)
        self.assertEqual(fields, {"mine_name": "recalled"})
        called.assert_called_once()

    def test_a_hand_edited_mock_entry_is_ignored(self):
        with self._extract_returning({"mine_name": "real"}, "gemini"):
            self.scorer._extract(self.pdf)
        written = next(Path(self.folder.name).glob("*.json"))
        entry = json.loads(written.read_text(encoding="utf-8"))
        entry["source"] = "mock"
        written.write_text(json.dumps(entry), encoding="utf-8")

        with self._extract_returning({"mine_name": "recalled"}, "gemini"):
            _, _, from_cache = self.scorer._extract(self.pdf)
        self.assertFalse(from_cache, "a mock entry must never satisfy a lookup")

    def test_the_refusal_says_how_many_calls_a_retry_costs(self):
        from evaluation import score as scorer

        real = {"mine_name": "Jharia Coal Mine"}
        outcomes = iter([
            (real, "gemini", False), (real, "gemini", False),
            (real, "mock", False),
        ])
        with mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_refuse_if_ocr_unavailable", lambda labels: None), \
             mock.patch.object(scorer, "_load_labels", lambda language: [
                 {"document": f"{n}.pdf", "language": "en", "expected": real,
                  "_label_file": f"{n}.json"} for n in "abc"
             ]), \
             mock.patch.object(Path, "exists", lambda self: True), \
             mock.patch.object(scorer, "_extract", lambda path, use_cache=True: next(outcomes)):
            with self.assertRaises(SystemExit) as stop:
                scorer.score(None)

        message = str(stop.exception)
        # The number that decides whether someone on a daily quota bothers.
        self.assertIn("costs 1 call(s), not 3", message)
        self.assertIn("c.pdf", message)


class TheRunSaysWhatItIsDoingWhileItDoesIt(unittest.TestCase):
    """
    Reported as "it is not giving any output bro".

    It was working. The run printed nothing until every document was done,
    and thirteen documents at up to 90 seconds each is twenty minutes of a
    silent terminal - indistinguishable from a hang, and reported as one.
    A tool whose entire purpose is to be trusted should not be the least
    legible thing in the project.
    """

    def _run(self, outcomes):
        from evaluation import score as scorer

        expected = {"mine_name": "Jharia Coal Mine"}
        labels = [
            {"document": f"samples/corpus/EN-0{n}.pdf", "language": "en",
             "expected": expected, "_label_file": f"{n}.json"}
            for n in range(1, len(outcomes) + 1)
        ]
        results = iter(outcomes)
        printed = []
        with mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_refuse_if_ocr_unavailable", lambda l: None), \
             mock.patch.object(scorer, "_provider_name", lambda: "openrouter (m)"), \
             mock.patch.object(scorer, "_load_labels", lambda language: labels), \
             mock.patch.object(Path, "exists", lambda self: True), \
             mock.patch.object(scorer, "_extract",
                               lambda path, use_cache=True: next(results)), \
             mock.patch("builtins.print",
                        lambda *a, **k: printed.append(" ".join(str(x) for x in a))):
            try:
                scorer.score(None)
            except SystemExit:
                pass
        return "\n".join(printed)

    def test_every_document_is_named_as_it_is_reached(self):
        real = {"mine_name": "Jharia Coal Mine"}
        out = self._run([(real, "openrouter", False)] * 3)
        for n in (1, 2, 3):
            self.assertIn(f"EN-0{n}.pdf", out)
            self.assertIn(f"[{n}/3]", out)

    def test_the_provider_is_named_before_the_wait_starts(self):
        real = {"mine_name": "Jharia Coal Mine"}
        out = self._run([(real, "openrouter", False)])
        self.assertIn("openrouter (m)", out)
        # And that Ctrl-C does not throw away what has been paid for, which
        # is the thing someone staring at a silent terminal wants to know.
        self.assertIn("Ctrl-C", out)

    def test_a_reused_extraction_is_distinguishable_from_a_fresh_call(self):
        real = {"mine_name": "Jharia Coal Mine"}
        out = self._run([(real, "openrouter", True), (real, "openrouter", False)])
        self.assertIn("saved", out)
        self.assertIn("ok", out)

    def test_a_document_that_fell_back_is_flagged_on_its_own_line(self):
        # Not only in the refusal at the end: seeing it happen tells someone
        # whether to stop the run rather than wait out twelve more.
        real = {"mine_name": "Jharia Coal Mine"}
        out = self._run([(real, "mock", False)])
        self.assertIn("MOCK", out)


if __name__ == "__main__":
    unittest.main()
