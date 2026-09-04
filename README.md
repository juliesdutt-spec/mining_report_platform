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
│DOCUMENT │ │  CLAUDE  │ │  SQLite    │ │ VALIDATION + │
│PROCESSING│ │  AI API  │ │  DATABASE  │ │  EVIDENCE    │
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

`.env` is gitignored and untracked — safe to put a key in. Without
`CLAUDE_API_KEY` the backend falls back to deterministic mock extraction and
answers, so everything still runs; see *AI modes* below.

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
python -m unittest discover -s tests    # validation + evidence engines
cd frontend && npx tsc --noEmit         # frontend type check
```

---

## 🤖 AI modes

| `CLAUDE_API_KEY` | `USE_MOCK_AI` | Behaviour |
|---|---|---|
| set | `false` | Real Claude extraction and answers |
| set | `true` | Forced mock (useful for offline demos) |
| unset | either | Mock — the key is required for real AI |

The key is read server-side only. It is never exposed to the browser and must
never be committed; `.env` is untracked for that reason.

Independent of the AI mode, PDF text extraction, OCR, storage, word clouds,
PDF generation, discrepancy detection and evidence location are all real.

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
3. **ACT 3 (2 min):** Data Extraction - Claude extracts structured data → JSON shown
4. **ACT 4 (2 min):** Report Generation - Download formatted PDF report
5. **ACT 5 (2 min):** AI Query - "What was total coal extracted?" → AI answers
6. **ACT 6 (1 min):** Q&A - Explain architecture to judges

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Streamlit | Pure Python, zero JS, fast development |
| Backend | FastAPI | Async, auto-docs, fast performance |
| AI/LLM | Claude API | Best document analysis, 200K context |
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
├── ai_extractor.py           # Claude API integration
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
| Claude API rate limits | Start with small PDFs, cache responses |
| OCR accuracy | pytesseract + Claude validation |
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
