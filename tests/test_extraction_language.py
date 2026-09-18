# -*- coding: utf-8 -*-
"""
The extraction prompt's language policy.

The prompt said nothing about language, so what a Hindi or Telugu document
produced was undefined - and the fields the conflict detector compares could
come back as "coal" from one report and "బొగ్గు" from another, which the
engine then reported as a contradiction about the same mine.

The synonym table in validation_engine catches the cases it knows. This
closes the hole at the source instead of relying on that list being complete.
"""
import inspect
import unittest
from unittest import mock
import ai_providers

import ai_extractor
from validation_engine import COMPARABLE_FIELDS


class TheFieldsUsedForMatchingAreNormalised(unittest.TestCase):
    @property
    def prompt_source(self) -> str:
        # The prompt lives in the detailed form; the public one delegates to
        # it. Read the wrong one and these assertions pass on a docstring
        # that happens to name a few of the same fields - which is exactly
        # what they did for one commit.
        return inspect.getsource(ai_extractor.extract_structured_data_detailed)

    def test_the_public_extractor_cannot_bypass_the_policy(self):
        """Both callers must reach the same prompt, or one of them drifts."""
        wrapper = inspect.getsource(ai_extractor.extract_structured_data)
        self.assertIn("extract_structured_data_detailed", wrapper)

    def test_every_comparable_field_is_named_in_the_policy(self):
        # If a field is compared across documents but the prompt never says
        # which language to give it in, that field can raise phantom
        # conflicts on a bilingual corpus.
        policy = self.prompt_source
        for field, _label, _severity, _period in COMPARABLE_FIELDS:
            if field in ("quantity_extracted", "reserve_estimate"):
                continue  # numeric; compared by magnitude, not by wording
            self.assertIn(field, policy, f"{field} is compared but has no language rule")

    def test_the_fields_used_to_group_reports_are_named(self):
        # mine_name and location decide whether two reports are even about
        # the same pit. In different scripts they never group, and the
        # disagreement between them is never looked for.
        policy = self.prompt_source
        for field in ("mine_name", "location"):
            self.assertIn(field, policy)

    def test_narrative_fields_keep_the_source_language(self):
        policy = self.prompt_source
        self.assertIn("summary", policy)
        self.assertIn("key_findings", policy)

    def test_the_policy_explains_itself(self):
        # A future maintainer deleting this to shorten the prompt should be
        # able to see what it was holding up.
        self.assertIn("false conflict", self.prompt_source)


class TheSynonymTableStillCoversTheGap(unittest.TestCase):
    """
    The prompt is an instruction, not a guarantee - a model can ignore it.
    The validation-side equivalences remain the backstop, so both layers are
    checked rather than trusting either alone.
    """

    def test_the_same_mineral_across_scripts_does_not_conflict(self):
        from validation_engine import _values_conflict

        self.assertFalse(_values_conflict("coal", "कोयला"))
        self.assertFalse(_values_conflict("coal", "బొగ్గు"))

    def test_the_same_method_across_scripts_does_not_conflict(self):
        from validation_engine import _values_conflict

        self.assertFalse(_values_conflict("opencast", "खुली खदान"))
        self.assertFalse(_values_conflict("underground", "భూగర్భ"))


class AModelThatDoesNotSendJSONIsAFailureNotAnEmptyExtraction(unittest.TestCase):
    """
    The parser returned {"summary": text, "error": "..."} when it could not
    read a response - a perfectly valid dict with none of the fields in it.
    So the caller reported a successful extraction by the configured
    provider, the document stored nothing, and the scorer counted every
    field as "missing" and folded that into a published accuracy. A model
    that failed to answer was being measured as a model that answered badly.

    This matters more the smaller the model. Following "respond ONLY with
    valid JSON" is what a 3B-active model is worst at, and a reasoning model
    wraps its answer in prose by default.
    """

    def test_a_clean_object_parses(self):
        self.assertEqual(
            ai_extractor._parse_json_response('{"mine_name": "Jharia"}'),
            {"mine_name": "Jharia"},
        )

    def test_markdown_fences_and_preamble_are_tolerated(self):
        for text in (
            '```json\n{"mine_name": "Jharia"}\n```',
            'Sure! Here is the JSON:\n{"mine_name": "Jharia"}',
            '{"mine_name": "Jharia"}\nLet me know if you need more!',
        ):
            self.assertEqual(
                ai_extractor._parse_json_response(text), {"mine_name": "Jharia"}, text
            )

    def test_a_reasoning_block_containing_braces_does_not_break_it(self):
        # The case that actually failed: one span from a brace inside the
        # thinking to the closing brace of the answer parses as nothing.
        text = '<think>The mine is {maybe} Jharia</think>\n{"mine_name": "Jharia"}'
        self.assertEqual(ai_extractor._parse_json_response(text), {"mine_name": "Jharia"})

    def test_a_brace_inside_a_string_value_does_not_end_the_object(self):
        text = '{"mine_name": "Jharia", "note": "a } brace"}'
        self.assertEqual(
            ai_extractor._parse_json_response(text),
            {"mine_name": "Jharia", "note": "a } brace"},
        )

    def test_the_richest_object_wins_when_a_model_emits_several(self):
        text = '{"ok": 1}\n{"mine_name": "Jharia", "state": "Jharkhand"}'
        self.assertEqual(
            ai_extractor._parse_json_response(text),
            {"mine_name": "Jharia", "state": "Jharkhand"},
        )

    def test_truncated_or_prose_only_returns_none_rather_than_a_shell(self):
        self.assertIsNone(ai_extractor._parse_json_response('{"mine_name": "Jhar'))
        self.assertIsNone(ai_extractor._parse_json_response("I could not read that."))

    def test_an_unparseable_reply_is_reported_as_mock_so_the_scorer_refuses(self):
        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "openrouter", "model": "m"}), \
             mock.patch.object(ai_providers, "complete", return_value="no json here"):
            result = ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertEqual(result["source"], "mock",
                         "an unreadable reply must not count as a real extraction")
        self.assertIn("valid JSON", result["note"])
        # And the note should point somewhere useful on a small model.
        self.assertIn("OPENROUTER_MODEL", result["note"])


if __name__ == "__main__":
    unittest.main()
