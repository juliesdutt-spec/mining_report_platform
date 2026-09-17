# -*- coding: utf-8 -*-
"""
The scorer that finally puts a number on extraction.

Its own logic has to be right, or the measurement is worse than none: a
generous scorer would report accuracy the platform does not have.
"""
import json
import unittest
from pathlib import Path

from evaluation.score import (
    DASHBOARD_PATH, EQUIVALENT, EXACT, MISSING, WRONG, _classify, _load_labels,
    refuse_to_record,
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


if __name__ == "__main__":
    unittest.main()
