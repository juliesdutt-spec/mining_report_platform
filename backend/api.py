"""
FastAPI Backend - AI-Powered Geological & Mining Reporting Solution
SIH26023 - Ministry of Coal - CMPDI/CIL

Endpoints:
- POST /upload - Upload and process PDF reports
- GET /reports - List all reports
- GET /reports/{id} - Get specific report
- DELETE /reports/{id} - Delete a report
- POST /query - AI-powered query on reports
- GET /reports/{id}/download - Download generated PDF report
- GET /reports/{id}/wordcloud - Get word cloud image
"""
import os
import io
import json
import sys
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, get_db, MiningReport, QueryHistory, ValidationResolution
from document_processor import (
    extract_text_from_pdf, extract_pages_from_pdf, chunk_text, get_pdf_metadata
)
from ai_extractor import (
    extract_structured_data, summarize_report, identify_topics,
    query_reports, query_reports_detailed, generate_report_content
)
from report_generator import generate_pdf_report, generate_dossier
from validation_engine import detect_discrepancies
from evidence_locator import locate_evidence
from wordcloud_generator import generate_word_cloud_bytes, extract_topics, get_topic_distribution

# Initialize FastAPI app
app = FastAPI(
    title="AI Mining Report System",
    description="AI-Powered Geological & Mining Reporting Solution - SIH26023",
    version="1.0.0",
)

# CORS. Open by default so local development needs no setup, but a deployed
# backend exposes upload and delete to whoever calls it, so ALLOWED_ORIGINS
# narrows that to the sites you actually serve:
#   ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # No endpoint reads a cookie or an auth header, so credentialed requests
    # are not something to allow - and "*" only means "*" without them.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "message": "AI-Powered Geological & Mining Reporting Solution",
        "problem_id": "SIH26023",
        "ministry": "Ministry of Coal - CMPDI/CIL",
        "status": "running",
        "endpoints": {
            "upload": "POST /upload",
            "reports": "GET /reports",
            "query": "POST /query",
        }
    }


@app.get("/health")
def health_check():
    """
    Liveness, plus which AI provider the backend is actually talking to.

    This is how an operator confirms a configured key took effect without the
    key ever being read back. `ai_mode` names the live provider - "claude",
    "gemini", "openrouter", "ollama" - or "mock" when answers are
    deterministic stand-ins, in which case `ai_mode_reason` says what is
    missing. No key, or any part of one, is ever returned here.
    """
    import ai_providers

    described = ai_providers.describe()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ai_mode": described["mode"],
        "ai_model": described["model"],
        "ai_mode_reason": described["reason"],
        "ai_provider_requested": described["requested"],
        "ai_providers_available": described["available"],
    }


