"""
Document Processing Module
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Pipeline: PDF Upload → Extract Text → OCR (if scanned) → Chunk Text
"""
import io
import os
import re
import shutil
import subprocess
import sys
from typing import List, Optional, Tuple

from pypdf import PdfReader
from PIL import Image

# Try importing pytesseract for OCR; gracefully handle if not installed
try:
    import pytesseract
    OCR_AVAILABLE = True
except (ImportError, OSError):
    OCR_AVAILABLE = False
    print("[WARN] pytesseract not available. OCR for scanned PDFs will be limited.")


#: An explicit path to the tesseract binary, for a host where it is installed
#: but not on PATH. Set it in .env like every other setting here.
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "").strip()

#: Where the Windows installer actually puts tesseract.exe. The UB Mannheim
#: build offers to add itself to PATH and the box is easy to miss, which
#: leaves a machine where tesseract is genuinely installed and nothing can
#: find it. Editing the system PATH and restarting the terminal to fix that is
#: a poor use of anyone's evening when the file is in one of four places.
_WINDOWS_TESSERACT_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
)


def _locate_tesseract() -> Optional[str]:
    """
    Where to find tesseract when PATH cannot, or None to leave PATH to it.

    TESSERACT_CMD is returned even when it points at nothing: a setting that
    is wrong should fail saying what it looked for, not fall through to a
    guess and report a different problem than the one the operator created.
    """
    if shutil.which("tesseract"):
        return None
    if TESSERACT_CMD:
        return TESSERACT_CMD
    if sys.platform.startswith("win"):
        for candidate in _WINDOWS_TESSERACT_PATHS:
            if candidate and os.path.isfile(candidate):
                return candidate
    return None


#: The path OCR is actually using, for ocr_status to report. None means PATH.
_TESSERACT_PATH: Optional[str] = None

if OCR_AVAILABLE:
    _TESSERACT_PATH = _locate_tesseract()
    if _TESSERACT_PATH:
        pytesseract.pytesseract.tesseract_cmd = _TESSERACT_PATH


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


#: Document language, as the labels and the rest of the app spell it, to the
#: tesseract code that reads it. Kept here because the mapping is a property
#: of OCR, not of whoever is asking.
OCR_LANGUAGE_CODES = {"en": "eng", "hi": "hin", "te": "tel"}


def tessdata_dir() -> Optional[str]:
    """
    The folder tesseract reads language data from, as tesseract reports it.

    Worth asking the binary rather than guessing: dropping a .traineddata
    file into the wrong tessdata folder looks exactly like not downloading it
    at all, and there is usually more than one on a machine that has had
    tesseract installed twice. TESSDATA_PREFIX moves it too.
    """
    if not OCR_AVAILABLE:
        return None
    try:
        result = subprocess.run(
            [_TESSERACT_PATH or "tesseract", "--list-langs"],
            capture_output=True, text=True, timeout=30,
        )
    except Exception:  # noqa: BLE001 - no binary, or it would not run
        return None
    text = (result.stdout or "") + (result.stderr or "")

    # The quoted form first, and the capture stops at the closing quote
    # rather than at any colon. A non-greedy match up to ":" reported
    # C:\Program Files\Tesseract-OCR\tessdata as "C" on Windows - it ended
    # at the drive letter - which then went into a generated install command
    # as $dir = "C". A path that is confidently wrong is worse here than
    # none, because the files land somewhere and tesseract still cannot see
    # them.
    match = re.search(r'List of available languages in "([^"]+)"', text)
    if match:
        return match.group(1).strip()

    # Unquoted, for a tesseract build that prints it that way: take the rest
    # of the line and drop a trailing count.
    match = re.search(
        r"List of available languages in (.+?)(?:\s*\(\d+\))?:?\s*$", text, re.M
    )
    return match.group(1).strip() if match else None


def installed_ocr_languages() -> set:
    """Which language codes this host actually holds traineddata for."""
    if not OCR_AVAILABLE:
        return set()
    try:
        return set(pytesseract.get_languages(config=""))
    except Exception:  # noqa: BLE001 - no binary, or too old for get_languages
        return set()


#: Below this many characters on a page, a "text layer" is page furniture - a
#: header, a stamp, a page number - and the body of the page is an image. This
#: is what separates a document that reads itself from one OCR has to carry.
TEXT_LAYER_MIN_CHARS_PER_PAGE = 120


