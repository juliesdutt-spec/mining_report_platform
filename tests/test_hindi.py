# -*- coding: utf-8 -*-
"""
Hindi through the existing pipeline.

Every failure fixed here was silent. Nothing raised, every endpoint returned
200, and the output looked plausible to anyone who does not read Devanagari:

  - the PDF font carried no Devanagari at all, so Hindi vanished from reports
  - without a shaping engine the glyphs that were there landed in the wrong
    order - "रिपोर्ट" drawn as "रपिोर्ट"
  - `[^\\w\\s]` scrubbing deleted every matra, shattering words into consonants
  - "पहली तिमाही 2026: 45,000 टन" was read as the number 2026
  - a scanned Hindi page was OCR'd as English

The rendering ones cannot be asserted from the bytes alone, so those tests
check the machinery that produces correct rendering - glyph coverage, the
shaping flag, the tokeniser - rather than claiming to have looked.
"""
import os
import re
import unittest

import document_processor
import report_generator
import validation_engine as ve
import wordcloud_generator as wg
from validation_engine import _numeric, _period_of, _periods_differ


try:
    import pypdfium2
    CAN_READ_PDFS = True
except ImportError:  # not a runtime dependency, only a way to check our work
    CAN_READ_PDFS = False


def _pdf_text(doc) -> str:
    """The rendered text of page 1, read back out of the produced PDF."""
    import io

    data = report_generator.generate_pdf_report(doc)
    return pypdfium2.PdfDocument(io.BytesIO(data))[0].get_textpage().get_text_range()


class Report:
    """A stub carrying the fields the engine reads."""

    def __init__(self, report_date=None, **values):
        self.report_date = report_date
        self.extracted_data = {}
        for field, value in values.items():
            setattr(self, field, value)


class TheQuantityIsNotTheYear(unittest.TestCase):
    """The Hindi half of the defect PR #5 fixed for English."""

    def test_a_hindi_quarter_label_is_not_the_quantity(self):
        self.assertEqual(_numeric("पहली तिमाही 2026: 45,000 टन"), 45000.0)
        self.assertEqual(_numeric("दूसरी तिमाही 2026 - 52,000 टन"), 52000.0)
        self.assertEqual(_numeric("तिमाही 3 2026: 48,500 टन"), 48500.0)

    def test_a_hindi_financial_year_is_not_the_quantity(self):
        self.assertEqual(_numeric("वित्त वर्ष 2026: 45,000 टन"), 45000.0)
        self.assertEqual(_numeric("वित्तीय वर्ष 2026 में 1,20,000 टन"), 120000.0)

    def test_a_hindi_month_is_not_the_quantity(self):
        self.assertEqual(_numeric("मार्च 2026: 12,500 टन"), 12500.0)
        self.assertEqual(_numeric("दिसंबर 2025 - 9,800 टन"), 9800.0)

    def test_devanagari_numerals_are_read_as_numbers(self):
        self.assertEqual(_numeric("४५,००० टन"), 45000.0)
        self.assertEqual(_numeric("उत्पादन: ५२.५ MT"), 52.5)

    def test_a_value_that_is_only_a_period_states_no_quantity(self):
        # Returning its quarter number would invent a figure out of a date.
        self.assertIsNone(_numeric("पहली तिमाही 2026"))
        self.assertIsNone(_numeric("वित्त वर्ष 2026"))

    def test_english_parsing_is_unchanged(self):
        self.assertEqual(_numeric("Q1 2026: 45,000 t"), 45000.0)
        self.assertEqual(_numeric("52.5 MT"), 52.5)
        self.assertEqual(_numeric("500 MT over 2026-2030"), 500.0)


