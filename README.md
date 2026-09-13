# ⛏️ AI-Powered Geological & Mining Reporting Solution

**Smart India Hackathon 2026 | Problem ID: SIH26023**

**Ministry of Coal | CMPDI / CIL (Coal India Limited)**

---

## 📋 Problem Statement

Manual mining report processing creates a governance bottleneck:
- Mining reports scattered across PDFs, spreadsheets, images, and archives
- CMPDI/CIL subsidiaries process every report by hand
- Heavy reliance on subject-matter experts for every single report
- Reports delayed by weeks; manual errors cause inconsistent records

**Impact:** Parliamentary inquiries are answered slowly — a direct governance impact.

---

## 🎯 Solution

An AI-powered platform that automates the entire mining reporting pipeline:

1. **📄 Automated Report Generation** — Extract data from PDFs → structured reports
2. **☁️ Word Cloud & Topic Identification** — Key themes, minerals, and locations
3. **🔍 AI Query System** — Natural language questions → intelligent answers

---

## 📊 Impact

| Metric | Before | After |
|--------|--------|-------|
| Report Turnaround | Weeks | Hours |
| Manual Effort | 100% | 20% |
| Error Rate | High | Minimal |
| Data Consistency | Poor | Perfect |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│              REACT + VITE FRONTEND (primary)             │
│  shadcn/ui · Dashboard, Documents, Ask, Analytics,       │
│  Topics, Report Studio, Data Explorer, Validation        │
└─────────────────────────┬────────────────────────────────┘
                          │  REST (VITE_API_URL)
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                       │
│  upload · reports · query · stats · validation · dossier │
└───┬────────────┬──────────────┬───────────────┬──────────┘
    ▼            ▼              ▼               ▼
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│DOCUMENT │ │    AI    │ │  SQLite    │ │ VALIDATION + │
│PROCESSING│ │ PROVIDER │ │  DATABASE  │ │  EVIDENCE    │
│pypdf +  │ │ (extract,│ │ (SQLAlchemy)│ │  ENGINES     │
│tesseract│ │  answer) │ │            │ │              │
└─────────┘ └──────────┘ └────────────┘ └──────────────┘
```

> A legacy Streamlit UI (`app.py`) still exists and talks to the same backend,
> but the React frontend in `frontend/` is the one that is maintained.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (for the React frontend)

### 1. Install

```bash
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

`requirements.txt` is what the FastAPI backend needs and nothing more. The
original Streamlit prototype UI (`app.py`) is superseded by the React frontend
and its dependencies live separately, so they are not installed here or built
into a deploy. To run that old UI anyway:

```bash
pip install -r requirements-streamlit.txt
python start.py
```

### 2. Configure

```bash
cp .env.example .env
```

`.env` is gitignored and untracked — safe to put a key in. Nothing in it is
required for the app to *start*: with no provider configured the backend falls
back to deterministic mock extraction and answers. To get real answers you need
one AI provider, and three of the four cost nothing — see *AI providers* below.

**You do need an account to get past the sign-in screen.** There is no signup
endpoint — that is deliberate, so who can read the corpus is decided by whoever
controls the deployment rather than whoever finds the page. Accounts are created
from the environment at startup:

```bash
# .env — comma-separated, username:password:Display Name
AUTH_USERS=auditor:choose-a-password:CMPDI Auditor
```

A read-only demo account (`demo`) is created automatically and its credentials
are printed on the sign-in screen, so an evaluator can look around without being
handed anything. It can open every document and ask every question, but cannot
upload, delete or resolve. Set `DEMO_ACCOUNT=off` to remove it, or
`DEMO_PASSWORD` to change it.

Seeding only ever adds, so dropping a name from `AUTH_USERS` leaves that account
working. `AUTH_REMOVE_USERS=olduser` deletes one.

### 3. Run

```bash
# Terminal 1 — backend
uvicorn backend.api:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API docs:** http://localhost:8000/docs

The frontend targets `http://localhost:8000` by default; override with
`VITE_API_URL`.

### Tests

