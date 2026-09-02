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
┌─────────────────────────────────────────────────────────┐
│                    STREAMLIT UI                          │
│  (Upload, View Reports, Query, Analytics, Word Cloud)   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                        │
│  (Upload, Process, Query, Generate Reports)             │
└───────┬──────────────────┬──────────────────┬───────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  DOCUMENT    │  │   CLAUDE     │  │   SQLite     │
│  PROCESSING  │  │   AI API     │  │   DATABASE   │
│ (pypdf +     │  │  (Extract,   │  │  (Storage)   │
│  pytesseract)│  │   Analyze)   │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- pip

### 1. Clone & Setup

```bash
cd mining_report_platform
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env to add your Claude API key (optional - works in demo mode without it)
# Set USE_MOCK_AI=true for demo mode (no API key needed)
```

### 3. Run the System

```bash
# Option A: Run everything with the startup script
python start.py

# Option B: Run backend and frontend separately
# Terminal 1 - Backend
cd mining_report_platform
python -m uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Frontend
cd mining_report_platform
python -m streamlit run app.py --server.port 8501
```

### 4. Access the Application

- **Frontend:** http://localhost:8501
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

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
| `POST` | `/query` | AI-powered query |
| `GET` | `/stats` | System statistics |
| `GET` | `/query-history` | Query history |

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