def _text_layer_pages(pdf_bytes: bytes) -> Optional[List[str]]:
    """The raw text layer page by page, or None if the PDF cannot be opened."""
    try:
        import pymupdf
    except ImportError:
        pass
    else:
        try:
            with pymupdf.open(stream=pdf_bytes, filetype="pdf") as document:
                return [page.get_text() or "" for page in document]
        except Exception:  # noqa: BLE001 - fall through to pypdf
            pass

    # pypdf is a hard dependency where pymupdf is effectively optional, so
    # giving up here would call every text-layer document a scan - and then
    # refuse a scoring run over documents that were fine. pypdf reads a little
    # less per page, but nowhere near the threshold's margin: this corpus lands
    # at 1100-1300 characters a page either way, against a cutoff of 120.
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return [(page.extract_text() or "") for page in reader.pages]
    except Exception:  # noqa: BLE001 - an unopenable PDF has no text layer
        return None


def has_usable_text_layer(pdf_bytes: bytes) -> bool:
    """Whether this PDF can be read without OCR, judged by density not presence."""
    layer = _text_layer_pages(pdf_bytes)
    if not layer:
        return False
    return sum(len(t.strip()) for t in layer) / len(layer) >= TEXT_LAYER_MIN_CHARS_PER_PAGE


def page_count(pdf_bytes: bytes) -> int:
    """How many pages this PDF has, or 0 if it cannot be read."""
    layer = _text_layer_pages(pdf_bytes)
    return len(layer) if layer else 0


def ocr_status() -> dict:
    """
    Whether scanned pages can actually be read on this host, and if not, why.

    `import pytesseract` succeeding proves nothing. The module is a thin
    wrapper around a separate binary, and `pip install pytesseract` on a
    machine with no tesseract installs the wrapper alone - so OCR_AVAILABLE
    goes True, image_to_string raises TesseractNotFoundError once per page,
    _ocr_pages catches it and logs a warning that scrolls past, and every
    scanned document extracts to nothing while the run reports success.

    That is the shape of failure this project refuses everywhere else, and it
    was live here: two scanned documents in the evaluation corpus silently
    scored all-missing, which is 20 of 124 fields and a ceiling of 83.9% on a
    number presented as the accuracy of the extractor. Probing the binary is
    the only way to tell a working install from a half one.

    Returns {"ok", "reason", "version", "languages"}.
    """
    if not OCR_AVAILABLE:
        return {
            "ok": False,
            "reason": "the pytesseract package is not installed (pip install pytesseract)",
            "version": None,
            "languages": None,
            "missing_languages": [],
            "path": None,
        }
    try:
        version = str(pytesseract.get_tesseract_version())
    except Exception as exc:  # noqa: BLE001 - TesseractNotFoundError and friends
        looked_in = (
            f"tried {_TESSERACT_PATH!r}" if _TESSERACT_PATH else "not on PATH"
        )
        return {
            "ok": False,
            "reason": (
                "the pytesseract package is installed but the tesseract binary "
                f"it wraps could not be run ({looked_in}; {type(exc).__name__}). "
                + _install_hint()
            ),
            "version": None,
            "languages": None,
            "missing_languages": [],
            "path": _TESSERACT_PATH,
        }
    wanted = {c for c in OCR_LANGUAGES.split("+") if c.strip()}
    absent = sorted(wanted - installed_ocr_languages())
    return {
        "ok": True,
        "reason": None,
        "version": version,
        "languages": _available_ocr_languages(),
        # Present and empty when everything asked for is installed. A host
        # with only `eng` reads a Devanagari scan without complaint and
        # returns Latin nonsense, so "ok" alone does not describe it.
        "missing_languages": absent,
        # Worth reporting: "working" via a guessed Windows path is a different
        # situation from "working" via PATH, and the next person to move the
        # install will care which one this was.
        "path": _TESSERACT_PATH or "on PATH",
    }


def _install_hint() -> str:
    """How to install tesseract here, named for the platform actually running."""
    if sys.platform.startswith("win"):
        return (
            "Install it from https://github.com/UB-Mannheim/tesseract/wiki and tick "
            "Hindi and Telugu under 'Additional language data' during setup. If it "
            "is already installed, you do not have to touch PATH - put the full "
            "path to tesseract.exe in your .env instead, for example:\n"
            "    TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe\n"
            "The standard install locations are checked automatically, so this is "
            "only needed for one somewhere else."
        )
    if sys.platform == "darwin":
        return "Install it with: brew install tesseract tesseract-lang"
    return "Install it with: sudo apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-tel"