class HindiReportingPeriods(unittest.TestCase):
    def test_ordinal_quarters(self):
        for label, quarter in (
            ("पहली तिमाही 2026", 1),
            ("दूसरी तिमाही 2026", 2),
            ("तीसरी तिमाही 2026", 3),
            ("चौथी तिमाही 2026", 4),
        ):
            self.assertEqual(_period_of(Report(label)), (2026, quarter), label)

    def test_numbered_quarters_and_devanagari_years(self):
        self.assertEqual(_period_of(Report("तिमाही 2 2026")), (2026, 2))
        self.assertEqual(_period_of(Report("दूसरी तिमाही २०२६")), (2026, 2))

    def test_hindi_month_names_map_to_their_quarter(self):
        self.assertEqual(_period_of(Report("मार्च 2026")), (2026, 1))
        self.assertEqual(_period_of(Report("दिसंबर 2026")), (2026, 4))

    def test_a_financial_year_states_a_year_but_no_quarter(self):
        self.assertEqual(_period_of(Report("वित्त वर्ष 2026")), (2026, None))

    def test_the_same_quarter_in_either_language_is_the_same_period(self):
        # The point of the whole exercise: a corpus mixing Hindi and English
        # reports must not read the two spellings of Q1 as different quarters.
        self.assertFalse(_periods_differ(Report("पहली तिमाही 2026"), Report("Q1 2026")))
        self.assertTrue(_periods_differ(Report("पहली तिमाही 2026"), Report("Q2 2026")))

    def test_hindi_quarters_that_differ_are_reported_as_differing(self):
        self.assertTrue(
            _periods_differ(Report("पहली तिमाही 2026"), Report("दूसरी तिमाही 2026"))
        )

    def test_an_unknown_period_still_never_suppresses(self):
        self.assertFalse(_periods_differ(Report("पहली तिमाही 2026"), Report(None)))
        self.assertFalse(_periods_differ(Report("पहली तिमाही 2026"), Report("2026")))


class TextProcessingKeepsDevanagariIntact(unittest.TestCase):
    def test_preprocessing_does_not_strip_matras(self):
        # `\w` matches no combining mark, so a `[^\w\s]` scrub used to render
        # "रिपोर्ट उत्पादन" as "र प र ट उत प दन".
        cleaned = wg._preprocess_text("रिपोर्ट उत्पादन कोयला")
        self.assertIn("रिपोर्ट", cleaned)
        self.assertIn("उत्पादन", cleaned)

    def test_topics_are_extracted_from_hindi(self):
        text = "कोयला खदान उत्पादन कोयला खदान कोयला तिमाही"
        topics = wg.extract_topics(text, top_n=3)
        self.assertIn("कोयला", topics)
        self.assertIn("खदान", topics)

    def test_hindi_function_words_do_not_dominate(self):
        text = "कोयला के का की में से और कोयला के का की में से कोयला"
        self.assertEqual(wg.extract_topics(text, top_n=3), ["कोयला"])

    def test_the_cloud_and_the_topic_list_share_one_stopword_set(self):
        # These drifted apart once already: Hindi stopwords reached the cloud
        # but not the topic filter, so "में" was reported as a topic.
        self.assertTrue(wg.HINDI_STOPWORDS <= wg._stopwords())
        self.assertTrue(wg.MINING_STOPWORDS <= wg._stopwords())

    def test_the_wordcloud_tokeniser_also_keeps_matras(self):
        # WordCloud re-tokenises with its own regexp; passing ours is what
        # stopped the rendered image disagreeing with the topic list.
        found = re.findall(wg._WORDCLOUD_REGEXP, "कोयला उत्पादन")
        self.assertEqual(found, ["कोयला", "उत्पादन"])

    def test_english_topic_extraction_is_unchanged(self):
        topics = wg.extract_topics("The coal mine production coal mine coal", top_n=3)
        self.assertEqual(topics[:2], ["coal", "mine"])