```bash
python -m unittest discover -s tests    # 114 tests: auth, validation, evidence, CORS, exports, AI providers
cd frontend && npm test                 # 19 tests: CSV escaping, API base URL, stale-chunk recovery
cd frontend && npx tsc --noEmit         # frontend type check
```

---

## 🤖 AI providers

Every AI feature is the same shape — build a prompt, get text back — so
`ai_providers.py` puts one `complete()` method behind four transports. Pick one
in `.env`; the rest of the platform does not change.

| Provider | `.env` | Cost |
|---|---|---|
| **Gemini** | `GEMINI_API_KEY` | Free tier, no payment method needed |
| **OpenRouter** | `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` | Free models (ids end in `:free`) |
| **Ollama** | `AI_PROVIDER=ollama` | Free, local, offline, no key |
| **Claude** | `CLAUDE_API_KEY` | Paid — requires a card on the Anthropic account |
| *(none)* | — | Deterministic mock answers; every screen still works |

`AI_PROVIDER` selects one explicitly. Left at `auto` (the default) the first
provider with credentials wins, in the order above. Ollama is never chosen by
`auto` — having it installed is not the same as wanting it — so point at it
with `AI_PROVIDER=ollama`. `USE_MOCK_AI=true` forces mock over any key, which
is how you keep a live key from being spent during development.

`OPENROUTER_MODEL` has no default on purpose: free model ids rotate as
providers add and drop promotions, so a baked-in guess would 404 on your first
call. Pick a current one from <https://openrouter.ai/models?max_price=0>.

`OPENROUTER_BASE_URL` also makes that provider work against any
OpenAI-compatible server — LM Studio, vLLM, LiteLLM, Groq.

### Quickest free setup (Gemini)

```bash
# 1. Get a key at https://aistudio.google.com/apikey  (no card required)
# 2. Put it in .env
echo 'GEMINI_API_KEY=your_key_here' >> .env
# 3. Confirm the backend picked it up
curl -s localhost:8000/health
# {"status":"healthy", ..., "ai_mode":"gemini", "ai_model":"gemini-3.6-flash", "ai_mode_reason":null}
```

### Fully local setup (Ollama)

```bash
# 1. Install from https://ollama.com/download, then pull a model
ollama pull llama3.2
# 2. Point the backend at it
printf 'AI_PROVIDER=ollama\nOLLAMA_MODEL=llama3.2\n' >> .env
```

Ollama on CPU is slow; raise `AI_TIMEOUT_SECONDS` if calls time out.

### When answers are stand-ins and you cannot see why

```bash
python doctor.py
```

Resolves the provider the way the backend does, then actually calls it -
the step `/health` cannot do, because it reports what is configured, not
what answers. Prints the failure and the one thing to change. It never
prints a key.

### Confirming which provider is live

`GET /health` reports the active provider without ever reading a key back, and
the Settings page shows the same thing. `ai_mode` is the live provider name, or
`mock`, in which case `ai_mode_reason` names exactly what is missing.

`.env` is read at startup by `utils/env.py`, which every module that reads
configuration imports before its first `os.getenv`. A variable already exported
in the shell takes precedence over the file.

Keys are read server-side only: never returned by an endpoint, never logged
(error text is scrubbed of any configured key before it is printed), never
exposed to the browser, and never committed — `.env` is untracked for that
reason. Gemini's key travels in a header rather than the URL so it cannot be
captured by proxy and access logs.

If a provider call fails — wrong model id, rate limit, Ollama not running —
the request degrades to a mock answer and logs why, rather than erroring.

Independent of the provider, PDF text extraction, OCR, storage, word clouds,
PDF generation, discrepancy detection and evidence location are all real.

---

## 🚀 Deploying the backend

The frontend is static and deploys anywhere. The backend needs a host that
runs Python - Railway, Render and Fly all read the `Procfile` in this repo.

**What this backend does not need:** uploaded PDFs are parsed in memory and
only their text is stored, and word clouds are re-rendered from that text on
request. So there is nothing on disk to preserve - no volume, no object
store. OCR is optional too: `pytesseract` degrades gracefully when the
tesseract binary is absent.

**What it does need:**

