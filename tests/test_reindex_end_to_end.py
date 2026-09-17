# -*- coding: utf-8 -*-
"""
The whole reindex path, against a real pgvector: does the index actually fill?

Every other test here mocks the vector store or the provider. This one runs
the real FastAPI endpoint against a real Postgres with a real HNSW index and
asks the only question that matters to whoever pressed the button: afterwards,
does searching return passages?

**Run in a fresh interpreter, for the same reason test_ai_providers.py is.**
Sharing a process with the rest of the suite does not work here: another
module rebinds the database onto a temporary file, and another saves and
restores `ai_providers.embeddings_describe` around each of its own tests and
will happily restore the real one over a stub. Both failures are silent and
total - every batch reports "0 indexed" and the reason arrives inside a
per-report error nobody is looking at. A subprocess with its own database and
its own module state is the only way this measures what it claims to.

Embeddings are stubbed, and only those: the question is whether *this* code
works, not whether a free tier is up. When the button appeared stuck in
production, telling those two apart was exactly what nobody could do.

Skipped without VECTOR_DATABASE_URL. CI runs a pgvector service and fails the
build if these report as skipped there.
"""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

#: The scenario, run end to end in its own interpreter. Prints one line per
#: assertion so a failure says which step broke rather than only that one did.
SCENARIO = r'''
import hashlib, os, sys
sys.path.insert(0, %(root)r)

DIMENSIONS = 768
def fake(text):
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [((digest[i %% len(digest)] + i) %% 255) / 255.0 for i in range(DIMENSIONS)]

import ai_providers, vector_store
ai_providers.embed = lambda texts: [fake(t) for t in texts]
ai_providers.embeddings_describe = lambda: {
    "available": True, "reason": None, "provider": "stub",
    "model": "stub-embed-768", "dimensions": DIMENSIONS,
}

import auth as auth_mod
from database import MiningReport, SessionLocal, User, init_db

init_db()
db = SessionLocal()
db.add(User(username="e2e", password_hash=auth_mod.hash_password("e2e-pass"),
            display_name="E2E", is_readonly=False))
ids = []
for i in range(9):
    report = MiningReport(
        filename="e2e_%%d.pdf" %% i, status="completed",
        raw_text="Gevra opencast mine produced %%d.5 million tonnes." %% (50 + i),
        page_texts=["Gevra opencast mine produced %%d.5 million tonnes." %% (50 + i),
                    "Overburden removal reached %%d million cubic metres." %% (120 + i)],
        mine_name="Gevra", mineral_type="Coal",
    )
    db.add(report); db.flush(); ids.append(report.id)
db.commit(); db.close()

vector_store.reset()
vector_store._SCHEMA_READY = False

from fastapi.testclient import TestClient
from backend.api import app

client = TestClient(app)
token = client.post("/auth/login",
                    json={"username": "e2e", "password": "e2e-pass"}).json()["access_token"]
headers = {"Authorization": "Bearer " + token}

# The loop the browser runs, cursor and all.
rounds, after, body = 0, 0, None
while rounds < 40:
    response = client.post("/admin/reindex?limit=4&after=%%d" %% after, headers=headers)
    assert response.status_code == 200, (response.status_code, response.text)
    body = response.json()
    after = body["next_after"]
    rounds += 1
    if body["remaining"] <= 0:
        break

print("ROUNDS", rounds)
print("REMAINING", body["remaining"])
print("FAILURES", len(body["failures"]), body["failures"][:1])

indexed = vector_store.indexed_report_ids()
print("MINE_INDEXED", sum(1 for i in ids if i in indexed), "of", len(ids))

stats = vector_store.stats()
print("PASSAGES", stats["chunks"])

# Resumable: a second full pass must not re-embed what is already there.
again = client.post("/admin/reindex?limit=4&after=0", headers=headers).json()
print("SECOND_PASS_INDEXED", again["reports_indexed"])

hits = vector_store.search(fake("Gevra opencast mine produced 54.5 million tonnes."), limit=3)
print("HITS", len(hits))
print("HIT_HAS_PAGE", bool(hits) and hits[0].get("page") is not None)
print("HIT_HAS_CONTENT", bool(hits) and bool(hits[0].get("content")))
'''


@unittest.skipUnless(os.getenv("VECTOR_DATABASE_URL"), "needs a Postgres with pgvector")
class ReindexFillsTheIndexAndSearchFindsIt(unittest.TestCase):
    def test_the_button_fills_the_index_and_search_then_finds_passages(self):
        with tempfile.TemporaryDirectory() as directory:
            environment = {
                **os.environ,
                "DATABASE_URL": f"sqlite:///{directory}/e2e.db",
                "USE_MOCK_AI": "true",
                "AUTH_SECRET": "e2e-secret-not-a-real-one",
                "AUTH_USERS": "e2e:e2e-pass:E2E",
                "DEMO_ACCOUNT": "off",
            }
            result = subprocess.run(
                [sys.executable, "-c", SCENARIO % {"root": str(PROJECT_ROOT)}],
                cwd=PROJECT_ROOT, env=environment,
                capture_output=True, text=True, timeout=300,
            )
        if result.returncode != 0:
            self.fail(f"scenario failed:\n{result.stdout}\n{result.stderr}")

        out = dict(
            line.split(" ", 1) for line in result.stdout.splitlines() if " " in line
            and line.split(" ", 1)[0].isupper()
        )

        # The loop terminates and reaches the end, rather than spinning.
        self.assertLess(int(out["ROUNDS"]), 40, "the loop the browser runs must terminate")
        self.assertEqual(int(out["REMAINING"]), 0, "it must reach the end of the corpus")
        self.assertTrue(out["FAILURES"].startswith("0 "), f"unexpected: {out['FAILURES']}")

        # Every document written is in the index, with its passages.
        self.assertEqual(out["MINE_INDEXED"], "9 of 9")
        self.assertGreaterEqual(int(out["PASSAGES"]), 18, "two pages each, at least")

        # Resumable. The only reason batching is safe.
        self.assertEqual(int(out["SECOND_PASS_INDEXED"]), 0,
                         "a second pass must cost nothing, not re-embed the corpus")

        # The point of all of it. An index that fills and returns nothing is,
        # to whoever pressed the button, the same as one that never filled -
        # and a passage without its page cannot be cited.
        self.assertGreater(int(out["HITS"]), 0, "an index with passages must return some")
        self.assertEqual(out["HIT_HAS_PAGE"], "True")
        self.assertEqual(out["HIT_HAS_CONTENT"], "True")


if __name__ == "__main__":
    unittest.main()
