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
    (for example an unreadable document, or one with no OCR available).
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        if any(pages):
            return pages
    except Exception:
        pass
    # Nothing in the text layer: the document is a scan, so read it the same
    # way extract_text_from_pdf does, but keep the page boundaries.
    ocr_pages = _ocr_pages(pdf_bytes)
    return ocr_pages if any(ocr_pages) else []


#: Rasterisation resolution for OCR. 200 dpi is where Devanagari conjuncts and
#: Telugu vowel signs stop being guessed at; below about 150 they degrade fast.
OCR_DPI = int(os.getenv("OCR_DPI", "200"))


def _ocr_pages(pdf_bytes: bytes) -> List[str]:
    """
    Read a scanned PDF page by page, by rasterising it and running tesseract.

    Rendering is done with PyMuPDF rather than pdf2image: pdf2image shells out
    to poppler's pdftoppm, so it needs a system package on top of the Python
    one. This function used to import it inside a bare `except ImportError:
    pass`, and since pdf2image was never in requirements.txt that import always
    raised - so OCR silently did nothing and every scanned document came back
    as "Could not extract text from this document." The failure is logged now
    rather than swallowed.

    Returns one string per page, so a passage OCR'd out of a scan can still
    cite the page it came from.
    """
    if not OCR_AVAILABLE:
        return []
    try:
        import pymupdf
    except ImportError:
        print("[WARN] pymupdf is not installed; scanned PDFs cannot be rasterised for OCR.")
        return []

    lang = _available_ocr_languages()
    pages: List[str] = []
    doc = None
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            image = Image.open(io.BytesIO(page.get_pixmap(dpi=OCR_DPI).tobytes("png")))
            pages.append(pytesseract.image_to_string(image, lang=lang).strip())
    except Exception as exc:  # noqa: BLE001 - a bad scan must not fail the upload
        print(f"[WARN] OCR failed after {len(pages)} page(s): {exc}")
    finally:
        if doc is not None:
            doc.close()
    return pages


def _ocr_pdf(pdf_bytes: bytes) -> str:
    """Fallback OCR extraction for scanned PDFs, as one string."""
    return "\n\n".join(page for page in _ocr_pages(pdf_bytes) if page).strip()


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
