# -*- coding: utf-8 -*-
"""
Whether the conflict detector can be trusted on ordinary filings.

Two defects, both from the same naive normalisation, and they fail in
opposite directions:

  false alarms - text was compared by casefolded equality, so "Open Cast"
  against "opencast" was a high-severity conflict. A detector that cries
  wolf on spelling gets switched off.

  silence - reports were grouped by the raw mine name, so "Jharia Coal Mine"
  and "Jharia Coal-Mine" landed in different groups and their contradicting
  figures were never compared at all. That one is quieter and worse.

The suppression rules only fire on positive evidence that two values say the
same thing. Everything unrecognised still conflicts, because missing a real
disagreement is the costlier mistake.
"""
import unittest

from validation_engine import _mine_key, _values_conflict, detect_discrepancies


class Report:
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


def named(name):
    return Report(mine_name=name)


class SpellingIsNotDisagreement(unittest.TestCase):
    def test_punctuation_and_spacing(self):
        for a, b in (("Open Cast", "opencast"), ("Opencast", "Open-cast"),
                     ("open  cast", "Open Cast"), ("sub-surface", "subsurface")):
            self.assertFalse(_values_conflict(a, b), f"{a!r} vs {b!r}")

    def test_known_synonyms(self):
        self.assertFalse(_values_conflict("open pit", "opencast"))
        self.assertFalse(_values_conflict("surface mining", "Open Cast"))
        self.assertFalse(_values_conflict("Underground", "sub-surface"))

    def test_the_same_mineral_in_another_language(self):
        # One report filed in Hindi and another in English about the same mine
        # is the normal case for a national corpus, not an edge case.
        self.assertFalse(_values_conflict("coal", "कोयला"))
        self.assertFalse(_values_conflict("coal", "బొగ్గు"))
        self.assertFalse(_values_conflict("कोयला", "బొగ్గు"))

    def test_a_qualifier_is_not_a_contradiction(self):
        self.assertFalse(_values_conflict("Coal", "Bituminous Coal"))
        self.assertFalse(
            _values_conflict("Singareni Collieries", "Singareni Collieries Company Ltd")
        )

    def test_numeric_formatting(self):
        self.assertFalse(_values_conflict("45,000 t", "45000 tonnes"))


class RealDisagreementsStillReport(unittest.TestCase):
    """The suppression must not have bought quiet at the cost of the feature."""

    def test_different_minerals(self):
        self.assertTrue(_values_conflict("coal", "iron ore"))
        self.assertTrue(_values_conflict("कोयला", "लौह अयस्क"))
        self.assertTrue(_values_conflict("limestone", "bauxite"))

    def test_different_methods(self):
        self.assertTrue(_values_conflict("opencast", "underground"))
        self.assertTrue(_values_conflict("open pit", "भूमिगत"))

    def test_different_quantities(self):
        self.assertTrue(_values_conflict("45,000 t", "52,000 t"))

    def test_different_mines(self):
        self.assertTrue(_values_conflict("Jharia Colliery", "Raniganj Colliery"))

    def test_one_known_term_against_an_unknown_string_is_not_agreement(self):
        # Recognising only one side proves nothing, so it must still conflict.
        self.assertTrue(_values_conflict("coal", "something else entirely"))


class OneMineIsOneGroup(unittest.TestCase):
    def test_punctuation_and_case_do_not_split_a_mine(self):
        for a, b in (("Jharia Coal Mine", "Jharia Coal-Mine"),
                     ("Jharia Colliery", "Jharia colliery"),
                     ("Singareni Collieries", "Singareni Collieries Company Ltd")):
            self.assertEqual(_mine_key(named(a)), _mine_key(named(b)), f"{a!r} vs {b!r}")

    def test_word_order_does_not_split_a_mine(self):
        self.assertEqual(
            _mine_key(named("Jharia Colliery")), _mine_key(named("Colliery, Jharia"))
        )

    def test_distinct_mines_stay_distinct(self):
        # Over-merging is the dangerous direction: it compares figures from
        # unrelated pits and manufactures conflicts out of nothing.
        for a, b in (("Jharia Colliery", "Raniganj Colliery"),
                     ("Singareni Block A", "Singareni Block B"),
                     ("Jharia Coal Mine", "Jharia Iron Mine"),
                     ("North Mine", "South Mine")):
            self.assertNotEqual(_mine_key(named(a)), _mine_key(named(b)), f"{a!r} vs {b!r}")

    def test_a_name_of_only_generic_words_is_not_collapsed(self):
        # Stripping every word would key these all to "", grouping unrelated
        # reports together.
        self.assertIsNotNone(_mine_key(named("The Mining Company")))


class EndToEnd(unittest.TestCase):
    def test_a_spelling_variant_no_longer_raises_a_finding(self):
        reports = [
            Report(mine_name="Jharia Colliery", extraction_method="Open Cast",
                   mineral_type="Coal", report_date="Q1 2026"),
            Report(mine_name="Jharia Colliery", extraction_method="opencast",
                   mineral_type="coal", report_date="Q2 2026"),
        ]
        conflicts = [f for f in detect_discrepancies(reports) if f["type"] == "conflict"]
        self.assertEqual(conflicts, [], "spelling variance was reported as a conflict")

    def test_a_real_disagreement_is_still_found_across_a_name_variant(self):
        # The grouping fix earns its keep here: before it, these two sat in
        # different groups and the contradiction was never looked for.
        reports = [
            Report(mine_name="Jharia Coal Mine", mineral_type="Coal",
                   report_date="Q1 2026"),
            Report(mine_name="Jharia Coal-Mine", mineral_type="Iron Ore",
                   report_date="Q1 2026"),
        ]
        conflicts = [f for f in detect_discrepancies(reports) if f["type"] == "conflict"]
        self.assertTrue(conflicts, "a genuine mineral conflict went unreported")
        self.assertEqual(conflicts[0]["fieldName"], "mineral_type")


if __name__ == "__main__":
    unittest.main()
