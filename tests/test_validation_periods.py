"""
Two accuracy defects in the conflict detector, both found by probing it with
the shapes real extracted values take.

A mine that produced 45,000 t in Q1 and 52,000 t in Q2 is not contradicting
itself, but reports were grouped by mine alone, so the most ordinary pair of
documents a corpus can hold was reported as a high-severity conflict.

And "Q1 2026: 45,000 t" was read as the number 1 - the first digit in the
string belongs to the quarter label - so two such values compared as 1 against
1, agreed, and the real disagreement between 45,000 and 46,000 went unreported.
"""
import unittest

from validation_engine import _numeric, _periods_differ, detect_discrepancies


class Report:
    """A stub carrying the fields the engine reads."""

    FIELDS = ("mine_name", "location", "mineral_type", "quantity_extracted",
              "extraction_method", "company_name", "report_date", "reserve_estimate")
    _next_id = 0

    def __init__(self, **values):
        Report._next_id += 1
        self.id = Report._next_id
        self.filename = values.pop("filename", f"report-{self.id}.pdf")
        self.status = "completed"
        self.extracted_data = {}
        for field in self.FIELDS:
            setattr(self, field, values.get(field))


def conflicts_on(reports, field):
    return [
        finding for finding in detect_discrepancies(reports)
        if finding["type"] == "conflict" and finding["fieldName"] == field
    ]


MINE = "Jharia Colliery"


class QuantityIsReadPastThePeriodLabel(unittest.TestCase):
    def test_a_quarter_label_is_not_the_quantity(self):
        self.assertEqual(_numeric("Q1 2026: 45,000 t"), 45000.0)
        self.assertEqual(_numeric("Q4 2025 - 46,000 t"), 46000.0)
        self.assertEqual(_numeric("FY2026: 1,20,000 tonnes"), 120000.0)
        self.assertEqual(_numeric("March 2026: 3,200 t"), 3200.0)
        self.assertEqual(_numeric("H1 2026 output 9,500"), 9500.0)

    def test_ordinary_values_are_unchanged(self):
        self.assertEqual(_numeric("52.5 MT"), 52.5)
        self.assertEqual(_numeric("52.50 MT"), 52.5)
        self.assertEqual(_numeric("52,500 t"), 52500.0)
        self.assertEqual(_numeric("2026"), 2026.0)

    def test_a_year_range_is_not_mistaken_for_the_figure(self):
        # "take the largest number" would answer 2030 here.
        self.assertEqual(_numeric("500 MT over 2026-2030"), 500.0)

    def test_a_value_that_is_only_a_period_states_no_quantity(self):
        self.assertIsNone(_numeric("Q1"))
        self.assertIsNone(_numeric("no digits here"))
        self.assertIsNone(_numeric(""))

    def test_the_disagreement_that_used_to_be_missed_is_reported(self):
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="Q1 2026: 45,000 t", report_date="Q1 2026"),
                Report(mine_name=MINE, quantity_extracted="Q1 2026: 46,000 t", report_date="Q1 2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(len(found), 1)


class ProductionIsComparedWithinAPeriod(unittest.TestCase):
    def test_different_quarters_are_not_a_conflict(self):
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="Q1 2026"),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="Q2 2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(found, [])

    def test_the_same_quarter_still_is(self):
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="Q1 2026"),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="Q1 2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(len(found), 1)

    def test_iso_dates_resolve_to_quarters(self):
        same_quarter = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="2026-01-15"),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="2026-03-02"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(len(same_quarter), 1, "January and March are both Q1")

        across_quarters = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="2026-01-15"),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="2026-07-02"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(across_quarters, [])

    def test_different_years_are_different_periods(self):
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="2025"),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(found, [])

    def test_an_unknown_period_never_suppresses_a_conflict(self):
        # Suppressing on a guess would hide the conflicts this engine exists to
        # find, and a missing date is the common case for a poor extraction.
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date=None),
                Report(mine_name=MINE, quantity_extracted="52,000 t", report_date="Q2 2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(len(found), 1)

    def test_a_coarser_period_does_not_count_as_different(self):
        # "2026" and "Q1 2026" agree on everything both of them state.
        a = Report(mine_name=MINE, report_date="2026")
        b = Report(mine_name=MINE, report_date="Q1 2026")
        self.assertFalse(_periods_differ(a, b))

    def test_fields_that_do_not_vary_by_period_still_conflict(self):
        # A mine does not become a different mineral in a different quarter.
        found = conflicts_on(
            [
                Report(mine_name=MINE, mineral_type="Coal", report_date="Q1 2026"),
                Report(mine_name=MINE, mineral_type="Iron Ore", report_date="Q3 2026"),
            ],
            "mineral_type",
        )
        self.assertEqual(len(found), 1)

    def test_a_same_period_disagreement_survives_a_value_shared_across_periods(self):
        # The subtle one. Comparing a single representative per value would let
        # whichever document came first decide the whole position, dropping a
        # genuine Q1 disagreement because the two chosen documents happened to
        # sit in different quarters.
        found = conflicts_on(
            [
                Report(mine_name=MINE, quantity_extracted="46,000 t", report_date="Q1 2026"),
                Report(mine_name=MINE, quantity_extracted="46,000 t", report_date="Q2 2026"),
                Report(mine_name=MINE, quantity_extracted="45,000 t", report_date="Q1 2026"),
            ],
            "quantity_extracted",
        )
        self.assertEqual(len(found), 1)


if __name__ == "__main__":
    unittest.main()
