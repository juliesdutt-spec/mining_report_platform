"""
PDF Report Generator
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Generates formatted PDF reports from extracted mining data.
"""
import io
import os
import re
from datetime import datetime

try:
    from fpdf import FPDF
    FPDF_AVAILABLE = True
except ImportError:
    FPDF_AVAILABLE = False


# Text that a PDF must carry comes out of uploaded documents and out of a
# language model, so it is not ASCII and cannot be assumed to be. fpdf2's
# built-in fonts - Helvetica among them - encode latin-1 only, and raise on
# anything outside it. An em dash or a curly quote is enough, and both appear
# constantly in generated summaries; so does the rupee sign in Indian mining
# figures. Every one of those crashed the download with a 500.
#
# DejaVu covers all of them and ships inside matplotlib, which is already a
# dependency here for word clouds - so this needs no font file in the
# repository and no new package. Registration is attempted once; if it fails
# for any reason the document still renders, in Helvetica, with unsupported
# characters replaced rather than raising.
UNICODE_FAMILY = "DejaVu"
_UNICODE_FONT_READY = None  # None = not yet attempted

# DejaVu is broad but it is not universal: it carries no Devanagari at all, so
# a Hindi report rendered with it loses every character of the mine name and
# the summary. That failure is silent - fpdf2 warns and writes nothing, the
# download still returns 200, and the document simply arrives with holes in
# it, which is worse than the crash the DejaVu work replaced.
#
# Noto Sans Devanagari covers the script and ships in this repository under
# the OFL. It is registered as a *fallback* rather than a second primary font,
# so a document mixing English and Hindi - the normal case for CMPDI
# reporting - renders correctly with no per-string script detection.
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def needs_shaping(*values) -> bool:
    """
    True when any of these strings contains Devanagari.

    Shaping is switched on per document rather than globally for two reasons.
    It roughly doubles render time, and it defeats alias_nb_pages: that works
    by substituting the literal "{nb}" in the content stream, which the shaper
    has already turned into glyph ids, so the placeholder survives into the
    finished PDF. An English report therefore keeps both its speed and its
    "Page 1/3" footer exactly as before, and only a Hindi document - which is
    unreadable without shaping - trades the total away for correct text.
    """
    return any(_DEVANAGARI_RE.search(str(v)) for v in values if v)


DEVANAGARI_FAMILY = "NotoDevanagari"
_FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "fonts")
_DEVANAGARI_FONT_READY = None
_SHAPING_READY = None


def _register_unicode_font(pdf) -> bool:
    """Attach DejaVu to this document, reporting whether it is usable."""
    global _UNICODE_FONT_READY
    if _UNICODE_FONT_READY is False:
        return False

    try:
        import matplotlib

        ttf = os.path.join(matplotlib.get_data_path(), "fonts", "ttf")
        faces = {
            "": "DejaVuSans.ttf",
            "B": "DejaVuSans-Bold.ttf",
            "I": "DejaVuSans-Oblique.ttf",
            "BI": "DejaVuSans-BoldOblique.ttf",
        }
        for style, filename in faces.items():
            path = os.path.join(ttf, filename)
            if not os.path.exists(path):
                raise FileNotFoundError(path)
            pdf.add_font(UNICODE_FAMILY, style, path)
    except Exception as exc:
        if _UNICODE_FONT_READY is None:
            print(f"Unicode PDF font unavailable ({exc}); falling back to Helvetica.")
        _UNICODE_FONT_READY = False
        return False

    _UNICODE_FONT_READY = True
    return True


def _register_devanagari_font(pdf) -> bool:
    """Attach Noto Sans Devanagari, reporting whether it is usable."""
    global _DEVANAGARI_FONT_READY
    if _DEVANAGARI_FONT_READY is False:
        return False

    try:
        for style, filename in {
            "": "NotoSansDevanagari-Regular.ttf",
            "B": "NotoSansDevanagari-Bold.ttf",
        }.items():
            path = os.path.join(_FONT_DIR, filename)
            if not os.path.exists(path):
                raise FileNotFoundError(path)
            pdf.add_font(DEVANAGARI_FAMILY, style, path)
    except Exception as exc:
        if _DEVANAGARI_FONT_READY is None:
            print(f"Devanagari PDF font unavailable ({exc}); Hindi text will not render.")
        _DEVANAGARI_FONT_READY = False
        return False

    _DEVANAGARI_FONT_READY = True
    return True