| Variable | Why |
|---|---|
| `DATABASE_URL` | SQLite lives on a disk that most hosts wipe on redeploy. Attach a managed Postgres and paste its URL, or your uploads vanish on the next deploy. |
| `GEMINI_API_KEY` *(or another provider key)* | Set it in the host's environment panel, never in the repo. |
| `ALLOWED_ORIGINS` | Defaults to `*`. Set it to your frontend's URL so upload and delete are not open to every site. |
| `ALLOWED_ORIGIN_REGEX` | Optional. Preview deployments get a generated hostname per build, which no fixed list can name — this admits that family without opening the API to everyone. |
| `AUTH_USERS` | Without it the only account is the read-only demo, and nobody can upload. |
| `QUERY_RATE_LIMIT` | Questions per account per window (default 60). `/query` reaches a language model on every call, and the demo password is public, so without a ceiling anyone who opens the site can spend the API budget. |
| `QUERY_RATE_LIMIT_DEMO` | The read-only account's tighter ceiling (default 15). |
| `QUERY_RATE_WINDOW_SECONDS` | The window those counts apply to (default 3600). |
| `OCR_LANGUAGES` | Tesseract codes joined by `+` (default `eng+hin+tel`). Each needs its traineddata installed. |
| `AUTH_SECRET` | Signs session tokens. No default, on purpose: a key in source would let anyone mint a token for any user. Unset, one is generated per process, so a restart signs everyone out. |

`postgres://` URLs are rewritten to `postgresql://` automatically, so the URL
your host hands you works unedited.

### Steps

1. Push this branch, then point the host at the repo. It reads `Procfile`
   and `requirements.txt`; no build config needed.
2. Add a Postgres database and let the host inject `DATABASE_URL`.
3. Set `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, `AUTH_SECRET` and `AUTH_USERS` in
   the environment panel. Check the deploy log for `Created account(s): …` —
   if it names something you did not intend, you pasted the example text.
4. Check the deploy: `curl https://your-backend/health` should report your
   provider, not `mock`.
5. In Vercel, set `VITE_API_URL` to your backend URL and redeploy the
   frontend - otherwise it still calls `http://localhost:8000`, which does
   not exist for anyone but you.

Tables are created on startup, so the first boot against an empty Postgres
needs no migration step. The database starts empty: re-upload your PDFs.

---

## 🖥️ Checking the interface

    npm run dev                  # one shell
    node scripts/ux-audit.mjs    # another

Checks the things that are cheap to get wrong and invisible in review: table
columns that can never fill, placeholder text left on screen, tap targets too
small for a finger, controls a screen reader cannot name, horizontal overflow
at desktop and phone widths, and text below WCAG AA contrast **in both
themes** — the light and dark palettes define their own tokens, so a value
that passes in one says nothing about the other. Exits non-zero when it finds
something.

Two of its rules were wrong when first written, and the corrections are worth
knowing. A control is not unnamed just because its element has no text — a
`<label for>` names it, and checking `textContent` alone reported four
perfectly accessible checkboxes as broken. And a 16px checkbox is not
unreachable when a 24px label beside it toggles the same state, which is the
exemption WCAG 2.5.8 makes. An audit that reports those trains people to
ignore it.

---

## 🔎 Semantic search (pgvector)

Ask DataForge can answer from the passages closest to a question rather than
from a truncated dump of every report's extracted fields. It is **off until
configured**, and everything works without it.

### What it changes

Without it, `/query` concatenates every completed report's extracted fields
and `ai_extractor` cuts the result at 6000 characters. Two consequences, both
worse the larger the corpus gets:

- whatever falls past the cut is never seen by the model, and nothing in the
  answer says so;
- the document **body** is not in the prompt at all — only the fields
  extraction already pulled out — so a figure sitting in a paragraph nobody
  extracted cannot be answered from.

With it, the question is embedded and the nearest passages are retrieved.
Chunks are cut along page boundaries, so each retrieved passage is labelled
with the document and page it came from.

### Setting it up

Railway's standard Postgres image ships no extensions:

> "Railway's standard Postgres image does not include pgvector. Use the
> pgvector template instead." — [docs.railway.com](https://docs.railway.com/guides/rag-pipeline-pgvector)

