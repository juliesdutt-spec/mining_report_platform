"""
Document Processing Module
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Pipeline: PDF Upload → Extract Text → OCR (if scanned) → Chunk Text
"""
import io
import os
from typing import List, Tuple

from pypdf import PdfReader
from PIL import Image

# Try importing pytesseract for OCR; gracefully handle if not installed
try:
    import pytesseract
    OCR_AVAILABLE = True
except (ImportError, OSError):
    OCR_AVAILABLE = False
    print("[WARN] pytesseract not available. OCR for scanned PDFs will be limited.")


# Which languages OCR should look for, as tesseract language codes joined by
# "+". A scanned Hindi page read as English does not fail - it returns
# confident nonsense, Devanagari guessed at through a Latin model, which then
# flows into extraction and answers as if it were text. English stays first
# so mixed CMPDI documents, which are the norm, keep their current behaviour.
#
# Each language needs its traineddata installed on the host
# (tesseract-ocr-hin, tesseract-ocr-tel); a code with no traineddata makes tesseract
# fail outright, so an unavailable one is dropped rather than passed on.
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "eng+hin+tel")
_ocr_langs_checked = None


def _available_ocr_languages() -> str:
    """OCR_LANGUAGES narrowed to what this host can actually read."""
    global _ocr_langs_checked
    if _ocr_langs_checked is not None:
        return _ocr_langs_checked

    wanted = [c for c in OCR_LANGUAGES.split("+") if c.strip()]
    try:
        installed = set(pytesseract.get_languages(config=""))
    except Exception:
        # No binary, or a version without get_languages. Ask for English only:
        # it is the one language a tesseract install is almost certain to have.
        _ocr_langs_checked = "eng"
        return _ocr_langs_checked

    usable = [c for c in wanted if c in installed]
    missing = [c for c in wanted if c not in installed]
    if missing:
        print(
            f"[WARN] OCR language data missing for {'+'.join(missing)}; "
            f"scanned pages in those languages will not read correctly. "
            f"Install tesseract-ocr-{missing[0]} to fix."
        )
    _ocr_langs_checked = "+".join(usable) or "eng"
    return _ocr_langs_checked


def extract_text_from_pdf(pdf_bytes: bytes, filename: str = "") -> str:
    """
    Extract text from a PDF file.
    First tries pypdf for native text extraction.
    Falls back to OCR if little/no text is found (scanned document).
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
        
        full_text = "\n\n".join(text_parts).strip()
        
        # If very little text extracted, try OCR
        if len(full_text) < 100 and OCR_AVAILABLE:
            full_text = _ocr_pdf(pdf_bytes)
        
        return full_text if full_text else _fallback_extraction(pdf_bytes)
        
    except Exception as e:
        return f"Error extracting text: {str(e)}"


def extract_pages_from_pdf(pdf_bytes: bytes) -> List[str]:
    """
    Extract text per page, preserving page boundaries.

    extract_text_from_pdf joins pages into one string, which loses the page a
    passage came from. Keeping the per-page list lets evidence cite a real page
    number instead of guessing one. Returns [] when the PDF yields no text
    (for example a scanned document handled by OCR, which is not paginated).
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        return pages if any(pages) else []
    except Exception:
        return []


def _ocr_pdf(pdf_bytes: bytes) -> str:
    """
    Fallback OCR extraction for scanned PDFs.
    Converts PDF pages to images, then runs pytesseract.
    """
    try:
        import subprocess
        import tempfile
        
        # Write PDF to temp file for processing
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        
        text_parts = []
        
        # Try using pdf2image if available, otherwise skip
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(pdf_bytes, dpi=200)
            lang = _available_ocr_languages()
            for img in images:
                page_text = pytesseract.image_to_string(img, lang=lang)
                text_parts.append(page_text)
        except ImportError:
            # Direct image OCR not available without pdf2image
            pass
        finally:
            os.unlink(tmp_path)
        
        return "\n\n".join(text_parts).strip()
        
    except Exception:
        return ""


def _fallback_extraction(pdf_bytes: bytes) -> str:
    """Last resort: try to get any metadata or basic info from the PDF"""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        info = reader.metadata
        if info:
            return f"PDF Metadata: {info}"
    except Exception:
        pass
    return "Could not extract text from this document."


def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> List[str]:
    """
    Split text into chunks for Claude API processing.
    Uses sentence-aware chunking to avoid breaking mid-sentence.
    """
    if not text or not text.strip():
        return []
    
    # Split by paragraphs first
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        if len(current_chunk) + len(para) > chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                # Keep overlap
                words = current_chunk.split()
                overlap_words = words[-overlap // 6:] if len(words) > overlap // 6 else []
                current_chunk = " ".join(overlap_words) + "\n\n" + para
            else:
                # Single paragraph larger than chunk_size - split by sentences
                sentences = para.replace(". ", ".\n").split("\n")
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) > chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                    else:
                        current_chunk += " " + sentence if current_chunk else sentence
        else:
            current_chunk += "\n\n" + para if current_chunk else para
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks if chunks else [text[:chunk_size]]


def get_pdf_metadata(pdf_bytes: bytes) -> dict:
    """Extract PDF metadata"""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        info = reader.metadata
        return {
            "pages": len(reader.pages),
            "title": info.title if info and info.title else "Unknown",
            "author": info.author if info and info.author else "Unknown",
            "subject": info.subject if info and info.subject else "Unknown",
        }
    except Exception:
        return {"pages": 0, "title": "Unknown", "author": "Unknown", "subject": "Unknown"}
