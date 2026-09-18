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
        # The prompt now lives in extraction_prompt, lifted out so the
        # show_reply diagnostic can send the identical one. Read the wrong
        # function and these assertions pass on a docstring that happens to
        # name a few of the same fields - which is exactly what they did for
        # one commit, and what they did again when the prompt moved.
        return inspect.getsource(ai_extractor.extraction_prompt)

    def test_the_detailed_extractor_still_sends_that_prompt(self):
        """The policy is worthless if the caller stops using the prompt."""
        caller = inspect.getsource(ai_extractor.extract_structured_data_detailed)
        self.assertIn("extraction_prompt(", caller)

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
        self.assertIn("did not answer in the requested format", result["note"])
        # The note names which kind of failure it was - the three need
        # different fixes and used to share one message.
        self.assertIn("no JSON object could be read", result["note"])
        self.assertIn("show_reply", result["note"])


class ValidJSONThatAnswersADifferentQuestionIsNotAnExtraction(unittest.TestCase):
    """
    Thirteen documents scored 0.0% - every field missing, no refusal.

    "The provider answered" was true. "The provider answered this question"
    was never checked. A weaker model wraps the object, renames the fields,
    or replies with something else entirely, and each of those reaches the
    scorer as a perfectly valid dict whose .get() calls all return None. The
    score table then reads exactly like a model that got everything wrong.
    """

    def test_our_own_schema_is_accepted(self):
        self.assertTrue(ai_extractor._looks_like_our_schema({"mine_name": "Jharia"}))

    def test_all_null_values_still_count_as_an_answer(self):
        # A thin document genuinely stating none of these comes back with the
        # keys present and null. That is a real extraction and must score.
        self.assertTrue(
            ai_extractor._looks_like_our_schema({"mine_name": None, "state": None})
        )

    def test_a_wrapped_or_renamed_object_is_rejected(self):
        self.assertFalse(ai_extractor._looks_like_our_schema({"report": {"mine_name": "J"}}))
        self.assertFalse(ai_extractor._looks_like_our_schema({"Mine Name": "Jharia"}))
        self.assertFalse(ai_extractor._looks_like_our_schema({"answer": "I cannot help"}))

    def test_an_off_schema_reply_is_reported_as_mock_not_scored_as_wrong(self):
        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "openrouter", "model": "m"}), \
             mock.patch.object(ai_providers, "complete",
                               return_value='{"report": {"mine_name": "Jharia"}}'):
            result = ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertEqual(result["source"], "mock")
        # And it points at the tool that shows what actually came back,
        # because the score table cannot distinguish this from a bad model.
        self.assertIn("show_reply", result["note"])

    def test_the_diagnostic_sends_the_same_prompt_extraction_does(self):
        # A debug tool that sends a near-enough prompt measures a
        # near-enough system.
        import evaluation.show_reply  # noqa: F401 - import must not explode

        prompt = ai_extractor.extraction_prompt("COAL MINE REPORT", "x.pdf")
        self.assertIn("COAL MINE REPORT", prompt)
        self.assertIn("mine_name", prompt)
        self.assertIn("Respond ONLY with valid JSON", prompt)


class TheReplyIsGivenRoomToFinish(unittest.TestCase):
    """
    Every document in production failed on gemini AND on openrouter, which
    is the shape of a bug in this code rather than in either model.

    2000 output tokens has to carry eighteen fields, four of them arrays,
    and a summary. On a reasoning model the thinking is billed against that
    same budget before a single output token is written, and a Hindi or
    Telugu summary costs three to four times the tokens per character. So
    the model thought, started writing, and was cut off mid-object - the
    truncated JSON parsed as nothing, and the document was recorded as an
    extraction that answered and got everything wrong.
    """

    def test_the_budget_is_far_above_what_the_fields_need(self):
        self.assertGreaterEqual(
            ai_extractor.EXTRACTION_MAX_TOKENS, 4000,
            "eighteen fields plus a non-Latin summary does not fit in less",
        )

    def test_the_budget_is_what_is_actually_sent(self):
        seen = {}

        def capture(prompt, max_tokens=1000):
            seen["max_tokens"] = max_tokens
            return '{"mine_name": "Jharia"}'

        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "gemini", "model": "m"}), \
             mock.patch.object(ai_providers, "complete", capture):
            ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertEqual(seen["max_tokens"], ai_extractor.EXTRACTION_MAX_TOKENS)

    def test_a_truncated_reply_says_so_rather_than_blaming_the_model(self):
        # "did not answer in the requested format" sent an evening into
        # swapping models when the fix was a number.
        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "gemini", "model": "m"}), \
             mock.patch.object(ai_providers, "complete",
                               return_value='{"mine_name": "Jharia", "loca'):
            result = ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertEqual(result["source"], "mock")
        self.assertIn("cut off mid-object", result["note"])
        self.assertIn("EXTRACTION_MAX_TOKENS", result["note"])

    def test_an_off_schema_reply_is_described_differently_from_a_truncated_one(self):
        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "gemini", "model": "m"}), \
             mock.patch.object(ai_providers, "complete",
                               return_value='{"report": {"mine_name": "J"}}'):
            result = ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertIn("none of the fields asked for", result["note"])
        self.assertNotIn("cut off", result["note"])

    def test_prose_with_no_json_is_described_differently_again(self):
        with mock.patch.object(ai_extractor, "USE_MOCK", False), \
             mock.patch.object(ai_providers, "describe",
                               return_value={"mode": "gemini", "model": "m"}), \
             mock.patch.object(ai_providers, "complete",
                               return_value="I cannot read that document."):
            result = ai_extractor.extract_structured_data_detailed("text", "t.pdf")

        self.assertIn("no JSON object could be read", result["note"])

    def test_truncation_is_detected_by_unbalanced_braces_only(self):
        self.assertTrue(ai_extractor._looks_truncated('{"a": 1, "b'))
        self.assertFalse(ai_extractor._looks_truncated('{"a": 1}'))
        self.assertFalse(ai_extractor._looks_truncated("no braces here"))


if __name__ == "__main__":
    unittest.main()