So this uses **its own database**, separate from `DATABASE_URL`. Every row in
it is derived from the reports table and can be rebuilt at any time, which is
why it is kept out of the database holding the only copy of anything.

```bash
# 1. Deploy Railway's pgvector template into the same project
#    https://railway.com/deploy/3jJFCA
#
# 2. Point the backend at it. Use the private-network reference so the
#    traffic never leaves Railway:
VECTOR_DATABASE_URL=${{pgvector.DATABASE_URL}}

# 3. Index the reports already in the database.
#    The vector database is reachable only over Railway's private network,
#    so on a deployment this runs inside it rather than from your machine:
curl -X POST "$BACKEND/admin/reindex" -H "Authorization: Bearer $TOKEN"
#    Locally, where you can reach the database directly:
python -m vector_backfill

# 4. Confirm it is serving
curl -s $BACKEND/health | jq .retrieval
# {"enabled": true, "embedding_model": "text-embedding-004",
#  "indexed_chunks": 24, "indexed_reports": 6, ...}
```

Locally, any Postgres with the extension will do:

```bash
apt-get install -y postgresql-16-pgvector      # or your platform's package
createdb dataforge_vectors
export VECTOR_DATABASE_URL=postgresql://localhost/dataforge_vectors
python -m vector_backfill
```

### Embeddings

Vectors come from the **same provider that answers questions**, so no second
account is needed — Gemini in production, via its free-tier
`text-embedding-004`. Ollama works locally with `nomic-embed-text`. Anthropic
publishes no embeddings API, so with `AI_PROVIDER=claude` retrieval reports
itself off and `/query` uses the field dump.

| variable | default | what it does |
|---|---|---|
| `VECTOR_DATABASE_URL` | *unset* | Postgres with pgvector. Unset means retrieval is off. |
| `GEMINI_EMBED_MODEL` | `text-embedding-004` | 768 dimensions |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | for local use |
| `VECTOR_TOP_K` | `8` | passages retrieved per question |
| `VECTOR_CHUNK_CHARS` | `1200` | characters per chunk |
| `VECTOR_CHUNK_OVERLAP` | `150` | repeated between chunks, so a straddling sentence is not lost |

### It is never the reason a question fails

No database, no embeddings API, an unreachable host, a missing extension —
each is reported as a reason and `/query` falls back to the behaviour it had
before. The response says which happened:

```json
{ "retrieval_mode": "semantic" | "full-corpus", "retrieval_note": null }
```

Changing the embedding model means rebuilding: vectors from two models are
not comparable, and the store refuses to mix them rather than returning
nonsense that looks like a working search. `python -m vector_backfill --reset`.

## 📏 What is measured, and what is not

**Extraction accuracy is the number everything else rests on.** Every figure
reported and every conflict raised comes out of that one step, and for most
of this project's life it had no measurement attached in any language.

`evaluation/` now scores it against documents a person has read by hand:

    python -m evaluation.score
    python -m evaluation.score --language hi

Each labelled field lands in one of four buckets — **exact**, **equivalent**
(wording the platform already treats as the same), **missing**, **wrong** —
and missing is reported apart from wrong on purpose: a blank field is a gap
someone can see and fill, while a confidently wrong value is what silently
corrupts a conflict report.

Equivalence reuses `validation_engine`'s own comparison, so the score
describes the system that ships rather than a stricter one it never applies.

**The scorer refuses to run against mock extraction.** Without a provider key
the extractor returns stand-ins, and scoring those would produce a fabricated
accuracy figure — worse than having none. See `evaluation/README.md` for how
to add documents.

The repository ships one labelled English document. **A real figure needs
real reports**, and until they are added the honest statement remains that
accuracy is unmeasured.

---

## 🇮🇳 Hindi and Telugu

Documents in both scripts survive the pipeline. Every failure fixed here was
**silent** - nothing raised, every endpoint returned 200, and the output
looked plausible to anyone who does not read the script:

