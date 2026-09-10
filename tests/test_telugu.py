# -*- coding: utf-8 -*-
"""
Telugu through the pipeline.

The Hindi work generalised most of this - the tokeniser's combining-mark
ranges already covered Telugu, and Telugu numerals already parsed - but three
things were still Devanagari-only and failed silently for Telugu exactly as
they had for Hindi:

  - no Telugu face, so the text rendered as *nothing at all* in a PDF that
    still returned 200
  - `needs_shaping` and the word cloud's font picker both hard-coded the
    Devanagari block, so Telugu got neither shaping nor a font
  - "మొదటి త్రైమాసికం 2026: 45,000 టన్నులు" was read as 2026, and
    "త్రైమాసికం 2 2026: 52,000" as 2 - the quarter number
"""
import os
import unittest

import document_processor
import report_generator
import wordcloud_generator as wg
from validation_engine import _numeric, _period_of, _periods_differ

try:
    import pypdfium2
    CAN_READ_PDFS = True
except ImportError:  # a way to check our work, not a runtime dependency
    CAN_READ_PDFS = False


class Report:
    def __init__(self, report_date=None):
        self.report_date = report_date
        self.extracted_data = {}


class TheQuantityIsNotThePeriod(unittest.TestCase):
    def test_a_telugu_quarter_label_is_not_the_quantity(self):
        self.assertEqual(_numeric("మొదటి త్రైమాసికం 2026: 45,000 టన్నులు"), 45000.0)
        self.assertEqual(_numeric("రెండవ త్రైమాసికం 2026 - 52,000 టన్నులు"), 52000.0)

    def test_a_numbered_quarter_is_not_read_as_its_number(self):
        # This one returned 2.0 - the quarter, not the tonnage.
        self.assertEqual(_numeric("త్రైమాసికం 2 2026: 52,000 టన్నులు"), 52000.0)

    def test_a_telugu_financial_year_is_not_the_quantity(self):
        self.assertEqual(_numeric("ఆర్థిక సంవత్సరం 2026: 45,000 టన్నులు"), 45000.0)

    def test_a_telugu_month_is_not_the_quantity(self):
        self.assertEqual(_numeric("మార్చి 2026: 12,500 టన్నులు"), 12500.0)
        self.assertEqual(_numeric("డిసెంబర్ 2025 - 9,800 టన్నులు"), 9800.0)

    def test_telugu_numerals_are_read_as_numbers(self):
        self.assertEqual(_numeric("౪౫,౦౦౦ టన్నులు"), 45000.0)

    def test_a_value_that_is_only_a_period_states_no_quantity(self):
        self.assertIsNone(_numeric("మొదటి త్రైమాసికం 2026"))

    def test_english_and_hindi_parsing_are_unchanged(self):
        self.assertEqual(_numeric("Q1 2026: 45,000 t"), 45000.0)
        self.assertEqual(_numeric("पहली तिमाही 2026: 45,000 टन"), 45000.0)
        self.assertEqual(_numeric("500 MT over 2026-2030"), 500.0)


