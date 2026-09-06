"""
How ALLOWED_ORIGINS and ALLOWED_ORIGIN_REGEX decide who may call the API.

Worth pinning because both failure directions are silent. Too narrow and the
deployed frontend stops working with no server-side error - the browser
refuses the response. Too wide and any website can drive upload and delete,
since no endpoint asks who is calling.

Each case reloads the module: the middleware is configured once at import
from the environment as it stood then.
"""
import importlib
import os
import sys
import unittest

from fastapi.testclient import TestClient

CORS_VARS = ("ALLOWED_ORIGINS", "ALLOWED_ORIGIN_REGEX")


def load_api(**env):
    """Import backend.api with exactly the CORS environment given."""
    saved = {k: os.environ.get(k) for k in CORS_VARS}
    for key in CORS_VARS:
        os.environ.pop(key, None)
    os.environ.update({k: v for k, v in env.items() if v is not None})
    try:
        for name in [m for m in list(sys.modules) if m.startswith("backend.api")]:
            del sys.modules[name]
        return importlib.import_module("backend.api")
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def allowed(module, origin):
    """True when the browser would let a page on `origin` read the response."""
    res = TestClient(module.app).get("/health", headers={"Origin": origin})
    header = res.headers.get("access-control-allow-origin")
    return header in (origin, "*")


class CorsConfiguration(unittest.TestCase):
    def test_unset_allows_everyone(self):
        # The documented default: local development needs no configuration.
        api = load_api()
        self.assertEqual(api.ALLOWED_ORIGINS, ["*"])
        self.assertTrue(allowed(api, "https://anything.example.com"))

    def test_explicit_list_admits_only_those_sites(self):
        api = load_api(ALLOWED_ORIGINS="https://app.example.com,http://localhost:5173")
        self.assertTrue(allowed(api, "https://app.example.com"))
        self.assertTrue(allowed(api, "http://localhost:5173"))
        self.assertFalse(allowed(api, "https://evil.example.com"))

    def test_regex_admits_preview_deployments(self):
        # The reason the regex exists: every Vercel preview has its own
        # generated hostname, so no fixed list can name them.
        api = load_api(
            ALLOWED_ORIGIN_REGEX=r"https://mining-report-platform-[a-z0-9-]+\.vercel\.app"
        )
        self.assertTrue(allowed(api, "https://mining-report-platform-8gsh3oe0s-data-forge1.vercel.app"))
        self.assertTrue(allowed(api, "https://mining-report-platform-kf5ac7dln-data-forge1.vercel.app"))
        self.assertFalse(allowed(api, "https://mining-report-platform.evil.com"))

    def test_regex_alone_does_not_leave_the_list_open(self):
        # The trap this guards: if the list still defaulted to "*", adding a
        # regex would allow everyone while looking like a restriction.
        api = load_api(ALLOWED_ORIGIN_REGEX=r"https://only-this\.example\.com")
        self.assertEqual(api.ALLOWED_ORIGINS, [])
        self.assertFalse(allowed(api, "https://anything.example.com"))
        self.assertTrue(allowed(api, "https://only-this.example.com"))

    def test_list_and_regex_together(self):
        # The deployed shape: production named exactly, previews by pattern.
        api = load_api(
            ALLOWED_ORIGINS="https://mining-report-platform.vercel.app",
            ALLOWED_ORIGIN_REGEX=r"https://mining-report-platform-[a-z0-9-]+\.vercel\.app",
        )
        self.assertTrue(allowed(api, "https://mining-report-platform.vercel.app"))
        self.assertTrue(allowed(api, "https://mining-report-platform-abc123-data-forge1.vercel.app"))
        self.assertFalse(allowed(api, "https://not-ours.vercel.app"))

    def test_invalid_regex_is_ignored_rather_than_crashing(self):
        # A typo in a dashboard variable must not take the API down on boot.
        api = load_api(
            ALLOWED_ORIGINS="https://app.example.com",
            ALLOWED_ORIGIN_REGEX="https://[unclosed",
        )
        self.assertTrue(allowed(api, "https://app.example.com"))
        self.assertFalse(allowed(api, "https://anything.example.com"))

    def test_invalid_regex_does_not_widen_access(self):
        # Dropping a bad pattern must fail closed, never back to "*".
        api = load_api(ALLOWED_ORIGIN_REGEX="https://[unclosed")
        self.assertFalse(allowed(api, "https://anything.example.com"))


if __name__ == "__main__":
    unittest.main()