| What broke | What it looked like |
|---|---|
| No Devanagari or Telugu in the PDF font | The text simply **absent** from the report; the download still succeeded |
| No shaping engine, so glyphs landed in logical order | `रिपोर्ट` drawn as `रपिोर्ट` - a different, unreadable string |
| `[^\w\s]` scrubbing deleted every combining mark | `रिपोर्ट उत्पादन` became `र प र ट उत प दन`; topics came back empty |
| The word cloud re-tokenised with its own ASCII pattern | Whole words shattered into single consonants in the image |
| `पहली तिमाही 2026: 45,000 टन` read as its year | The figure recorded as **2026** - the Hindi half of the defect fixed for `Q1 2026` in #5 |
| `త్రైమాసికం 2 2026: 52,000 టన్నులు` read as its quarter | The figure recorded as **2** |
| OCR was never told the language | A scanned page read as English, returning confident nonsense |

A corpus mixing all three languages is the normal case for a body spanning
Jharkhand and Telangana, and is handled: `Q1 2026`, `पहली तिमाही 2026` and
`మొదటి త్రైమాసికం 2026` all resolve to **the same reporting period**, so
reports covering one quarter are compared rather than silently excused as
different periods. Devanagari (`४५,०००`) and Telugu (`౪౫,౦౦౦`) numerals are
read as figures.

### What this needs

- **`uharfbuzz`** is a hard dependency, not an extra. Without it fpdf2 places
  vowel signs in logical order and both scripts are quietly wrong.
- **The fonts ship in `assets/fonts/`** - Noto Sans Devanagari and Noto Sans
  Telugu, subset to static Regular and Bold, each with its own OFL licence
  beside it. They are registered as fpdf2 *fallbacks*, which resolve per
  character, so one PDF can hold English, Hindi and Telugu at once with no
  script detection anywhere in the rendering code.
- **`OCR_LANGUAGES`** defaults to `eng+hin+tel`. Each needs its traineddata on
  the host (`tesseract-ocr-hin`, `tesseract-ocr-tel`); a code with no
  traineddata is dropped with a warning rather than passed on, because it
  would fail the whole OCR call.

### What to know before changing any of this

**A document leads with its own script.** The Noto face for the dominant
script is the *primary* font; DejaVu drops to a fallback. That is not a
preference. fpdf2 splits text into one fragment per font, and with the
shaping engine on it **drops the space at a fragment boundary** — with
DejaVu primary and Telugu merely a fallback, `బొగ్గును ఉత్పత్తి` rendered as
one run-on word, measurably *narrower* than the same string with the space
deleted. Nothing raised. Leading with the document's own face keeps its
text, its Latin and the spaces between them in one fragment. DejaVu stays on
for the handful of symbols Noto lacks (`†‡½¼²³µΩ≈≤≥±→←✓`).

**Shaping is switched on per document**, only when an Indic script is
present. It roughly doubles render time, and it defeats fpdf2's
`alias_nb_pages`, which substitutes a literal `{nb}` that the shaper has
already turned into glyph ids. So an English report keeps both its speed and
its `Page 1/3` footer exactly as before, and an Indic report — unreadable
without shaping — shows `Page 1` without the total.

**Indic reports are not italic.** No free Devanagari or Telugu face ships
one, so the upright file is registered under the italic styles too. The
footer and disclaimer simply render upright; the alternative was an
`Undefined font` exception the moment a report led with an Indic face.

**A minority script copies out imperfectly.** Everything *renders*
correctly, whichever face serves it. But glyphs drawn from a fallback face
carry an imperfect ToUnicode map, so selecting Hindi text out of a
Telugu-led PDF can yield a stray character. Search and copy-paste are
reliable for the leading script and for Latin.

**A word cloud can only use one font.** Unlike the PDF, `WordCloud` takes a
single `font_path` for the whole image, so a document mixing Hindi *and*
Telugu is drawn in whichever script dominates and the other renders as empty
boxes. Mixing either script with English is fine — both Noto faces cover
Latin.

**Extraction itself is not yet validated for either language.** This work
makes them survive ingestion, comparison, rendering and export. Whether the
language model reads mining fields as accurately out of a Hindi or Telugu
report as an English one is a separate question, and answering it needs a
corpus of real documents to measure against. Do not assume the extraction
quality carries over.

---

## 🔎 Deploying the frontend, and search visibility