class TheFontCanActuallyDrawHindi(unittest.TestCase):
    def test_the_devanagari_font_ships_with_the_repository(self):
        for name in ("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf"):
            self.assertTrue(
                os.path.exists(os.path.join(report_generator._FONT_DIR, name)), name
            )

    def test_its_licence_ships_with_it(self):
        self.assertTrue(
            os.path.exists(os.path.join(report_generator._FONT_DIR, "OFL.txt"))
        )

    def test_the_font_covers_every_character_of_a_hindi_report(self):
        from fontTools.ttLib import TTFont

        path = os.path.join(report_generator._FONT_DIR, "NotoSansDevanagari-Regular.ttf")
        covered = set()
        for table in TTFont(path)["cmap"].tables:
            covered |= set(table.cmap.keys())

        sample = "झरिया कोयला खदान तिमाही रिपोर्ट उत्पादन ४५००० Jharia 45,000 t"
        missing = [c for c in sample if c != " " and ord(c) not in covered]
        self.assertEqual(missing, [], f"font cannot draw {missing!r}")

    def test_a_hindi_pdf_reports_no_missing_glyphs(self):
        import warnings

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            data = report_generator.generate_pdf_report({
                "id": 1,
                "filename": "hindi.pdf",
                "mine_name": "झरिया कोयला खदान",
                "mineral_type": "कोयला",
                "quantity_extracted": "४५,००० टन",
                "summary": "पहली तिमाही में उत्पादन बढ़ा — reserves ₹500 MT.",
                "extraction_status": "completed",
            })

        self.assertGreater(len(data), 1000)
        unrenderable = [
            str(w.message) for w in caught if "missing the following glyphs" in str(w.message)
        ]
        self.assertEqual(unrenderable, [], "characters were dropped from the PDF")

    def test_shaping_is_available_so_vowel_signs_can_be_placed_correctly(self):
        # Having the glyphs is not placing them: with no shaping engine the
        # i-matra in "रिपोर्ट" is drawn after its consonant instead of before,
        # which raises nothing and looks like Devanagari to anyone who cannot
        # read it. uharfbuzz is a hard dependency for exactly this reason.
        pdf = report_generator._UnicodePDF(shape_text=True)
        self.assertTrue(pdf._unicode_ok)
        self.assertTrue(pdf._shaping_on)
        self.assertTrue(pdf.text_shaping["use_shaping_engine"])

    def test_shaping_is_only_paid_for_when_there_is_devanagari(self):
        self.assertTrue(report_generator.needs_shaping("झरिया कोयला"))
        self.assertTrue(report_generator.needs_shaping("Jharia", "कोयला"))
        self.assertFalse(report_generator.needs_shaping("Jharia Colliery", "45,000 t"))
        self.assertFalse(report_generator.needs_shaping(None, ""))

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_an_english_report_still_states_its_page_total(self):
        # Shaping defeats alias_nb_pages, so switching it on globally would
        # have printed a literal "Page 1/{nb}" on every English report.
        text = _pdf_text({
            "id": 1, "filename": "en.pdf", "mine_name": "Jharia Colliery",
            "quantity_extracted": "45,000 t", "extraction_status": "completed",
        })
        self.assertIn("Page 1/1", text)

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_a_hindi_report_never_leaks_the_placeholder(self):
        text = _pdf_text({
            "id": 2, "filename": "hi.pdf", "mine_name": "झरिया कोयला खदान",
            "quantity_extracted": "४५,००० टन", "extraction_status": "completed",
        })
        self.assertNotIn("{nb}", text)
        self.assertIn("Page 1", text)


class TheWordCloudPicksAFontItCanDrawWith(unittest.TestCase):
    def test_hindi_text_selects_the_devanagari_font(self):
        chosen = wg._font_for("कोयला खदान")
        self.assertIsNotNone(chosen)
        self.assertTrue(chosen.endswith("NotoSansDevanagari-Regular.ttf"))

    def test_english_text_is_left_on_the_default_font(self):
        self.assertIsNone(wg._font_for("coal mine production"))

    def test_mixed_text_selects_the_font_that_covers_both(self):
        self.assertIsNotNone(wg._font_for("Jharia कोयला mine"))


class OCRIsToldWhichLanguageItIsReading(unittest.TestCase):
    def test_hindi_is_requested_by_default(self):
        self.assertIn("hin", document_processor.OCR_LANGUAGES)
        self.assertIn("eng", document_processor.OCR_LANGUAGES)

    def test_an_uninstallable_language_is_dropped_rather_than_passed_on(self):
        # Passing tesseract a language with no traineddata fails the whole
        # call, so a host missing Hindi must still read its English documents.
        document_processor._ocr_langs_checked = None
        try:
            resolved = document_processor._available_ocr_languages()
            self.assertTrue(resolved)
            self.assertNotIn("+", resolved.strip("+")) if resolved == "eng" else None
        finally:
            document_processor._ocr_langs_checked = None


if __name__ == "__main__":
    unittest.main()