def _enable_text_shaping(pdf) -> bool:
    """
    Turn on the shaping engine, without which Devanagari is quietly wrong.

    Having the glyphs is not the same as placing them. Devanagari reorders at
    render time: the i-matra in "रिपोर्ट" is stored after its consonant and
    drawn before it, and "र" before a consonant becomes a reph drawn above the
    next one. Mapping codepoints to glyphs in logical order - fpdf2's
    behaviour with no shaping engine - renders those as "रपिोर्ट", which is
    not a spelling variant but a different, unreadable string.

    It is a silent failure in the worst way: it raises nothing, warns nothing,
    and looks like plausible Devanagari to a reader who does not read
    Devanagari. Hence uharfbuzz as a hard dependency rather than an extra.
    """
    global _SHAPING_READY
    if _SHAPING_READY is False:
        return False
    try:
        pdf.set_text_shaping(True)
    except Exception as exc:
        if _SHAPING_READY is None:
            print(
                f"Text shaping unavailable ({exc}); Devanagari will render with "
                "misplaced vowel signs. Install uharfbuzz."
            )
        _SHAPING_READY = False
        return False
    _SHAPING_READY = True
    return True


def _latin1_safe(text) -> str:
    """
    Make text renderable by a latin-1 core font.

    Only used when DejaVu could not be registered. Replacing a character is a
    visible loss; raising would lose the whole document.
    """
    return str(text).encode("latin-1", "replace").decode("latin-1")


class _UnicodePDF(FPDF):
    """
    An FPDF that renders text instead of raising on it.

    Two seams, so the rest of this module keeps asking for "Helvetica" and does
    not need to know which font is actually available:

    set_font redirects the built-in latin-1 families to DejaVu when it loaded.
    normalize_text runs on every string fpdf2 writes, and is where a document
    that had to fall back replaces unsupported characters - a visible loss on
    one character, rather than a 500 that loses the whole download.
    """

    _CORE_FAMILIES = {"helvetica", "arial", "times", "courier"}

    def __init__(self, *args, shape_text: bool = False, **kwargs):
        super().__init__(*args, **kwargs)
        self._shaping_on = False
        self._unicode_ok = _register_unicode_font(self)
        if self._unicode_ok and _register_devanagari_font(self):
            # exact_match=False so that italic Hindi falls back to the regular
            # Devanagari face rather than to nothing: only two styles are
            # registered, and a missing glyph is the failure being fixed here.
            self.set_fallback_fonts([DEVANAGARI_FAMILY], exact_match=False)
            if shape_text:
                self._shaping_on = _enable_text_shaping(self)

    def set_font(self, family=None, style="", size=0):
        if self._unicode_ok and family and family.lower() in self._CORE_FAMILIES:
            family = UNICODE_FAMILY
        return super().set_font(family, style, size)

    def normalize_text(self, text):
        if self._unicode_ok:
            return super().normalize_text(text)
        return super().normalize_text(_latin1_safe(text))