The frontend is a static bundle. Beyond `VITE_API_URL` it takes three
optional variables, all read at **build** time — changing one in the host's
panel needs a redeploy to take effect.

| Variable | Why |
|---|---|
| `VITE_API_URL` | The backend's URL. Without it the app calls `http://localhost:8000`, which exists for nobody but you. |
| `VITE_SITE_URL` | **Optional override.** The canonical origin is baked in as `https://getdataforge.online`, so a plain redeploy produces correct tags with no dashboard step. Set this only if the site moves. Preview deployments ignore both and speak as their own hostname. |
| `VITE_GSC_VERIFICATION` | The token from Google Search Console's *HTML tag* method — the `content="…"` value only, not the whole tag. |

`robots.txt` and `sitemap.xml` are generated into the bundle at build time by
`frontend/plugins/seo.ts`; neither is a checked-in file, so neither can drift
from the domain actually deployed. Preview deployments are emitted `noindex`
with a disallow-all `robots.txt`, and speak as their own hostname rather than
the canonical one, so they never compete with production for the same query.

Note that `VERCEL_URL` is the *per-deployment* hostname even in production, so
it is deliberately **not** used to derive the production canonical — doing so
would have every deploy claim a different canonical URL and split the ranking
between them. It is used for previews, which have no canonical identity of
their own.

### Why the sitemap has one URL

That is not an oversight. Navigation is hash-based (`#/documents`,
`#/analytics`), and a crawler discards everything from the `#` onward, so
those are not separate URLs to Google. Every one of them sits behind the
sign-in wall besides — a crawler only ever reaches the sign-in screen. `/` is
the only address that exists here, and a sitemap listing routes that return
the same login page would be padding.

The share card (`og-card.png`) matters more than the sitemap for this kind of
project: it is what appears when the link is pasted into Slack, WhatsApp or
LinkedIn, which is how a demo actually travels.

### Verifying with Google Search Console

Either method works:

- **HTML tag** — set `VITE_GSC_VERIFICATION` to the token and redeploy.
- **HTML file** — drop the `google….html` file Google gives you into
  `frontend/public/`. Anything in that directory is served from the site root.

Then submit `https://your-domain/sitemap.xml` as the sitemap. Expect Search
Console to report one page discovered, and to describe the site as requiring
sign-in. Both are correct.

---

## 📖 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | System info |
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Upload & process PDF report |
| `GET` | `/reports` | List all reports |
| `GET` | `/reports/{id}` | Get specific report |
| `DELETE` | `/reports/{id}` | Delete a report |
| `GET` | `/reports/{id}/download` | Download PDF report |
| `GET` | `/reports/{id}/wordcloud` | Get word cloud image |
| `GET` | `/reports/generate` | Compose a dossier PDF across all reports |
| `POST` | `/query` | AI query; returns the answer, sources and located evidence |
| `GET` | `/stats` | Document, query, mineral and location counts |
| `GET` | `/validation` | Cross-document discrepancies with their status |
| `POST` | `/validation/{id}/resolve` | Record an auditor decision (resolved / flagged / pending) |
| `GET` | `/query-history` | Query history |

`question` on `/query` is a **query parameter**, not a JSON body.

---

## ✅ What is real, and what is not

Everything below is computed from uploaded documents:

- **Upload → extraction → indexing** — real PDF text extraction and OCR
- **Ask DataForge** — answers from the stored corpus, citing the pages the
  values were found on
- **Evidence** — passages located in a document's own text; a value that cannot
  be found is not cited
- **Validation** — conflicts between reports on the same mine, duplicate
  ingests, missing fields and failed extractions, with persisted decisions
- **Dashboard / Analytics / Topics / Data Explorer** — aggregates over the
  indexed corpus
- **Word clouds and PDFs** — generated by the backend
- **Dossier export** — Report Studio composes a dossier across the indexed
  corpus as PDF or DOCX
- **Sign-in** — every document endpoint refuses an anonymous caller

Deliberately absent, rather than simulated:

- **Production time series** — the schema stores no history, so no trend chart
  is shown
- **Per-extraction confidence and subsidiary attribution** — not modelled, so
  the UI shows an em dash instead of a number

---

