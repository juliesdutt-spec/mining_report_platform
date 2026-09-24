# -*- coding: utf-8 -*-
"""
Rules for labelling real documents.

The synthetic corpus answers "does extraction work on documents whose answers
we wrote". The evaluator's question was the other one: does it work on what
CMPDI and CIL actually publish. Adding real documents answers that only if
the answer key can be trusted, and a real report's answers are known only
because somebody read it. So a real label must:

  cite a page and quote for every value - so the key can be audited
  pin the PDF by URL and SHA-256    - so it is scored against the file it
                                      was read from, not a later revision
  be verified before it is published - a draft scores the labeller

and the published figure must keep real and synthetic apart, or the 100% on
fixtures would stand in for a number nobody has measured.
"""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from evaluation import score as scorer
from evaluation.score import (
    DASHBOARD_PATH, DRAFT, REAL, SYNTHETIC, VERIFIED, corpus_of, label_problems,
    refuse_to_record,
)

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf"
SAMPLE_HASH = hashlib.sha256(SAMPLE.read_bytes()).hexdigest()


def real_label(**overrides):
    label = {
        "document": "samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf",
        "corpus": REAL,
        "status": VERIFIED,
        "language": "en",
        "source": {"url": "https://example.gov.in/report.pdf", "sha256": SAMPLE_HASH},
        "labelled_by": "A. Labeller",
        "expected": {"mine_name": "Jharia Coal Mine", "district": "Dhanbad"},
        "evidence": {
            "mine_name": {"page": 1, "quote": "Jharia Coal Mine"},
            "district": {"page": 1, "quote": "Dhanbad"},
        },
        "_label_file": "REAL-test.json",
    }
    label.update(overrides)
    return label


class AWellFormedRealLabelPasses(unittest.TestCase):
    def test_a_complete_verified_label_has_no_problems(self):
        self.assertEqual(label_problems(real_label()), [])

    def test_a_label_that_says_nothing_is_synthetic(self):
        # Every label written before real documents existed describes a
        # fixture. Defaulting the other way would count fixtures as evidence
        # about real reports.
        self.assertEqual(corpus_of({"document": "x.pdf"}), SYNTHETIC)
        self.assertEqual(corpus_of(real_label()), REAL)

    def test_the_existing_synthetic_labels_are_untouched_by_the_new_rules(self):
        problems = [p for l in scorer._load_labels(None) for p in label_problems(l)]
        self.assertEqual(problems, [])


class TheRealSetCanBeAudited(unittest.TestCase):
    def test_every_value_needs_a_page(self):
        label = real_label(evidence={
            "mine_name": {"quote": "Jharia Coal Mine"},
            "district": {"page": 1, "quote": "Dhanbad"},
        })
        self.assertTrue(any("mine_name needs evidence.page" in p for p in label_problems(label)))

    def test_a_page_must_be_a_real_page_number(self):
        for page in (0, -1, "3", None, True):
            with self.subTest(page=page):
                label = real_label(evidence={
                    "mine_name": {"page": page, "quote": "Jharia Coal Mine"},
                    "district": {"page": 1, "quote": "Dhanbad"},
                })
                self.assertTrue(label_problems(label))

    def test_every_value_needs_a_quote(self):
        label = real_label(evidence={
            "mine_name": {"page": 1, "quote": "  "},
            "district": {"page": 1, "quote": "Dhanbad"},
        })
        self.assertTrue(any("mine_name needs evidence.quote" in p for p in label_problems(label)))

    def test_evidence_for_a_deleted_field_is_caught(self):
        # Half a deletion - the value removed, its evidence left behind - is
        # the likeliest labelling slip, and it hides which field was meant.
        label = real_label(evidence={
            **real_label()["evidence"],
            "state": {"page": 1, "quote": "Jharkhand"},
        })
        self.assertTrue(any("evidence for state" in p for p in label_problems(label)))

    def test_the_source_must_be_named_and_pinned(self):
        self.assertTrue(label_problems(real_label(source={"sha256": SAMPLE_HASH})))
        self.assertTrue(label_problems(real_label(source={"url": "https://x.in/a.pdf"})))
        self.assertTrue(label_problems(
            real_label(source={"url": "https://x.in/a.pdf", "sha256": "abc"})
        ))

    def test_a_verified_label_names_who_checked_it(self):
        self.assertTrue(label_problems(real_label(labelled_by="")))
        # A draft may be anonymous: nobody has vouched for it yet.
        self.assertEqual(label_problems(real_label(status=DRAFT, labelled_by="")), [])

    def test_the_status_is_one_of_two_words(self):
        self.assertTrue(label_problems(real_label(status="done")))

    def test_a_blank_value_is_an_error_in_any_corpus(self):
        # "Not stated" is expressed by deleting the field. A blank scored as
        # expected would mark any extracted value wrong.
        blank = {"document": "x.pdf", "expected": {"mine_name": ""}, "_label_file": "x.json"}
        self.assertTrue(label_problems(blank))