@app.post("/upload")
async def upload_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and process a PDF mining report.
    Extracts text, processes with AI, stores structured data.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        # Read file
        pdf_bytes = await file.read()
        
        # Create report record
        report = MiningReport(
            filename=file.filename,
            status="processing",
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        
        # Step 1: Extract text
        raw_text = extract_text_from_pdf(pdf_bytes, file.filename)
        report.raw_text = raw_text[:50000]  # Limit stored text

        # Keep page boundaries so extracted values can cite a real page number.
        report.page_texts = [p[:20000] for p in extract_pages_from_pdf(pdf_bytes)]
        
        # Step 2: Extract structured data using AI
        extracted = extract_structured_data(raw_text, file.filename)
        report.extracted_data = extracted
        
        # Store individual fields
        report.report_date = extracted.get("report_date")
        report.location = extracted.get("location")
        report.mineral_type = extracted.get("mineral_type")
        report.quantity_extracted = extracted.get("quantity_extracted")
        report.extraction_method = extracted.get("extraction_method")
        report.company_name = extracted.get("company_name")
        report.mine_name = extracted.get("mine_name")
        report.summary = extracted.get("summary")
        report.topics = extracted.get("topics", [])
        
        # Step 3: Generate word cloud
        wc_bytes = generate_word_cloud_bytes(raw_text)
        if wc_bytes:
            wc_path = os.path.join("reports", f"wc_{report.id}.png")
            os.makedirs("reports", exist_ok=True)
            with open(wc_path, "wb") as f:
                f.write(wc_bytes)
            report.word_cloud_path = wc_path
        
        report.status = "completed"
        db.commit()
        db.refresh(report)
        
        return {
            "id": report.id,
            "filename": report.filename,
            "status": report.status,
            "extracted_data": report.extracted_data,
            "word_cloud_available": wc_bytes is not None,
            "message": "Report processed successfully!"
        }
        
    except Exception as e:
        if 'report' in dir():
            report.status = "error"
            report.error_message = str(e)
            db.commit()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.get("/reports")
def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List all mining reports with pagination"""
    reports = db.query(MiningReport).order_by(
        MiningReport.upload_date.desc()
    ).offset(skip).limit(limit).all()
    
    total = db.query(MiningReport).count()
    
    return {
        "total": total,
        "reports": [
            {
                "id": r.id,
                "filename": r.filename,
                "upload_date": r.upload_date.isoformat() if r.upload_date else None,
                "status": r.status,
                "mineral_type": r.mineral_type,
                "location": r.location,
                "quantity_extracted": r.quantity_extracted,
                "summary": r.summary,
                "topics": r.topics,
                # Included so the UI can group and filter by the organisation
                # a report belongs to without fetching each report's detail.
                "company_name": r.company_name,
                "mine_name": r.mine_name,
            }
            for r in reports
        ]
    }


@app.get("/reports/generate")
def generate_dossier_pdf(
    title: str = Query("Consolidated Mining Report Dossier"),
    period: str = Query("All indexed reports"),
    exec_summary: bool = Query(True),
    production_overview: bool = Query(True),
    key_findings: bool = Query(True),
    source_references: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    Compose a dossier PDF across every completed report.

    GET rather than POST: composing a dossier reads existing rows and changes
    nothing, so the URL is linkable and can be used directly as a download href.

    Content is read from stored reports only; a section with no supporting data
    states that rather than being filled in.
    """
    reports = db.query(MiningReport).filter(
        MiningReport.status == "completed"
    ).order_by(MiningReport.id).all()

    pdf_bytes = generate_dossier(
        reports,
        {
            "execSummary": exec_summary,
            "productionOverview": production_overview,
            "keyFindings": key_findings,
            "sourceReferences": source_references,
        },
        title,
        period,
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename=dataforge_dossier.pdf'},
    )


@app.get("/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific report"""
    report = db.query(MiningReport).filter(MiningReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {
        "id": report.id,
        "filename": report.filename,
        "upload_date": report.upload_date.isoformat() if report.upload_date else None,
        "status": report.status,
        "extracted_data": report.extracted_data,
        "report_date": report.report_date,
        "location": report.location,
        "mineral_type": report.mineral_type,
        "quantity_extracted": report.quantity_extracted,
        "extraction_method": report.extraction_method,
        "company_name": report.company_name,
        "mine_name": report.mine_name,
        "summary": report.summary,
        "topics": report.topics,
        "word_cloud_available": report.word_cloud_path is not None,
        "error_message": report.error_message,
        # Passages located in this document's own text; [] when none verify.
        "evidence": locate_evidence(report),
        "page_count": len(report.page_texts or []) or None,
    }


@app.delete("/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db)):
    """Delete a mining report"""
    report = db.query(MiningReport).filter(MiningReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Delete word cloud file if exists
    if report.word_cloud_path and os.path.exists(report.word_cloud_path):
        os.remove(report.word_cloud_path)
    
    db.delete(report)
    db.commit()
    
    return {"message": f"Report {report_id} deleted successfully"}


@app.get("/reports/{report_id}/download")
def download_report(
    report_id: int,
    inline: bool = Query(
        False,
        description="Render in the browser instead of downloading. Used by the "
                    "Documents preview, which embeds this URL.",
    ),
    db: Session = Depends(get_db),
):
    """
    The report as a PDF.

    Serves one document under two dispositions. A browser honours
    `Content-Disposition: attachment` even inside an <object> or <iframe>, so
    an embedded preview pointed at the attachment form downloads a file every
    time it mounts. `inline=true` is what the preview asks for; the download
    buttons keep the default and still save a file.
    """
    report = db.query(MiningReport).filter(MiningReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.extracted_data:
        raise HTTPException(status_code=400, detail="No extracted data available")
    
    # Add filename to extracted data for the report
    data = report.extracted_data.copy()
    data["filename"] = report.filename
    
    pdf_bytes = generate_pdf_report(data)
    disposition = "inline" if inline else "attachment"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f"{disposition}; filename=report_{report.id}_{report.filename}"
            )
        }
    )


@app.get("/reports/{report_id}/wordcloud")
def get_wordcloud(report_id: int, db: Session = Depends(get_db)):
    """Get word cloud image for a report"""
    report = db.query(MiningReport).filter(MiningReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.raw_text:
        raise HTTPException(status_code=400, detail="No text data available")
    
    wc_bytes = generate_word_cloud_bytes(report.raw_text)
    if not wc_bytes:
        raise HTTPException(status_code=400, detail="Could not generate word cloud")
    
    return StreamingResponse(
        io.BytesIO(wc_bytes),
        media_type="image/png",
    )


@app.post("/query")
def query_mining_reports(
    question: str = Query(..., description="Natural language question about mining reports"),
    organisation: str = Query(
        None,
        description="Restrict the answer to reports from this organisation.",
    ),
    db: Session = Depends(get_db)
):
    """
    AI-powered query system. Ask natural language questions about mining reports.

    When `organisation` is given, only that organisation's reports form the
    context, so an answer never draws on documents the user has filtered out.
    """
    try:
        query = db.query(MiningReport).filter(MiningReport.status == "completed")
        if organisation:
            query = query.filter(MiningReport.company_name == organisation)
        reports = query.all()

        if not reports:
            scope = f" for {organisation}" if organisation else ""
            return {
                "question": question,
                "answer": (
                    f"No mining reports found{scope}. "
                    "Please upload some reports first."
                ),
                "reports_used": 0,
            }
        
        # Build context from reports
        context_parts = []
        for r in reports:
            data = r.extracted_data or {}
            context_parts.append(
                f"Report: {r.filename}\n"
                f"Date: {r.report_date}\n"
                f"Location: {r.location}\n"
                f"Mineral: {r.mineral_type}\n"
                f"Quantity: {r.quantity_extracted}\n"
                f"Method: {r.extraction_method}\n"
                f"Summary: {r.summary}\n"
                f"Topics: {', '.join(r.topics or [])}\n"
            )
        
        reports_context = "\n---\n".join(context_parts)
        
        # Query AI. The detailed form also reports which provider answered, so
        # a silent fall back to mock output cannot pass for a real answer.
        result = query_reports_detailed(question, reports_context)
        answer = result["answer"]
        
        # Store query history
        query_record = QueryHistory(
            question=question,
            answer=answer,
            report_ids_used=[r.id for r in reports],
        )
        db.add(query_record)
        db.commit()
        
        # Passages located in the reports this answer drew on, so the client can
        # show where the figures come from. Reports whose values cannot be
        # verified in their own text contribute nothing.
        evidence = []
        for r in reports:
            evidence.extend(locate_evidence(r))

        return {
            "question": question,
            "answer": answer,
            # Which model produced the answer, and - when a configured provider
            # failed - why this is a stand-in instead. The note carries no key:
            # provider errors are scrubbed before they reach here.
            "answer_source": result["source"],
            "answer_note": result["note"],
            "reports_used": len(reports),
            "report_ids": [r.id for r in reports],
            "evidence": evidence,
            "sources": [
                {"id": r.id, "filename": r.filename} for r in reports
            ],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")


@app.get("/stats")
def get_statistics(
    organisation: str = Query(
        None,
        description="Restrict every figure to reports whose company_name matches exactly.",
    ),
    db: Session = Depends(get_db),
):
    """
    Overall statistics about the reports database.

    When `organisation` is given, every count and distribution is scoped to
    that organisation, so a filtered view of the UI never mixes one
    organisation's charts with another's totals.
    """
    from sqlalchemy import func

    def scoped(query):
        if organisation:
            return query.filter(MiningReport.company_name == organisation)
        return query

    total = scoped(db.query(MiningReport)).count()
    completed = scoped(
        db.query(MiningReport).filter(MiningReport.status == "completed")
    ).count()
    errors = scoped(
        db.query(MiningReport).filter(MiningReport.status == "error")
    ).count()

    # Query history is not attributable to an organisation, so it stays global.
    queries = db.query(QueryHistory).count()

    minerals = scoped(
        db.query(MiningReport.mineral_type, func.count(MiningReport.id))
        .filter(MiningReport.status == "completed")
    ).group_by(MiningReport.mineral_type).all()

    locations = scoped(
        db.query(MiningReport.location, func.count(MiningReport.id))
        .filter(MiningReport.status == "completed")
    ).group_by(MiningReport.location).all()

    return {
        "total_reports": total,
        "completed": completed,
        "errors": errors,
        "total_queries": queries,
        "mineral_distribution": {m: c for m, c in minerals if m},
        "location_distribution": {l: c for l, c in locations if l},
    }


@app.get("/validation")
def list_validation_findings(
    organisation: str = Query(
        None,
        description="Only compare reports from this organisation.",
    ),
    db: Session = Depends(get_db),
):
    """
    Cross-document discrepancies computed from the stored reports.

    Findings are derived, not stored: conflicting field values between reports
    about the same mine, duplicate ingests, fields the extractor left empty, and
    failed extractions. Auditor decisions are merged in from
    validation_resolutions by the finding's deterministic id.

    When `organisation` is given, only that organisation's reports are compared,
    so a scoped view never raises a conflict between documents the user has
    filtered out.
    """
    query = db.query(MiningReport)
    if organisation:
        query = query.filter(MiningReport.company_name == organisation)
    reports = query.all()
    findings = detect_discrepancies(reports)

    resolutions = {
        r.finding_id: r for r in db.query(ValidationResolution).all()
    }

    for finding in findings:
        record = resolutions.get(finding["id"])
        finding["status"] = record.status if record else "pending"
        finding["resolutionNote"] = record.resolution_note if record else None
        finding["resolvedAt"] = (
            record.resolved_at.isoformat() if record and record.resolved_at else None
        )

    counts = {
        "total": len(findings),
        "pending": sum(1 for f in findings if f["status"] == "pending"),
        "resolved": sum(1 for f in findings if f["status"] != "pending"),
        "high": sum(1 for f in findings if f["severity"] == "high"),
    }
    return {"counts": counts, "findings": findings}


@app.post("/validation/{finding_id}/resolve")
def resolve_validation_finding(
    finding_id: str,
    status: str = Query("resolved", description="resolved or flagged"),
    note: Optional[str] = Query(None, description="Auditor's resolution note"),
    db: Session = Depends(get_db),
):
    """Record an auditor's decision on a discrepancy."""
    if status not in ("resolved", "flagged", "pending"):
        raise HTTPException(status_code=400, detail="status must be resolved, flagged or pending")

    # The id must correspond to a finding that currently exists.
    valid_ids = {f["id"] for f in detect_discrepancies(db.query(MiningReport).all())}
    if finding_id not in valid_ids:
        raise HTTPException(status_code=404, detail="Finding not found")

    record = db.query(ValidationResolution).filter(
        ValidationResolution.finding_id == finding_id
    ).first()

    if status == "pending":
        # Reopening simply removes the stored decision.
        if record:
            db.delete(record)
            db.commit()
        return {"finding_id": finding_id, "status": "pending"}

    if record:
        record.status = status
        record.resolution_note = note
        record.resolved_at = datetime.utcnow()
    else:
        db.add(ValidationResolution(
            finding_id=finding_id,
            status=status,
            resolution_note=note,
        ))
    db.commit()

    return {"finding_id": finding_id, "status": status, "resolutionNote": note}


@app.get("/query-history")
def get_query_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recent query history"""
    queries = db.query(QueryHistory).order_by(
        QueryHistory.created_at.desc()
    ).limit(limit).all()
    
    return {
        "queries": [
            {
                "id": q.id,
                "question": q.question,
                "answer": q.answer,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
            for q in queries
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
