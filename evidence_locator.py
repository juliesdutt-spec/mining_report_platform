"""
Evidence Locator — anchors extracted values back to the source document.
SIH26023 - AI-Powered Geological & Mining Reporting Solution

The extractor reports values such as "1,25,000 MT" but not where in the
document they came from. This module searches the stored page text for each
value and returns the passage and page number that contain it.

Nothing is synthesised: if a value cannot be located in the document's own
text, no evidence is produced for it. An empty result is a truthful answer.
"""
import re
from typing import Any, Dict, List, Optional

# Extracted fields worth citing, with the label shown in the UI.
CITABLE_FIELDS = [
    ("quantity_extracted", "Quantity extracted"),
    ("reserve_estimate", "Reserve estimate"),
    ("mineral_type", "Mineral type"),
    ("extraction_method", "Extraction method"),
    ("mine_name", "Mine name"),
    ("location", "Location"),
]

# Characters of surrounding context to include either side of a match.
CONTEXT_RADIUS = 220


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _search_variants(value: str) -> List[str]:
    """
    Forms of a value worth searching for.

    Extracted values often differ cosmetically from the document ("1,25,000 MT"
    vs "1,25,000MT"), so a few conservative variants are tried. No variant
    changes the value's meaning.
    """
    value = _normalise(value)
    if not value:
        return []

    variants = [value]

    # Without thousands separators, and the bare number on its own.
    stripped = value.replace(",", "")
    if stripped != value:
        variants.append(stripped)

    number = re.search(r"\d[\d,]*\.?\d*", value)
    if number:
        variants.append(number.group(0))
        bare = number.group(0).replace(",", "")
        if bare != number.group(0):
            variants.append(bare)

    # Longest first: prefer the most specific match.
    return sorted({v for v in variants if len(v) >= 3}, key=len, reverse=True)


def _find_in_pages(pages: List[str], value: str) -> Optional[Dict[str, Any]]:
    """Locate a value in the page text, returning its page and passage."""
    for variant in _search_variants(value):
        pattern = re.compile(re.escape(variant), re.IGNORECASE)
        for index, page_text in enumerate(pages):
            if not page_text:
                continue
            match = pattern.search(page_text)
            if not match:
                continue

            start = max(0, match.start() - CONTEXT_RADIUS)
            end = min(len(page_text), match.end() + CONTEXT_RADIUS)
            passage = _normalise(page_text[start:end])

            # Mark the passage as partial when it was cut mid-document.
            if start > 0:
                passage = "… " + passage
            if end < len(page_text):
                passage = passage + " …"

            return {
                "pageNumber": index + 1,  # pages are 1-indexed for readers
                "originalContext": passage,
                "matchedText": match.group(0),
            }
    return None


def locate_evidence(report: Any) -> List[Dict[str, Any]]:
    """
    Build evidence for one report by finding each extracted value in its text.

    Returns [] when the report has no stored page text (older ingests, or a
    scanned PDF where pagination was lost) — the caller should treat that as
    "no evidence available" rather than substituting anything.
    """
    pages: List[str] = getattr(report, "page_texts", None) or []
    if not pages:
        return []

    extracted = getattr(report, "extracted_data", None) or {}
    snippets: List[Dict[str, Any]] = []

    for field, label in CITABLE_FIELDS:
        value = getattr(report, field, None) or extracted.get(field)
        if not value:
            continue

        location = _find_in_pages(pages, str(value))
        if not location:
            continue  # the value is not verifiable in the source text

        snippets.append({
            "id": f"ev-{report.id}-{field}",
            "documentId": report.id,
            "documentName": report.filename,
            "field": field,
            "sectionHeader": label,
            "extractedValue": str(value),
            "pageNumber": location["pageNumber"],
            "originalContext": location["originalContext"],
        })

    return snippets