class APinnedDocumentMustBeTheFileThatWasRead(unittest.TestCase):
    def test_a_matching_file_passes(self):
        scorer._refuse_if_changed([real_label()])

    def test_a_revised_file_stops_the_run(self):
        label = real_label(source={"url": "https://x.in/a.pdf", "sha256": "0" * 64})
        with self.assertRaises(SystemExit) as stop:
            scorer._refuse_if_changed([label])
        self.assertIn("not the files their labels were read from", str(stop.exception))
        self.assertIn(SAMPLE_HASH, str(stop.exception))

    def test_the_check_happens_before_the_provider_is_called(self):
        label = real_label(source={"url": "https://x.in/a.pdf", "sha256": "0" * 64})
        called = []
        with mock.patch.object(scorer, "_load_labels", lambda language: [label]), \
             mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_extract",
                               lambda *a, **k: called.append(1) or ({}, "gemini", False)):
            with self.assertRaises(SystemExit):
                scorer.score(None)
        self.assertEqual(called, [], "quota was spent on a run that could not count")

    def test_a_malformed_label_stops_the_run_before_the_provider_is_called(self):
        label = real_label(labelled_by="")
        called = []
        with mock.patch.object(scorer, "_load_labels", lambda language: [label]), \
             mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_extract",
                               lambda *a, **k: called.append(1) or ({}, "gemini", False)):
            with self.assertRaises(SystemExit) as stop:
                scorer.score(None)
        self.assertEqual(called, [])
        self.assertIn("labelled_by", str(stop.exception))


class DraftsAreNotPublished(unittest.TestCase):
    def _score(self, labels, **kwargs):
        extracted = {"mine_name": "Jharia Coal Mine", "district": "Dhanbad"}
        with mock.patch.object(scorer, "_load_labels", lambda language: labels), \
             mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_refuse_if_ocr_unavailable", lambda l: None), \
             mock.patch.object(scorer, "_provider_name", lambda: "gemini (m)"), \
             mock.patch.object(scorer, "_extract",
                               lambda *a, **k: (extracted, "gemini", False)), \
             mock.patch("builtins.print"):
            return scorer.score(None, **kwargs)

    def test_a_draft_is_not_scored_by_default(self):
        result = self._score([real_label(), real_label(status=DRAFT, _label_file="d.json",
                                                       document="samples/corpus/EN-02_Gevra_SECL_FY2024-25.pdf")])
        self.assertEqual(len(result["documents"]), 1)

    def test_drafts_can_be_scored_while_labelling(self):
        draft = real_label(status=DRAFT)
        # The hash is the sample's, so a draft pointing at it passes the pin.
        result = self._score([draft], include_drafts=True)
        self.assertEqual(len(result["documents"]), 1)

    def test_only_drafts_is_a_clear_stop_not_an_empty_score(self):
        with self.assertRaises(SystemExit) as stop:
            self._score([real_label(status=DRAFT)])
        self.assertIn("--include-drafts", str(stop.exception))

    def test_a_run_including_drafts_is_never_recorded_to_the_dashboard(self):
        self.assertIsNotNone(refuse_to_record(None, DASHBOARD_PATH, include_drafts=True))
        self.assertIsNone(refuse_to_record(None, Path("mine.json"), include_drafts=True))