def without_nul(text: str) -> str:
    """
    Drop NUL (0x00) bytes from extracted text.

    PostgreSQL stores no NUL in a text value and psycopg2 refuses to send one,
    raising `ValueError: A string literal cannot contain NUL (0x00) characters`
    when the row is flushed - so a single stray 0x00 anywhere in a document
    fails the whole upload at commit time, long after extraction looked fine.

    PDFs produce them readily: a subset-embedded font with a gap in its CID
    map extracts unmapped glyphs as 0x00, which is why a clean-looking annual
    report can carry them while a scan of the same pages does not.

    Dropping is right rather than substituting. A NUL here is the absence of a
    character, not a character - it came from a glyph the extractor could not
    identify, so there is nothing to preserve and no reader who wants it. It
    is also not whitespace, so the tidying elsewhere in the pipeline
    (vector_store._tidy collapses `[ \\t]+`) leaves it in place.

    Applied at the two public extraction entry points below, which is the one
    place every consumer shares: raw_text, page_texts, chunking, the semantic
    index, the extraction prompt, evidence snippets and the evaluation
    harness all read from these two functions.
    """
    return text.replace("\x00", "") if text else text


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
        
        return without_nul(full_text if full_text else _fallback_extraction(pdf_bytes))

    except Exception as e:
        return f"Error extracting text: {str(e)}"


def extract_text_and_pages(pdf_bytes: bytes, filename: str = "") -> Tuple[str, List[str]]:
    """
    Both views of a document - the joined text and the per-page list - from
    one parse and at most one OCR pass.

    An upload needs both: raw_text for extraction and the word cloud,
    page_texts so evidence can cite a page. Calling extract_text_from_pdf and
    then extract_pages_from_pdf gets them and does every expensive thing
    twice - two pypdf parses, and on a scan two full rasterise-and-OCR passes
    at OCR_DPI. Measured on a two-page scan that is 6.7s where 3.9s would do,
    and the waste scales with page count: a hundred-page scan pays it a
    hundred times over, inside a request budget already shared with the model
    call.

    Equivalent to calling both, by construction rather than by hope. Each
    branch below mirrors theirs - including the asymmetry where a pypdf
    failure makes one give up and the other fall through to OCR - and
    _ocr_pdf is itself only "\\n\\n".join of _ocr_pages, so a single OCR pass
    feeds both. tests/test_extraction_single_pass.py asserts the two agree
    character for character over every document in the corpus.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        layer = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:  # noqa: BLE001 - mirrors both functions' handling
        # extract_text_from_pdf gives up here; extract_pages_from_pdf falls
        # through to OCR. Keep both behaviours rather than tidying one away.
        ocr_pages = [without_nul(page) for page in _ocr_pages(pdf_bytes)]
        return f"Error extracting text: {str(exc)}", (ocr_pages if any(ocr_pages) else [])

    # Held unsanitised: extract_text_from_pdf measures this against its
    # 100-character scan threshold before stripping anything.
    joined = "\n\n".join(layer).strip()
    stripped = [without_nul(page.strip()) for page in layer]

    wants_ocr_text = len(joined) < 100 and OCR_AVAILABLE
    wants_ocr_pages = not any(stripped)
    ocr_raw = _ocr_pages(pdf_bytes) if (wants_ocr_text or wants_ocr_pages) else []

    if wants_ocr_text:
        joined = "\n\n".join(page for page in ocr_raw if page).strip()  # == _ocr_pdf
    text = without_nul(joined if joined else _fallback_extraction(pdf_bytes))

    if wants_ocr_pages:
        ocr_pages = [without_nul(page) for page in ocr_raw]
        pages = ocr_pages if any(ocr_pages) else []
    else:
        pages = stripped

    return text, pages


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
        pages = [without_nul((page.extract_text() or "").strip()) for page in reader.pages]
        if any(pages):
            return pages
    except Exception:
        pass
    # Nothing in the text layer: the document is a scan, so read it the same
    # way extract_text_from_pdf does, but keep the page boundaries.
    ocr_pages = [without_nul(page) for page in _ocr_pages(pdf_bytes)]
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
