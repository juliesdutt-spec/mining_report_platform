# -*- coding: utf-8 -*-
"""
The ceiling on the endpoints that cost money.

`/query` reaches a language model on every call, and the demo account's
password is printed on the sign-in page deliberately. Without a limit,
anybody who opens the site can spend the project's API budget indefinitely
without signing up for anything.
"""
import unittest

from rate_limit import LIMIT_FOR_DEMO, LIMIT_PER_ACCOUNT, RateLimiter, limit_for


class TheWindowSlides(unittest.TestCase):
    def setUp(self):
        self.limiter = RateLimiter(limit=3, window_seconds=3600)

    def test_calls_are_allowed_up_to_the_ceiling(self):
        for expected_remaining in (2, 1, 0):
            allowed, remaining, _ = self.limiter.check("someone")
            self.assertTrue(allowed)
            self.assertEqual(remaining, expected_remaining)

    def test_the_next_call_is_refused_with_a_wait(self):
        for _ in range(3):
            self.limiter.check("someone")
        allowed, remaining, retry_after = self.limiter.check("someone")
        self.assertFalse(allowed)
        self.assertEqual(remaining, 0)
        self.assertGreater(retry_after, 0, "a refusal must say when to come back")

    def test_a_refused_call_does_not_extend_the_window(self):
        # Otherwise hammering a closed door pushes the reopening further away,
        # and an impatient user locks themselves out for longer than the rule.
        for _ in range(3):
            self.limiter.check("someone")
        _, _, first = self.limiter.check("someone")
        for _ in range(20):
            self.limiter.check("someone")
        _, _, after_hammering = self.limiter.check("someone")
        self.assertLessEqual(after_hammering, first)

    def test_accounts_are_counted_separately(self):
        for _ in range(3):
            self.limiter.check("noisy")
        allowed, _, _ = self.limiter.check("quiet")
        self.assertTrue(allowed, "one account's usage must not spend another's")

    def test_an_explicit_ceiling_overrides_the_default(self):
        allowed, _, _ = self.limiter.check("tight", limit=1)
        self.assertTrue(allowed)
        allowed, _, _ = self.limiter.check("tight", limit=1)
        self.assertFalse(allowed)

    def test_reset_clears_history(self):
        for _ in range(3):
            self.limiter.check("someone")
        self.limiter.reset("someone")
        allowed, _, _ = self.limiter.check("someone")
        self.assertTrue(allowed)


class ThePublishedAccountIsHeldTighter(unittest.TestCase):
    def test_the_demo_gets_a_lower_ceiling_than_a_named_account(self):
        # Its password is public; a named account was granted deliberately.
        self.assertLess(LIMIT_FOR_DEMO, LIMIT_PER_ACCOUNT)

    def test_read_only_accounts_get_the_demo_ceiling(self):
        self.assertEqual(limit_for("demo", is_demo=True), LIMIT_FOR_DEMO)
        self.assertEqual(limit_for("auditor", is_demo=False), LIMIT_PER_ACCOUNT)


class ConfigurationDegradesSafely(unittest.TestCase):
    def test_an_unparseable_override_falls_back_instead_of_crashing(self):
        import importlib
        import os

        import rate_limit

        os.environ["QUERY_RATE_LIMIT"] = "not-a-number"
        try:
            reloaded = importlib.reload(rate_limit)
            self.assertGreater(reloaded.LIMIT_PER_ACCOUNT, 0)
        finally:
            del os.environ["QUERY_RATE_LIMIT"]
            importlib.reload(rate_limit)

    def test_a_nonsense_zero_limit_does_not_lock_everyone_out(self):
        import importlib
        import os

        import rate_limit

        os.environ["QUERY_RATE_LIMIT"] = "0"
        try:
            reloaded = importlib.reload(rate_limit)
            self.assertGreater(reloaded.LIMIT_PER_ACCOUNT, 0)
        finally:
            del os.environ["QUERY_RATE_LIMIT"]
            importlib.reload(rate_limit)


if __name__ == "__main__":
    unittest.main()