class TeluguReportingPeriods(unittest.TestCase):
    def test_ordinal_quarters(self):
        for label, quarter in (
            ("మొదటి త్రైమాసికం 2026", 1),
            ("రెండవ త్రైమాసికం 2026", 2),
            ("మూడవ త్రైమాసికం 2026", 3),
            ("నాల్గవ త్రైమాసికం 2026", 4),
        ):
            self.assertEqual(_period_of(Report(label)), (2026, quarter), label)

    def test_numbered_quarters_and_telugu_numerals(self):
        self.assertEqual(_period_of(Report("త్రైమాసికం 2 2026")), (2026, 2))
        self.assertEqual(_period_of(Report("రెండవ త్రైమాసికం ౨౦౨౬")), (2026, 2))

    def test_telugu_months_map_to_their_quarter(self):
        self.assertEqual(_period_of(Report("మార్చి 2026")), (2026, 1))
        self.assertEqual(_period_of(Report("డిసెంబర్ 2026")), (2026, 4))

    def test_a_financial_year_states_a_year_but_no_quarter(self):
        self.assertEqual(_period_of(Report("ఆర్థిక సంవత్సరం 2026")), (2026, None))

    def test_one_quarter_in_three_languages_is_one_period(self):
        # A corpus spanning Jharkhand and Telangana holds all three spellings
        # of the same quarter. Reading them as different periods would excuse
        # every conflict between them.
        telugu = Report("మొదటి త్రైమాసికం 2026")
        self.assertFalse(_periods_differ(telugu, Report("Q1 2026")))
        self.assertFalse(_periods_differ(telugu, Report("पहली तिमाही 2026")))

    def test_different_telugu_quarters_still_differ(self):
        self.assertTrue(
            _periods_differ(
                Report("మొదటి త్రైమాసికం 2026"), Report("రెండవ త్రైమాసికం 2026")
            )
        )

    def test_an_unknown_period_never_suppresses(self):
        self.assertFalse(_periods_differ(Report("మొదటి త్రైమాసికం 2026"), Report(None)))


class TeluguSurvivesTextProcessing(unittest.TestCase):
    def test_preprocessing_keeps_telugu_intact(self):
        cleaned = wg._preprocess_text("బొగ్గు గని ఉత్పత్తి")
        self.assertIn("బొగ్గు", cleaned)
        self.assertIn("ఉత్పత్తి", cleaned)

    def test_topics_are_extracted_from_telugu(self):
        topics = wg.extract_topics("బొగ్గు గని ఉత్పత్తి బొగ్గు గని బొగ్గు", top_n=3)
        self.assertEqual(topics[:2], ["బొగ్గు", "గని"])

    def test_telugu_function_words_do_not_dominate(self):
        text = "బొగ్గు మరియు ఉంది కోసం బొగ్గు మరియు ఉంది కోసం బొగ్గు"
        self.assertEqual(wg.extract_topics(text, top_n=3), ["బొగ్గు"])

    def test_every_language_shares_one_stopword_set(self):
        self.assertTrue(wg.TELUGU_STOPWORDS <= wg._stopwords())
        self.assertTrue(wg.HINDI_STOPWORDS <= wg._stopwords())
        self.assertTrue(wg.MINING_STOPWORDS <= wg._stopwords())


class TheWordCloudPicksAFontPerScript(unittest.TestCase):
    def test_telugu_selects_the_telugu_face(self):
        chosen = wg._font_for("బొగ్గు గని")
        self.assertIsNotNone(chosen)
        self.assertTrue(chosen.endswith("NotoSansTelugu-Regular.ttf"))

    def test_hindi_still_selects_the_devanagari_face(self):
        chosen = wg._font_for("कोयला खदान")
        self.assertTrue(chosen.endswith("NotoSansDevanagari-Regular.ttf"))

    def test_english_is_left_on_the_default_font(self):
        self.assertIsNone(wg._font_for("coal mine production"))

    def test_a_mixed_document_is_drawn_in_its_dominant_script(self):
        # WordCloud takes one font_path for the whole image, so a document
        # holding both scripts can only be drawn in one of them. Picking the
        # dominant one is the least-bad answer, not a correct one.
        mostly_telugu = "బొగ్గు గని ఉత్పత్తి నిల్వలు కोयला"
        mostly_hindi = "कोयला खदान उत्पादन भंडार బొగ్గు"
        self.assertTrue(wg._font_for(mostly_telugu).endswith("Telugu-Regular.ttf"))
        self.assertTrue(wg._font_for(mostly_hindi).endswith("Devanagari-Regular.ttf"))