class AFigureCannotQuietlyLeaveDocumentsOut(unittest.TestCase):
    def test_missing_documents_refuse_the_dashboard_and_say_where_to_get_them(self):
        missing = [real_label(document="evaluation/real/absent.pdf")]
        refusal = refuse_to_record(None, DASHBOARD_PATH, missing=missing)
        self.assertIsNotNone(refusal)
        self.assertIn("evaluation/real/absent.pdf", refusal)
        self.assertIn("https://example.gov.in/report.pdf", refusal)

    def test_a_private_run_may_still_skip_them(self):
        missing = [real_label(document="evaluation/real/absent.pdf")]
        self.assertIsNone(refuse_to_record(None, Path("mine.json"), missing=missing))

    def test_missing_documents_are_found(self):
        present = real_label()
        absent = real_label(document="evaluation/real/absent.pdf")
        self.assertEqual(scorer.missing_documents([present, absent]), [absent])


class RealAndSyntheticAreReportedApart(unittest.TestCase):
    def test_the_result_keeps_each_corpus_separate(self):
        synthetic = {"document": "samples/corpus/EN-02_Gevra_SECL_FY2024-25.pdf",
                     "language": "en", "expected": {"mine_name": "Gevra Opencast Mine"},
                     "_label_file": "EN-02.json"}
        real = real_label()
        answers = iter([
            ({"mine_name": "Gevra Opencast Mine"}, "gemini", False),
            ({"mine_name": "Jharia Coal Mine", "district": "Ranchi"}, "gemini", False),
        ])
        with mock.patch.object(scorer, "_load_labels", lambda language: [synthetic, real]), \
             mock.patch.object(scorer, "_refuse_if_mocked", lambda: None), \
             mock.patch.object(scorer, "_refuse_if_ocr_unavailable", lambda l: None), \
             mock.patch.object(scorer, "_provider_name", lambda: "gemini (m)"), \
             mock.patch.object(scorer, "_extract", lambda *a, **k: next(answers)), \
             mock.patch("builtins.print"):
            result = scorer.score(None)

        self.assertEqual(result["byCorpus"][SYNTHETIC]["accuracy"], 1.0)
        self.assertEqual(result["byCorpus"][REAL]["accuracy"], 0.5)
        self.assertEqual(result["byCorpus"][REAL]["documents"], 1)
        self.assertEqual({d["corpus"] for d in result["documents"]}, {SYNTHETIC, REAL})


class TheCheckSpendsNothing(unittest.TestCase):
    def test_it_passes_on_the_committed_labels(self):
        with mock.patch("builtins.print"):
            self.assertIsNone(scorer.check(None))

    def test_it_reports_a_bad_label_without_calling_anything(self):
        with mock.patch.object(scorer, "_load_labels", lambda language: [real_label(labelled_by="")]), \
             mock.patch.object(scorer, "_extract", side_effect=AssertionError("called")), \
             mock.patch("builtins.print"):
            self.assertIn("labelled_by", scorer.check(None))


