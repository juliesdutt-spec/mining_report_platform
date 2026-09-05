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

### 2. Configure

```bash
cp .env.example .env
```

`.env` is gitignored and untracked — safe to put a key in. Nothing in it is
required: with no provider configured the backend falls back to deterministic
mock extraction and answers, so everything still runs. To get real answers you
need one AI provider, and three of the four cost nothing — see *AI providers*
below.

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
python -m unittest discover -s tests    # validation, evidence, env, AI providers
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
# {"status":"healthy", ..., "ai_mode":"gemini", "ai_model":"gemini-2.5-flash", "ai_mode_reason":null}
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

`postgres://` URLs are rewritten to `postgresql://` automatically, so the URL
your host hands you works unedited.

### Steps

1. Push this branch, then point the host at the repo. It reads `Procfile`
   and `requirements.txt`; no build config needed.
2. Add a Postgres database and let the host inject `DATABASE_URL`.
3. Set `GEMINI_API_KEY` and `ALLOWED_ORIGINS` in the environment panel.
4. Check the deploy: `curl https://your-backend/health` should report your
   provider, not `mock`.
5. In Vercel, set `VITE_API_URL` to your backend URL and redeploy the
   frontend - otherwise it still calls `http://localhost:8000`, which does
   not exist for anyone but you.

Tables are created on startup, so the first boot against an empty Postgres
needs no migration step. The database starts empty: re-upload your PDFs.

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

Deliberately absent, rather than simulated:

- **DOCX export** — no document generator exists; the action is disabled
- **Production time series** — the schema stores no history, so no trend chart
  is shown
- **Per-extraction confidence and subsidiary attribution** — not modelled, so
  the UI shows an em dash instead of a number

---

## 🖥️ Frontend Pages

### 🏠 Dashboard
- Overview metrics (reports, queries, status)
- Quick actions
- Recent reports

### 📄 Upload Report
- PDF file upload
- Real-time processing
- Extracted data display
- Word cloud generation
- Report download

### 📊 View Reports
- List of all processed reports
- Detailed view for each report
- Download PDF reports
- View word clouds

### 🔍 AI Query
- Natural language questions
- Example questions
- Query history

### 📈 Analytics
- Report statistics
- Mineral distribution charts
- Location distribution charts

### ℹ️ About
- System information
- Architecture overview
- Impact metrics

---

## 🧪 Demo Flow (12 minutes)

1. **ACT 1 (2 min):** Problem Explanation - Show the manual reporting bottleneck
2. **ACT 2 (3 min):** Live PDF Upload - Upload sample mining report
3. **ACT 3 (2 min):** Data Extraction - the configured model extracts structured data → JSON shown
4. **ACT 4 (2 min):** Report Generation - Download formatted PDF report
5. **ACT 5 (2 min):** AI Query - "What was total coal extracted?" → AI answers
6. **ACT 6 (1 min):** Q&A - Explain architecture to judges

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
