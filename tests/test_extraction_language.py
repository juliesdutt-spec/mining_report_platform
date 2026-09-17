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


if __name__ == "__main__":
    unittest.main()
