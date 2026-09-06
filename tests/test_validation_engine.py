"""
Tests for validation_engine.

Uses unittest from the standard library so the suite needs no new dependency.
Run with:  python -m unittest discover -s tests -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validation_engine import detect_discrepancies, _values_conflict


class FakeReport:
    """Stands in for a MiningReport row; only the read fields matter."""

    def __init__(self, id, filename="doc.pdf", status="completed", **fields):
        self.id = id
        self.filename = filename
        self.status = status
        self.error_message = fields.pop("error_message", None)
        self.extracted_data = fields.pop("extracted_data", {})
        for name in (
            "mine_name", "location", "mineral_type",
            "quantity_extracted", "extraction_method", "reserve_estimate",
        ):
            setattr(self, name, fields.get(name))


def types_of(findings):
    return sorted({f["type"] for f in findings})


class ValuesConflictTests(unittest.TestCase):
    def test_identical_values_do_not_conflict(self):
        self.assertFalse(_values_conflict("52.50 MT", "52.50 MT"))

    def test_formatting_differences_do_not_conflict(self):
        # Same magnitude written differently is not a disagreement.
        self.assertFalse(_values_conflict("52.50 MT", "52.5 MT"))
        self.assertFalse(_values_conflict("1,25,000 MT", "125000 MT"))

    def test_rounding_differences_do_not_conflict(self):
        # Below the 1% threshold.
        self.assertFalse(_values_conflict("100.0 MT", "100.5 MT"))

    def test_material_difference_conflicts(self):
        self.assertTrue(_values_conflict("52.50 MT", "98.40 MT"))

    def test_differing_text_conflicts(self):
        self.assertTrue(_values_conflict("Opencast", "Underground"))

    def test_missing_value_is_not_a_conflict(self):
        self.assertFalse(_values_conflict(None, "52.50 MT"))
        self.assertFalse(_values_conflict("", "52.50 MT"))


class ConflictDetectionTests(unittest.TestCase):
    def test_same_mine_disagreeing_quantity_is_reported(self):
        findings = detect_discrepancies([
            FakeReport(1, "a.pdf", mine_name="Gevra", quantity_extracted="52.50 MT"),
            FakeReport(2, "b.pdf", mine_name="Gevra", quantity_extracted="98.40 MT"),
        ])
        conflicts = [f for f in findings if f["type"] == "conflict"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["fieldName"], "quantity_extracted")
        self.assertEqual(conflicts[0]["severity"], "high")

    def test_different_mines_are_not_compared(self):
        findings = detect_discrepancies([
            FakeReport(1, "a.pdf", mine_name="Gevra", quantity_extracted="52.50 MT"),
            FakeReport(2, "b.pdf", mine_name="Jayant", quantity_extracted="98.40 MT"),
        ])
        self.assertEqual([f for f in findings if f["type"] == "conflict"], [])

    def test_duplicates_do_not_multiply_conflicts(self):
        # Five reports state one value and one states another: that is a single
        # disagreement, not five.
        reports = [
            FakeReport(i, f"copy{i}.pdf", mine_name="Gevra", quantity_extracted="52.50 MT")
            for i in range(1, 6)
        ]
        reports.append(
            FakeReport(6, "revised.pdf", mine_name="Gevra", quantity_extracted="98.40 MT")
        )
        conflicts = [f for f in detect_discrepancies(reports) if f["type"] == "conflict"]
        self.assertEqual(len(conflicts), 1)

    def test_only_completed_reports_are_compared(self):
        findings = detect_discrepancies([
            FakeReport(1, "a.pdf", mine_name="Gevra", quantity_extracted="52.50 MT"),
            FakeReport(2, "b.pdf", status="processing",
                       mine_name="Gevra", quantity_extracted="98.40 MT"),
        ])
        self.assertEqual([f for f in findings if f["type"] == "conflict"], [])


class OtherFindingTests(unittest.TestCase):
    def test_same_filename_is_a_duplicate(self):
        findings = detect_discrepancies([
            FakeReport(1, "same.pdf", mine_name="Gevra", mineral_type="Coal",
                       quantity_extracted="1 MT", location="X"),
            FakeReport(2, "same.pdf", mine_name="Gevra", mineral_type="Coal",
                       quantity_extracted="1 MT", location="X"),
        ])
        self.assertIn("duplicate", types_of(findings))

    def test_missing_required_field_is_reported(self):
        findings = detect_discrepancies([
            FakeReport(1, "a.pdf", mine_name="Gevra", mineral_type=None,
                       quantity_extracted="1 MT", location="X"),
        ])
        missing = [f for f in findings if f["type"] == "missing_data"]
        self.assertEqual([f["fieldName"] for f in missing], ["mineral_type"])

    def test_failed_extraction_is_reported(self):
        findings = detect_discrepancies([
            FakeReport(1, "bad.pdf", status="error", error_message="boom"),
        ])
        errors = [f for f in findings if f["type"] == "extraction_error"]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["severity"], "high")

    def test_clean_corpus_yields_nothing(self):
        findings = detect_discrepancies([
            FakeReport(1, "a.pdf", mine_name="Gevra", mineral_type="Coal",
                       quantity_extracted="1 MT", location="X"),
        ])
        self.assertEqual(findings, [])

    def test_finding_ids_are_stable(self):
        reports = [
            FakeReport(1, "a.pdf", mine_name="Gevra", quantity_extracted="52.50 MT"),
            FakeReport(2, "b.pdf", mine_name="Gevra", quantity_extracted="98.40 MT"),
        ]
        first = [f["id"] for f in detect_discrepancies(reports)]
        second = [f["id"] for f in detect_discrepancies(reports)]
        # Resolutions are keyed by id, so recomputation must not change them.
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