class TheFontsCanDrawEveryScriptWeClaim(unittest.TestCase):
    def test_both_indic_faces_ship_with_their_licences(self):
        for filename in (
            "NotoSansTelugu-Regular.ttf", "NotoSansTelugu-Bold.ttf",
            "NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf",
            "OFL-NotoSansTelugu.txt", "OFL-NotoSansDevanagari.txt",
        ):
            self.assertTrue(
                os.path.exists(os.path.join(report_generator._FONT_DIR, filename)),
                filename,
            )

    def test_the_telugu_face_covers_a_telugu_report(self):
        from fontTools.ttLib import TTFont

        path = os.path.join(report_generator._FONT_DIR, "NotoSansTelugu-Regular.ttf")
        covered = set()
        for table in TTFont(path)["cmap"].tables:
            covered |= set(table.cmap.keys())

        sample = "సింగరేణి బొగ్గు గని త్రైమాసికం ఉత్పత్తి నిల్వలు ౪౫౦౦౦ Singareni 45,000 t"
        missing = [c for c in sample if c != " " and ord(c) not in covered]
        self.assertEqual(missing, [], f"font cannot draw {missing!r}")

    def test_shaping_is_requested_for_telugu_as_well_as_hindi(self):
        self.assertTrue(report_generator.needs_shaping("బొగ్గు గని"))
        self.assertTrue(report_generator.needs_shaping("कोयला खदान"))
        self.assertFalse(report_generator.needs_shaping("Singareni Colliery"))

    def test_every_declared_face_registers(self):
        # A face listed in INDIC_FACES but missing from disk would degrade
        # silently to blank text, which is the failure this all exists to fix.
        pdf = report_generator._UnicodePDF(shape_text=True)
        self.assertTrue(pdf._unicode_ok)
        for family in report_generator.INDIC_FACES:
            self.assertIn(family.lower(), {f.lower() for f in pdf.fonts})

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_a_telugu_report_renders_its_text(self):
        import io

        data = report_generator.generate_pdf_report({
            "id": 1, "filename": "te.pdf", "mine_name": "సింగరేణి బొగ్గు గని",
            "mineral_type": "బొగ్గు", "quantity_extracted": "౪౫,౦౦౦ టన్నులు",
            "extraction_status": "completed",
        })
        text = pypdfium2.PdfDocument(io.BytesIO(data))[0].get_textpage().get_text_range()
        # It used to come out blank: the glyphs simply were not in any font.
        self.assertIn("సింగరేణి", text)
        self.assertNotIn("{nb}", text)

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_one_report_can_hold_all_three_scripts(self):
        # fpdf2 resolves fallbacks per character, so unlike the word cloud a
        # PDF has no dominant-script compromise to make in what it *draws*.
        #
        # Asserted on drawn ink rather than on extracted text, because the
        # text layer is the one place the compromise shows: glyphs served by
        # a fallback face carry an imperfect ToUnicode map, so copying the
        # minority script out of the PDF can yield a stray character. It
        # renders correctly; it just does not always copy correctly.
        #
        # Measured on a bare document: the report template draws full-width
        # rules, which would make every bounding box the width of the page.
        import io

        from PIL import Image

        def ink(text):
            pdf = report_generator._UnicodePDF(shape_text=True, script="NotoTelugu")
            pdf.add_page()
            pdf.set_font("Helvetica", "", 30)
            pdf.cell(0, 20, text, new_x="LMARGIN", new_y="NEXT")
            page = pypdfium2.PdfDocument(io.BytesIO(bytes(pdf.output())))[0]
            grey = page.render(scale=3).to_pil().convert("L")
            box = Image.eval(grey, lambda px: 255 - px).getbbox()
            return (box[2] - box[0]) if box else 0

        latin_only = ink("Singareni")
        plus_telugu = ink("Singareni సింగరేణి")
        plus_both = ink("Singareni సింగరేణి सिंगरेनी")

        self.assertGreater(plus_telugu, latin_only, "Telugu was not drawn")
        self.assertGreater(plus_both, plus_telugu, "Hindi was not drawn beside Telugu")

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_the_leading_script_and_latin_copy_out_cleanly(self):
        import io

        data = report_generator.generate_pdf_report({
            "id": 3, "filename": "te.pdf", "mine_name": "సింగరేణి బొగ్గు గని",
            "quantity_extracted": "45,000 t", "extraction_status": "completed",
        })
        text = pypdfium2.PdfDocument(io.BytesIO(data))[0].get_textpage().get_text_range()
        self.assertIn("సింగరేణి", text)
        self.assertIn("45,000", text)


