# DataForge — state of the project

Written 2026-09-22 so a fresh session can pick this up without re-deriving it.
Read this first. Everything here was verified by running it, not recalled.

**If you only read one section, read [Known flaws](#known-flaws).**

---

## 1. What this is

DataForge — mining report intelligence for **SIH problem statement 26023**,
"AI-Powered Geological, Mining and other Reporting Solution for CMPDI/CIL
subsidiaries". Ministry of Coal / CMPDI / Coal India.

Pipeline as built:

```
PDF → text extraction / OCR → chunking → AI structured extraction → PostgreSQL
query → embedding → vector similarity → context retrieval → LLM → evidence-based answer
validation → cross-document comparison → conflict detection → source traceability
report → structured data + evidence → PDF/DOCX
```

**The demo already happened (2026-09-19) and went well.** The judges were
impressed. The evaluator's feedback was: *work on real data*. That feedback is
correct and is the entire current agenda. See [Known flaws](#known-flaws).

---

## 2. Where the code is

| | |
|---|---|
| Repo | `juliesdutt-spec/mining_report_platform` |
| Default branch | `main`, at `e0a6997` |
| Working branch | `claude/shadcn-ui-design-system-yxtqrx` |
| Unmerged commits | `2d55951`, `94a0ab0` — the extraction-selection work, **no PR opened yet** |
| Backend tests | **434 passed, 13 skipped, 65 subtests** |
| Frontend tests | **154 pass, 0 fail** |
| Python modules | 20 at repo root, 28 test files |
| Frontend pages | 11 |

### Deployment

| | |
|---|---|
| Frontend | Vercel → `getdataforge.online` (React 19 + TypeScript + Vite, hash routing) |
| Backend | Railway → `miningreportplatform-production.up.railway.app` (FastAPI + uvicorn) |
| Railway project | `23659e40-bd75-42d7-92da-c979e0f40c48` |
| Railway service | `9ef1fdc2-0a8a-483c-8f1d-79885b30d263` |
| Railway env | `3f6d4311-2015-4f71-8b24-50e302c732e7` (production) |
| Databases | Postgres (`DATABASE_URL`) + separate pgvector instance (`VECTOR_DATABASE_URL`) |
| Live commit | `e0a6997` |
| AI provider | OpenRouter, `nvidia/nemotron-3.5-lightning:free` |
| Embeddings | `gemini-embedding-001`, 768 dimensions |

`Procfile`: `uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8000}` — correct,
do not "fix" it. Railway supplies `PORT` (currently 8080).

`nixpacks.toml` installs `tesseract-ocr`, `tesseract-ocr-hin`, `tesseract-ocr-tel`.
**Do not delete this.** Nixpacks installs no system packages by default, and
`pytesseract` imports fine without the binary — so removing it makes every
scanned upload succeed and store nothing.

---

## 3. What actually works

Verified live, not assumed:

- Upload, PDF preview, delete
- Text extraction, and OCR for scans (tesseract 5.5.0, `eng+hin+tel`)
- **Trilingual extraction confirmed on real output** — English, Hindi
  (Devanagari), Telugu. A Telugu SCCL report extracted
  `Kothagudem, Bhadradri Kothagudem, Telangana` as an exact label match
- Structured extraction via OpenRouter, provider-agnostic behind `ai_providers`
- pgvector semantic search, HNSW, `vector_cosine_ops`
- Ask DataForge with retrieval and page-level evidence
- Validation, cross-document conflict detection, source traceability
- Analytics, Topic Intelligence, Report Studio, DOCX/PDF export
- Auth with a read-only demo account
- Evaluation harness (`evaluation/score.py`) that **refuses to score mock
  output** rather than print a fabricated number

---

## 4. Known flaws

Ordered by how much they cost. The first four are why "real data" fails.

### 4.1 — Structured extraction reads ~1% of a long document

`ai_extractor.py` sent `text[:8000]` — the **first** 8000 characters. Every
document in the evaluation corpus is 2 pages, so that is the whole document and
the choice never showed. A 342-page Coal India annual report is ~750,000
characters, so the first 8000 are the cover, contents and foreword. Every
extracted field came from there, under a green "completed" badge.

**Partially addressed** in unmerged commits `2d55951` + `94a0ab0`:
`extraction_context.select_passages()` now picks the passages likeliest to carry
the schema's fields, from anywhere in the document, within the same budget.
Lexical scoring — no embedding quota, no network, no vector database needed.
Cues cover English, Hindi and Telugu.

Measured on a corpus document buried at page 201 of a 342-page report: the old
slice finds none of `Jharia`, `BCCL`, `Dhanbad`, `Jharkhand`, `Bharat Coking`;
selection finds all five, in 7,825 of 8,000 characters.

**Still open:** this is unmeasurable on the current corpus (2-page documents fit
whole, so selection is a no-op — verified on all 13). It needs real documents
before anyone can prove it helps.

### 4.2 — The evaluation corpus is entirely synthetic

`samples/generate_test_corpus.py` says it outright: *"Every file here is
fictional."* All 13 labelled documents in `evaluation/labelled/` were generated
by this project, each shaped to exercise one code path, each exactly 2 pages.

**So the accuracy number measures how well DataForge reads documents DataForge
wrote.** A real report is ~171× larger. This is precisely what the evaluator
saw. No amount of code work fixes it — it needs real labelled PDFs.

`python -m evaluation.inspect_documents <folder> --labels` writes label
skeletons to fill in by hand.

### 4.3 — `upload_report` is `async def` with a fully synchronous body

`backend/api.py:348`. FastAPI runs `def` endpoints in a threadpool and
`async def` endpoints **on the event loop**. Every PDF parse, OCR pass and
blocking `urllib` model call therefore runs on the event loop, and the server
answers **nothing at all** while they do — not `/health`, not `/reports`.

Observed consequences: total log silence during uploads, the "Backend Offline"
badge in the UI, and on 2026-09-22 the app became unreachable until Railway's
own healthcheck restarted the container.

**Fix is roughly one keyword** (`async def` → `def`), but it changes concurrency
across the whole upload path and was deliberately not done at the end of a long
session. Do this early, with tests and a real upload afterwards.

*Note: an earlier explanation in that session blamed GIL starvation of
threadpool work. That was wrong — the work never reaches the threadpool.*

### 4.4 — No table-aware extraction

Real mining production and reserve figures live in **tables**. `extract_text()`
flattens them into running prose. Nothing anywhere in the pipeline uses
`find_tables()` or equivalent. On genuine reports this is probably the single
largest accuracy loss, and likely a bigger win than any model change.

### 4.5 — Large documents cannot be ingested at all

Ingestion is synchronous inside one HTTP request. A 342-page report needs:

- ~50 s to upload 21 MB (bandwidth, not fixable in code)
- a full parse, plus OCR of every page if there is no text layer
- 391–977 chunks to embed at Gemini's 100/min → **4–10 minutes**
- the model call

The browser aborts at 180 s (`frontend/src/services/documents.ts`,
`apiFetch(..., 180000)`). Three real attempts on `ANNUAL_REPORT_2024-25.pdf`
produced three different failures — a NUL crash, then provider timeouts, then
the browser abort. Raising `AI_TIMEOUT_SECONDS` 90 → 120 only moved the failure
from server to browser.

**This needs background job processing.** The data model already has
`status = processing | completed | error` and the UI already renders it, so the
half people expect to be hard is done.

### 4.6 — `MAX_UPLOAD_MB` is 50

Combined with 4.3 and 4.5, any user can hand the app a file that takes it
offline for minutes. Lowering it (~15 MB) is a one-variable seatbelt. It does
**not** make large documents work — it makes them fail instantly and legibly.

### 4.7 — Smaller open items

- `evaluation/latest.json` does not exist — **no accuracy figure has ever been
  recorded**
- Team ID on slide 1 of the SIH deck is blank (college supplies it)
- Git history contains Claude co-author trailers; the user asked about removing
  them and it was deferred. Check whether SIH requires AI-tooling disclosure
  before rewriting ~50 commits
- `provisional_coal_statistics_2021_22.pdf` in production **is real** (Coal
  Controller). `HI-02` and `TE-02` are synthetic. A file the user once believed
  was a real CMPDI report turned out to be DataForge's own generated output
  re-uploaded — its page 2 said so

---

## 5. Fixed on 2026-09-22 (all merged to `main`)

### NUL bytes took the backend "offline" — `147318a`, PR #55

A real upload failed with:

```
File "/app/backend/api.py", line 439, in upload_report
    db.commit()
ValueError: A string literal cannot contain NUL (0x00) characters.
```

while `/health` answered `200 OK` throughout. Five links, each reproduced:

1. A subset-embedded font with a gap in its CID map extracts unmapped glyphs as `0x00`
2. Nothing stripped them — NUL is not whitespace, so `vector_store._tidy`'s `[ \t]+` missed it
3. psycopg2 refuses to send NUL, raising at flush
4. The `except Exception` handler called `db.commit()` **again** on the failed
   session → `PendingRollbackError` → the intended `HTTPException(500)` never ran
5. An unhandled exception skips `CORSMiddleware` (it sits inside
   `ServerErrorMiddleware`), so the 500 arrived with no
   `Access-Control-Allow-Origin` → browser blocked it → `fetch()` rejected with a
   `TypeError` indistinguishable from a dead host → the frontend printed
   **"Cannot reach the DataForge backend"**

Fixed: `document_processor.without_nul()` at both extraction entry points, and
`db.rollback()` before recording the failure. **The shipped corpus contains zero
NUL bytes, which is why 422 tests never caught it.**

### Every PDF parsed twice, every scan OCR'd twice — `81b58f5`, PR #56

`extract_text_from_pdf()` and `extract_pages_from_pdf()` each parsed the whole
document and each had its own OCR fallback. Measured on a 2-page scan:
**6.74 s where 3.89 s would do (1.7×)**. `extract_text_and_pages()` does one
parse and at most one OCR pass; `tests/test_extraction_single_pass.py` asserts
it matches the two originals character-for-character across all 13 corpus
documents. Both originals remain — the evaluation harness calls them.

---

## 6. Constraints that will bite a fresh session

**Sandbox has no external network.** The egress proxy denies all CONNECT —
`getdataforge.online`, `openrouter.ai`, `example.com`, every government site.
You cannot fetch real PDFs, call the model, or hit production. Railway and
GitHub MCP tools **do** work.

**Therefore the scorer cannot be run from the sandbox.** No provider key, no
network. It correctly refuses:

```
Refusing to score against mock extraction - the result would be
a fabricated accuracy figure.
```

Any accuracy number must be produced on the user's machine.

**Quotas.** OpenRouter free tier 50 requests/day, resets 00:00 UTC (05:30 IST).
Gemini embeddings 100/minute. A full 13-document scorer run costs 13 calls.

**Secrets.** Never print or ask for API keys. The user sets them in the Railway
dashboard. `list-variables` was denied by the permission classifier — do not work
around it. `/health` must never return a key. Provider errors are scrubbed via
`ai_providers._redact`.

**The demo account's password is published on the sign-in page.** It must never
change the corpus or spend embedding quota — `/admin/reindex` is gated behind
`writing_user` and returns 403 to demo. Keep it that way.

**pgvector** has a 2000-dimension HNSW ceiling. `GEMINI_EMBED_DIMENSIONS=768`,
`TOP_K=8`, `CHUNK_CHARS=1200`, `CHUNK_OVERLAP=150`.

**Reasoning models bill thinking tokens against `maxOutputTokens`.**
`EXTRACTION_MAX_TOKENS=8000` — do **not** lower it casually. It was raised to
8000 to fix a truncation bug that cost an entire evening; the earlier value of
2000 cut every reply off mid-JSON and looked like a model failure.

---

## 7. What to do next

**(a) Real labelled corpus — do this first.** Nothing else is measurable
without it, and it is literally the evaluator's feedback. The user already has
two real documents: `provisional_coal_statistics_2021_22.pdf` (live in
production) and `ANNUAL_REPORT_2024-25.pdf` (21 MB, 342 pages, on their disk).
Add 3–5 more from `coalcontroller.gov.in` / `cmpdi.co.in` / `coal.gov.in`, then
`inspect_documents --labels` and hand-fill.

**(b) Merge and validate the extraction-selection work.** Commits `2d55951`
and `94a0ab0` are pushed but have no PR. The user should run
`python -m evaluation.score` locally first. **Expect the number not to move** —
that is the regression check, not the result.

**(c) `async def` → `def` on the upload endpoint.** Small, high value, stops
one upload stopping the server.

**(d) Table extraction.** Probably the biggest accuracy win on real reports.

**(e) Background job processing.** The only thing that makes 342-page documents
possible at all.

Then, for productisation: CMPDI data implies on-premise or MeitY-empanelled
hosting, not Railway free tier and not a US LLM API — the provider abstraction
already makes that a config change, which is a genuine asset worth saying out
loud. A pilot on one subsidiary and one document type beats a general platform.
The user is applying to the YUKTI programme.

---

## 8. Corrections — mistakes made, so they are not repeated

Recorded because a fresh session reading only the good parts would repeat them.

- **"Backend Offline" was blamed on GIL starvation of threadpool work.** Wrong.
  The endpoint is `async def`, so the work never reaches the threadpool — it
  blocks the event loop. See 4.3.
- **A manual Railway restart was claimed as the fix** for the app being
  unreachable. The logs showed the container had already self-restarted at
  16:43:01, before the restart was issued. It was redundant.
- **`MAX_UPLOAD_MB` 50 → 15 was recommended as if it would help** the 21 MB
  document upload. It does the opposite — it blocks it sooner. It is a seatbelt
  for the app, not a fix for the file. The user correctly pushed back.
- **A full commit SHA was fabricated from a short one** when merging PR #56;
  GitHub rejected it with a 409. Always read the real SHA.
- **"This is almost certainly not a rate limit"** was said about an empty Gemini
  response. It was a rate limit.
- **Nemotron was blamed for not holding the output format.** The real cause was
  `max_tokens=2000` truncating every reply — our bug, not the model's.
- **A model slug was guessed** (`meta-llama/llama-3.3-70b-instruct:free`) that
  had been withdrawn. Do not guess model ids; have the user copy a current one.
- **Production was merged to repeatedly while the user was actively testing**,
  restarting the backend mid-request and producing confusing errors. Ask before
  deploying when someone is using the site.

---

## 9. Useful commands

```bash
# what the pipeline makes of real PDFs — no API key needed
python -m evaluation.inspect_documents ~/Downloads/somefolder
python -m evaluation.inspect_documents report.pdf --labels

# accuracy (needs a provider key; refuses to score mock)
python -m evaluation.score

# see exactly what the model returned for one document
python -m evaluation.show_reply report.pdf

# environment / provider / OCR diagnosis
python doctor.py

# tests
python -m pytest tests/ -q
cd frontend && npm test -- --run
```
