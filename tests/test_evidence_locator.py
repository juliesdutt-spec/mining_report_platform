"""
Tests for evidence_locator.

The central guarantee is that a value is only cited when it genuinely appears
in the document's own text, on the page reported.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evidence_locator import locate_evidence


class FakeReport:
    def __init__(self, id=1, filename="report.pdf", pages=None, **fields):
        self.id = id
        self.filename = filename
        self.page_texts = pages
        self.extracted_data = fields.pop("extracted_data", {})
        for name in (
            "mine_name", "location", "mineral_type",
            "quantity_extracted", "extraction_method", "reserve_estimate",
        ):
            setattr(self, name, fields.get(name))


PAGES = [
    "ANNUAL MINING REPORT 2024-25. Operator: Coal India Limited.",
    "Production for the period totalled 1,25,000 MT of Iron Ore extracted "
    "by Underground methods at the Jharia field.",
    "Environmental compliance was maintained throughout the period.",
]


class LocateEvidenceTests(unittest.TestCase):
    def test_value_is_anchored_to_the_page_containing_it(self):
        report = FakeReport(pages=PAGES, quantity_extracted="1,25,000 MT")
        [snippet] = locate_evidence(report)
        self.assertEqual(snippet["pageNumber"], 2)  # 1-indexed for readers
        self.assertIn("1,25,000 MT", snippet["originalContext"])
        self.assertEqual(snippet["extractedValue"], "1,25,000 MT")

    def test_passage_quotes_the_document(self):
        report = FakeReport(pages=PAGES, mineral_type="Iron Ore")
        [snippet] = locate_evidence(report)
        self.assertIn("Iron Ore", snippet["originalContext"])

    def test_value_absent_from_the_document_is_not_cited(self):
        # The extractor can report a value the document never states; that must
        # not be dressed up as evidence.
        report = FakeReport(pages=PAGES, quantity_extracted="999 MT")
        self.assertEqual(locate_evidence(report), [])

    def test_formatting_variant_still_matches(self):
        report = FakeReport(pages=PAGES, quantity_extracted="125000 MT")
        found = locate_evidence(report)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["pageNumber"], 2)

    def test_no_pages_yields_no_evidence(self):
        # Reports ingested before page text was stored must not be guessed at.
        report = FakeReport(pages=None, quantity_extracted="1,25,000 MT")
        self.assertEqual(locate_evidence(report), [])
        self.assertEqual(locate_evidence(FakeReport(pages=[], mineral_type="Iron Ore")), [])

    def test_multiple_fields_each_produce_evidence(self):
        report = FakeReport(
            pages=PAGES,
            quantity_extracted="1,25,000 MT",
            mineral_type="Iron Ore",
            extraction_method="Underground",
        )
        found = locate_evidence(report)
        self.assertEqual(len(found), 3)
        self.assertTrue(all(f["pageNumber"] == 2 for f in found))

    def test_falls_back_to_extracted_data(self):
        report = FakeReport(pages=PAGES, extracted_data={"mineral_type": "Iron Ore"})
        self.assertEqual(len(locate_evidence(report)), 1)

    def test_snippet_ids_are_stable_and_scoped_to_the_report(self):
        report = FakeReport(id=7, pages=PAGES, mineral_type="Iron Ore")
        [snippet] = locate_evidence(report)
        self.assertEqual(snippet["id"], "ev-7-mineral_type")
        self.assertEqual(snippet["documentId"], 7)


if __name__ == "__main__":
    unittest.main()