class SpacesSurviveBetweenIndicWords(unittest.TestCase):
    """
    fpdf2 splits text into one fragment per font, and with the shaping engine
    on it drops the space at a fragment boundary. With DejaVu primary and the
    Indic face merely a fallback, "బొగ్గును ఉత్పత్తి" rendered as one run-on
    word - measurably *narrower* than the same string with the space deleted.

    Nothing raised, and the text layer still reported roughly the right
    width, so only the drawn pixels give it away. Hence measuring ink rather
    than asserting on get_string_width, which was never wrong.
    """

    @staticmethod
    def _ink_width(text, script):
        import io

        from PIL import Image

        pdf = report_generator._UnicodePDF(shape_text=True, script=script)
        pdf.add_page()
        pdf.set_font("Helvetica", "", 40)
        pdf.cell(0, 25, text, new_x="LMARGIN", new_y="NEXT")
        page = pypdfium2.PdfDocument(io.BytesIO(bytes(pdf.output())))[0]
        image = page.render(scale=4).to_pil().convert("L")
        box = Image.eval(image, lambda p: 255 - p).getbbox()
        return box[2] - box[0]

    def _assert_space_drawn(self, first, second, script):
        spaced = self._ink_width(f"{first} {second}", script)
        joined = self._ink_width(f"{first}{second}", script)
        self.assertGreater(
            spaced - joined, 3,
            f"the space between {first!r} and {second!r} was not drawn",
        )

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_telugu_words_are_separated(self):
        self._assert_space_drawn("బొగ్గును", "ఉత్పత్తి", "NotoTelugu")
        self._assert_space_drawn("ఉత్పత్తి", "చేసింది", "NotoTelugu")

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_hindi_words_are_separated(self):
        self._assert_space_drawn("कोयला", "उत्पादन", "NotoDevanagari")

    @unittest.skipUnless(CAN_READ_PDFS, "pypdfium2 not installed")
    def test_english_is_unaffected(self):
        self._assert_space_drawn("coal", "mine", None)

    def test_an_indic_document_leads_with_its_own_face(self):
        # Which is the whole fix: the script has to be primary, not a
        # fallback, for the spaces around it to survive.
        self.assertEqual(report_generator.dominant_script("బొగ్గు గని"), "NotoTelugu")
        self.assertEqual(report_generator.dominant_script("कोयला खदान"), "NotoDevanagari")
        self.assertIsNone(report_generator.dominant_script("Singareni Colliery"))

    def test_the_majority_script_leads_a_mixed_document(self):
        self.assertEqual(
            report_generator.dominant_script("कोयला खदान उत्पादन भंडार", "బొగ్గు"),
            "NotoDevanagari",
        )

    def test_every_style_the_templates_ask_for_exists(self):
        # Noto ships no italic, and the footer asks for it. Before the
        # upright file was registered under the italic styles too, leading
        # with an Indic face raised "Undefined font: nototeluguI".
        for script in report_generator.INDIC_FACES:
            pdf = report_generator._UnicodePDF(shape_text=True, script=script)
            for style in ("", "B", "I", "BI"):
                pdf.set_font("Helvetica", style, 10)  # must not raise


class OCRKnowsAboutTelugu(unittest.TestCase):
    def test_telugu_is_requested_by_default(self):
        self.assertIn("tel", document_processor.OCR_LANGUAGES)
        self.assertIn("hin", document_processor.OCR_LANGUAGES)
        self.assertIn("eng", document_processor.OCR_LANGUAGES)


if __name__ == "__main__":
    unittest.main()