class TheSkeletonForARealDocument(unittest.TestCase):
    def _write(self, pdf: Path, labels_dir: Path) -> dict:
        from evaluation import inspect_documents

        with mock.patch.object(inspect_documents, "LABELS_DIR", labels_dir), \
             mock.patch.object(inspect_documents, "REAL_DIR", pdf.parent):
            written = inspect_documents._write_label({"path": pdf, "pages": 2})
        return written, json.loads(written.read_text(encoding="utf-8"))

    def test_it_is_a_draft_pinned_to_the_file_with_blank_answers(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            pdf = folder / "report.pdf"
            pdf.write_bytes(SAMPLE.read_bytes())
            written, label = self._write(pdf, folder)

        self.assertEqual(written.name, "REAL-report.json")
        self.assertEqual(label["corpus"], REAL)
        self.assertEqual(label["status"], DRAFT)
        self.assertEqual(label["source"]["sha256"], SAMPLE_HASH)
        self.assertTrue(all(v == "" for v in label["expected"].values()))
        self.assertEqual(set(label["evidence"]), set(label["expected"]))

    def test_an_unfilled_skeleton_cannot_be_scored(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            pdf = folder / "report.pdf"
            pdf.write_bytes(SAMPLE.read_bytes())
            _, label = self._write(pdf, folder)
        self.assertTrue(label_problems(label))

    def test_it_never_overwrites_a_label_someone_has_filled_in(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            pdf = folder / "report.pdf"
            pdf.write_bytes(SAMPLE.read_bytes())
            existing = folder / "REAL-report.json"
            existing.write_text('{"hours": "of work"}', encoding="utf-8")
            with mock.patch("builtins.print"):
                self._write(pdf, folder)
            self.assertEqual(existing.read_text(encoding="utf-8"), '{"hours": "of work"}')


class TheDashboardLeadsWithRealDocuments(unittest.TestCase):
    """The card shows one headline. Once real documents are scored, it is theirs."""

    def _read(self, recorded: dict) -> dict:
        import extraction_quality

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "latest.json"
            path.write_text(json.dumps(recorded), encoding="utf-8")
            with mock.patch.object(extraction_quality, "MEASUREMENT_PATH", path):
                return extraction_quality.measured_accuracy()

    SYNTHETIC_PART = {"documents": 13, "fieldsScored": 124, "accuracy": 1.0,
                      "totals": {"exact": 95, "equivalent": 29}}
    REAL_PART = {"documents": 3, "fieldsScored": 20, "accuracy": 0.7,
                 "totals": {"exact": 10, "equivalent": 4, "missing": 4, "wrong": 2}}

    def test_real_figures_are_the_headline_and_synthetic_sits_beside_them(self):
        measured = self._read({
            "accuracy": 0.95, "fieldsScored": 144, "documents": [{}] * 16,
            "totals": {"exact": 105, "equivalent": 33, "missing": 4, "wrong": 2},
            "byCorpus": {"synthetic": self.SYNTHETIC_PART, "real": self.REAL_PART},
        })
        self.assertEqual(measured["corpus"], "real")
        # Not the blended 95%: the fixtures must not flatter the real figure.
        self.assertEqual(measured["accuracy"], 0.7)
        self.assertEqual(measured["documents"], 3)
        self.assertEqual(measured["wrong"], 2)
        self.assertEqual(measured["synthetic"],
                         {"accuracy": 1.0, "fieldsScored": 124, "documents": 13})

    def test_a_run_recorded_before_the_real_set_reads_as_it_always_did(self):
        measured = self._read({
            "accuracy": 1.0, "fieldsScored": 124, "documents": [{}] * 13,
            "totals": {"exact": 95, "equivalent": 29},
        })
        self.assertEqual(measured["corpus"], "synthetic")
        self.assertEqual(measured["accuracy"], 1.0)
        self.assertEqual(measured["documents"], 13)
        self.assertIsNone(measured["synthetic"])

    def test_a_synthetic_only_run_with_the_new_shape_is_still_synthetic(self):
        measured = self._read({
            "accuracy": 1.0, "fieldsScored": 124, "documents": [{}] * 13,
            "totals": {"exact": 95, "equivalent": 29},
            "byCorpus": {"synthetic": self.SYNTHETIC_PART},
        })
        self.assertEqual(measured["corpus"], "synthetic")

    def test_the_committed_measurement_still_reads(self):
        import extraction_quality

        measured = extraction_quality.measured_accuracy()
        if measured is None:
            self.skipTest("no committed measurement")
        self.assertIn(measured["corpus"], ("real", "synthetic"))


if __name__ == "__main__":
    unittest.main()