class MiningReportPDF(_UnicodePDF):
    """Custom PDF class for mining reports"""
    
    def header(self):
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 10, "AI-Powered Geological & Mining Report", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.cell(0, 6, "Problem ID: SIH26023 | Ministry of Coal | CMPDI/CIL", align="C", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
    
    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        total = "" if self._shaping_on else "/{nb}"
        self.cell(
            0, 10,
            f"Generated: {datetime.now().strftime('%d-%m-%Y %H:%M')} | Page {self.page_no()}{total}",
            align="C",
        )
    
    def section_title(self, title):
        self.set_font("Helvetica", "B", 11)
        self.set_fill_color(240, 240, 240)
        self.cell(0, 8, title, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
    
    def field_row(self, label, value):
        if value:
            self.set_font("Helvetica", "B", 10)
            self.cell(50, 7, f"{label}:", new_x="END")
            self.set_font("Helvetica", "", 10)
            self.multi_cell(0, 7, str(value), new_x="LMARGIN", new_y="NEXT")
    
    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)


def generate_pdf_report(extracted_data: dict, filename: str = "mining_report.pdf") -> bytes:
    """
    Generate a formatted PDF report from extracted mining data.
    Returns the PDF as bytes for download.
    """
    if not FPDF_AVAILABLE:
        return _generate_text_report(extracted_data)
    
    pdf = MiningReportPDF(shape_text=needs_shaping(*extracted_data.values()))
    if not pdf._shaping_on:
        pdf.alias_nb_pages()
    pdf.add_page()
    
    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 12, "Mining Report Analysis", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 8, f"Source: {extracted_data.get('filename', 'Uploaded Document')}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    
    # Mine Details
    pdf.section_title("MINE DETAILS")
    pdf.field_row("Report Date", extracted_data.get("report_date"))
    pdf.field_row("Location", extracted_data.get("location"))
    pdf.field_row("State", extracted_data.get("state"))
    pdf.field_row("District", extracted_data.get("district"))
    pdf.field_row("Mine Name", extracted_data.get("mine_name"))
    pdf.field_row("Company", extracted_data.get("company_name"))
    pdf.field_row("Area", extracted_data.get("area_sq_km"))
    pdf.ln(3)
    
    # Extraction Details
    pdf.section_title("EXTRACTION DETAILS")
    pdf.field_row("Mineral Type", extracted_data.get("mineral_type"))
    pdf.field_row("Quantity Extracted", extracted_data.get("quantity_extracted"))
    pdf.field_row("Extraction Method", extracted_data.get("extraction_method"))
    pdf.field_row("Reserve Estimate", extracted_data.get("reserve_estimate"))
    pdf.field_row("Financial Data", extracted_data.get("financial_data"))
    pdf.ln(3)
    
    # Summary
    pdf.section_title("EXECUTIVE SUMMARY")
    summary = extracted_data.get("summary", "No summary available.")
    pdf.body_text(summary)
    
    # Key Findings
    key_findings = extracted_data.get("key_findings", [])
    if key_findings:
        pdf.section_title("KEY FINDINGS")
        for i, finding in enumerate(key_findings, 1):
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(8, 6, f"{i}.", new_x="END")
            pdf.multi_cell(0, 6, str(finding), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
    
    # Topics
    topics = extracted_data.get("topics", [])
    if topics:
        pdf.section_title("IDENTIFIED TOPICS")
        pdf.body_text(", ".join(topics))
    
    # Minerals & Locations
    minerals = extracted_data.get("minerals_mentioned", [])
    locations = extracted_data.get("locations_mentioned", [])
    if minerals or locations:
        pdf.section_title("ADDITIONAL REFERENCES")
        if minerals:
            pdf.field_row("Minerals", ", ".join(minerals))
        if locations:
            pdf.field_row("Locations", ", ".join(locations))
        pdf.ln(3)
    
    # Environmental Notes
    env_notes = extracted_data.get("environmental_notes")
    if env_notes:
        pdf.section_title("ENVIRONMENTAL NOTES")
        pdf.body_text(env_notes)
    
    # Footer note
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 5, 
        "This report was automatically generated by the AI-Powered Geological & Mining "
        "Reporting System developed for Smart India Hackathon 2026 (SIH26023). "
        "Data accuracy depends on source document quality.",
        new_x="LMARGIN", new_y="NEXT"
    )
    
    # Get PDF bytes
    pdf_output = pdf.output()
    if isinstance(pdf_output, str):
        return pdf_output.encode("latin-1")
    return bytes(pdf_output)


def _generate_text_report(extracted_data: dict) -> bytes:
    """Fallback: generate a plain text report if fpdf2 is not available"""
    lines = []
    lines.append("=" * 60)
    lines.append("AI-POWERED GEOLOGICAL & MINING REPORT")
    lines.append("Problem ID: SIH26023 | Ministry of Coal | CMPDI/CIL")
    lines.append("=" * 60)
    lines.append("")
    
    sections = [
        ("MINE DETAILS", [
            ("Report Date", extracted_data.get("report_date")),
            ("Location", extracted_data.get("location")),
            ("State", extracted_data.get("state")),
            ("District", extracted_data.get("district")),
            ("Mine Name", extracted_data.get("mine_name")),
            ("Company", extracted_data.get("company_name")),
        ]),
        ("EXTRACTION DETAILS", [
            ("Mineral Type", extracted_data.get("mineral_type")),
            ("Quantity Extracted", extracted_data.get("quantity_extracted")),
            ("Extraction Method", extracted_data.get("extraction_method")),
            ("Reserve Estimate", extracted_data.get("reserve_estimate")),
        ]),
    ]
    
    for section_title, fields in sections:
        lines.append(f"\n--- {section_title} ---")
        for label, value in fields:
            if value:
                lines.append(f"{label}: {value}")
    
    summary = extracted_data.get("summary")
    if summary:
        lines.append(f"\n--- SUMMARY ---\n{summary}")
    
    key_findings = extracted_data.get("key_findings", [])
    if key_findings:
        lines.append("\n--- KEY FINDINGS ---")
        for i, f in enumerate(key_findings, 1):
            lines.append(f"{i}. {f}")
    
    lines.append("\n" + "=" * 60)
    lines.append("Generated by: AI-Powered Geological & Mining Reporting System")
    
    return "\n".join(lines).encode("utf-8")


def generate_dossier(reports: list, sections: dict, title: str, period: str) -> bytes:
    """
    Compose a multi-document dossier from the reports actually in the database.

    `reports` are MiningReport rows; `sections` toggles which parts to include.
    Every figure is read from a stored report — nothing is generated to fill a
    section. A section with no supporting data says so rather than inventing
    content.
    """
    if not FPDF_AVAILABLE:
        return _generate_text_report({"summary": "PDF generation unavailable (fpdf2 not installed)."})

    # Any Devanagari anywhere in the dossier - a single Hindi mine name is
    # enough - decides shaping for the whole document.
    dossier_text = [title, period]
    for report in reports:
        dossier_text.extend(
            str(getattr(report, field, "") or "")
            for field in (
                "mine_name", "location", "mineral_type", "extraction_method",
                "quantity_extracted", "reserve_estimate", "summary",
                "company_name", "filename",
            )
        )

    pdf = MiningReportPDF(shape_text=needs_shaping(*dossier_text))
    if not pdf._shaping_on:
        pdf.alias_nb_pages()
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.multi_cell(0, 12, title, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 7, f"Reporting period: {period}", align="C", new_x="LMARGIN", new_y="NEXT")
    # The period is a filing caption chosen by the operator - uploaded reports
    # rarely carry a parseable date, so it selects nothing. Stating the real
    # basis stops the caption from implying the corpus was filtered by it.
    pdf.cell(
        0, 7,
        f"Documents included: {len(reports)} (all completed reports indexed at generation)",
        align="C", new_x="LMARGIN", new_y="NEXT",
    )
    pdf.ln(6)

    if not reports:
        pdf.section_title("NO DATA")
        pdf.body_text(
            "No completed reports are present in the database, so this dossier "
            "contains no figures. Upload and process documents first."
        )
        return bytes(pdf.output())

    if sections.get("execSummary", True):
        pdf.section_title("1. EXECUTIVE SUMMARY")
        minerals = sorted({r.mineral_type for r in reports if r.mineral_type})
        locations = sorted({r.location for r in reports if r.location})
        pdf.body_text(
            f"This dossier consolidates {len(reports)} indexed report(s). "
            f"Minerals recorded: {', '.join(minerals) if minerals else 'none recorded'}. "
            f"Locations referenced: {', '.join(locations) if locations else 'none recorded'}."
        )

    if sections.get("productionOverview", True):
        pdf.section_title("2. PRODUCTION OVERVIEW")
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(70, 7, "Document", border=1)
        pdf.cell(40, 7, "Mineral", border=1)
        pdf.cell(40, 7, "Quantity", border=1)
        pdf.cell(40, 7, "Method", border=1, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 8)
        for r in reports:
            pdf.cell(70, 6, (r.filename or "")[:42], border=1)
            pdf.cell(40, 6, (r.mineral_type or "-")[:22], border=1)
            pdf.cell(40, 6, (r.quantity_extracted or "-")[:22], border=1)
            pdf.cell(40, 6, (r.extraction_method or "-")[:22], border=1, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    if sections.get("keyFindings", True):
        pdf.section_title("3. KEY FINDINGS")
        found = False
        for r in reports:
            findings = (r.extracted_data or {}).get("key_findings") or []
            if not findings:
                continue
            found = True
            pdf.set_font("Helvetica", "B", 9)
            pdf.multi_cell(0, 6, r.filename, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for finding in findings:
                pdf.multi_cell(0, 5, f"  - {finding}", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
        if not found:
            pdf.body_text("No key findings were extracted from the indexed documents.")

    if sections.get("sourceReferences", True):
        pdf.section_title("4. SOURCE REFERENCES")
        pdf.set_font("Helvetica", "", 9)
        for r in reports:
            pages = len(r.page_texts or []) if getattr(r, "page_texts", None) else None
            suffix = f" ({pages} pages)" if pages else ""
            pdf.multi_cell(0, 5, f"  [{r.id}] {r.filename}{suffix}", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())

# ==================== DOCX DOSSIER ====================

try:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


class DocxUnavailable(RuntimeError):
    """python-docx is not installed, so no .docx can be produced."""


def generate_dossier_docx(reports: list, sections: dict, title: str, period: str) -> bytes:
    """
    The same dossier as generate_dossier, as a Word document.

    Section-for-section identical to the PDF - same figures, same wording, same
    "no supporting data" statements - so the two exports cannot disagree about
    what the corpus contains. Only the container differs.

    Raises DocxUnavailable rather than returning a placeholder file: a .docx
    that will not open in Word is worse than an error the caller can report.
    """
    if not DOCX_AVAILABLE:
        raise DocxUnavailable("python-docx is not installed")

    document = Document()

    heading = document.add_paragraph()
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = heading.add_run(title)
    run.bold = True
    run.font.size = Pt(18)

    for line in (
        f"Reporting period: {period}",
        # Same basis statement as the PDF, so the two cannot disagree about
        # what the dossier actually covers.
        f"Documents included: {len(reports)} (all completed reports indexed at generation)",
    ):
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.add_run(line).font.size = Pt(10)

    if not reports:
        document.add_heading("NO DATA", level=1)
        document.add_paragraph(
            "No completed reports are present in the database, so this dossier "
            "contains no figures. Upload and process documents first."
        )
        return _docx_bytes(document)

    if sections.get("execSummary", True):
        document.add_heading("1. EXECUTIVE SUMMARY", level=1)
        minerals = sorted({r.mineral_type for r in reports if r.mineral_type})
        locations = sorted({r.location for r in reports if r.location})
        document.add_paragraph(
            f"This dossier consolidates {len(reports)} indexed report(s). "
            f"Minerals recorded: {', '.join(minerals) if minerals else 'none recorded'}. "
            f"Locations referenced: {', '.join(locations) if locations else 'none recorded'}."
        )

    if sections.get("productionOverview", True):
        document.add_heading("2. PRODUCTION OVERVIEW", level=1)
        table = document.add_table(rows=1, cols=4)
        table.style = "Table Grid"
        for cell, label in zip(
            table.rows[0].cells, ("Document", "Mineral", "Quantity", "Method")
        ):
            cell.text = label
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.bold = True
        for report in reports:
            cells = table.add_row().cells
            cells[0].text = report.filename or ""
            cells[1].text = report.mineral_type or "-"
            cells[2].text = report.quantity_extracted or "-"
            cells[3].text = report.extraction_method or "-"

    if sections.get("keyFindings", True):
        document.add_heading("3. KEY FINDINGS", level=1)
        found = False
        for report in reports:
            findings = (report.extracted_data or {}).get("key_findings") or []
            if not findings:
                continue
            found = True
            document.add_paragraph(report.filename).runs[0].bold = True
            for finding in findings:
                document.add_paragraph(str(finding), style="List Bullet")
        if not found:
            document.add_paragraph(
                "No key findings were extracted from the indexed documents."
            )

    if sections.get("sourceReferences", True):
        document.add_heading("4. SOURCE REFERENCES", level=1)
        for report in reports:
            pages = len(report.page_texts or []) if getattr(report, "page_texts", None) else None
            suffix = f" ({pages} pages)" if pages else ""
            document.add_paragraph(f"[{report.id}] {report.filename}{suffix}")

    return _docx_bytes(document)


def _docx_bytes(document) -> bytes:
    """Serialise a python-docx Document to bytes without touching disk."""
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