## 🖥️ Frontend Pages

Nine screens behind the sign-in, in sidebar order.

| Page | What it is for |
|---|---|
| **Dashboard** | Corpus totals and recent activity |
| **Documents** | The indexed corpus — upload, filter, read a PDF in place, delete |
| **Ask DataForge** | Natural-language questions answered from the corpus, citing the pages values came from |
| **Analytics** | Aggregates by mineral and location, exportable as CSV |
| **Topic Intelligence** | Terms ranked by how many documents mention them, with term clouds and co-occurrence |
| **Report Studio** | Composes a dossier across the corpus and exports it as PDF or DOCX |
| **Data Explorer** | The extracted fields as a table, for reading across documents |
| **Validation** | The triage queue of conflicts, duplicates, missing fields and failed extractions |
| **Settings** | Backend address and the live AI provider, as reported by the backend |

---

## 🧪 Demo Flow (12 minutes)

Load the corpus **before** you present. With a single document, Validation and
Topic Intelligence have nothing to find, and those are the parts that
distinguish this from a PDF viewer. Six to eight reports, at least two of which
disagree about the same mine, is what makes the demo land.

1. **The problem (2 min)** — reports arrive as PDFs from many sources, and a
   consolidated total built from documents that contradict each other is wrong.
2. **Sign in (30 s)** — sign in, and point out that the demo credentials on the
   screen are read-only. Access control is a feature, not a formality.
3. **Upload (2 min)** — drop in a report; extraction runs and the fields appear.
4. **Ask DataForge (2 min)** — ask a question you have rehearsed, and open the
   evidence snippet to show the answer came from a real page rather than the
   model's memory.
5. **Validation (3 min)** — the centrepiece. Open a conflict and show two
   documents disagreeing about the same mine and field.
6. **Report Studio (1 min)** — export the dossier as PDF or DOCX.
7. **Questions (1 min)** — the honest answer about what is not built yet is in
   *What is real, and what is not* above.

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Streamlit | Pure Python, zero JS, fast development |
| Backend | FastAPI | Async, auto-docs, fast performance |
| AI/LLM | Gemini / OpenRouter / Ollama / Claude | Swappable in `.env`; free options first |
| Document Processing | pypdf + pytesseract | PDF extraction + OCR |
| Database | SQLite | Zero setup, perfect for MVP |
| Report Generation | fpdf2 | Python PDF generation |
| Word Cloud | wordcloud + matplotlib | Text visualization |
| Deployment | Streamlit Cloud | One-click, free tier |

---

## 📁 Project Structure

```
mining_report_platform/
├── app.py                    # Streamlit frontend
├── backend/
│   ├── __init__.py
│   └── api.py               # FastAPI backend
├── database.py               # SQLite + SQLAlchemy models
├── document_processor.py     # PDF text extraction + OCR
├── ai_providers.py           # Gemini / OpenRouter / Ollama / Claude transports
├── ai_extractor.py           # Prompts, parsing and mock fallbacks
├── report_generator.py       # PDF report generation
├── wordcloud_generator.py    # Word cloud & topics
├── create_sample_pdf.py      # Sample PDF generator
├── start.py                  # Unified startup script
├── requirements.txt          # Dependencies
├── .env.example              # Environment config
├── reports/                  # Generated reports & word clouds
└── README.md                 # This file
```

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Provider rate limits | Free tiers are capped; swap `AI_PROVIDER` or run Ollama locally |
| OCR accuracy | pytesseract + model validation |
| Database schema changes | Start with SQLite, SQLAlchemy handles migrations |
| Deployment issues | Demo locally on laptop; backup mobile hotspot |
| PDF parsing edge cases | Test with 10+ different mining report formats early |

---

## 🏆 Judging Criteria

| Criterion | Weight | What We Deliver |
|-----------|--------|-----------------|
| Functionality | 40% | Upload → Extract → Report → Query |
| Demo Clarity | 25% | Smooth live demo, clear architecture |
| Code Quality | 20% | Clean, documented, tested, GitHub history |
| Innovation | 15% | Multi-doc search, topic extraction, AI Q&A |

---

## 📝 License

Developed for Smart India Hackathon 2026
