"""
Evidence Locator — anchors extracted values back to the source document.
DataForge - AI-Powered Geological & Mining Reporting Solution

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

    # The first figure with its unit, e.g. "780 million tonnes" out of
    # "Proved reserves: 780 million tonnes, Indicated reserves: 245 million
    # tonnes", which the document never writes as one string.
    with_unit = re.search(
        r"\d[\d,]*\.?\d*\s*(?:million|billion|lakh|crore|thousand)?\s*"
        r"(?:tonnes?|tons?|mtpa|mt|cubic metres|cu\.? ?m)\b",
        value,
        re.IGNORECASE,
    )
    if with_unit:
        variants.append(with_unit.group(0).strip())

    number = re.search(r"\d[\d,]*\.?\d*", value)
    if number:
        variants.append(number.group(0))
        bare = number.group(0).replace(",", "")
        if bare != number.group(0):
            variants.append(bare)

    # Longest first: prefer the most specific match.
    return sorted({v for v in variants if len(v) >= 3}, key=len, reverse=True)


def _digit_tolerant_pattern(variant: str) -> str:
    """
    Build a pattern that ignores how digits are grouped.

    Extracted values and documents disagree on separators — "125000",
    "125,000" and the Indian lakh form "1,25,000" are the same number. Allowing
    optional separators *between digits* matches all three without letting the
    pattern match a different number.
    """
    parts = []
    for i, char in enumerate(variant):
        if char.isdigit():
            if i > 0 and variant[i - 1].isdigit():
                parts.append(r"[,\s]*")
            parts.append(re.escape(char))
        else:
            parts.append(re.escape(char))
    return "".join(parts)


# Words that must appear near a bare number before it counts as evidence for
# a field. A number alone is not a citation: on a real 342-page annual report,
# "780" from a reserve estimate matched a CSR spending passage first, and the
# evidence card quoted it as the reserve figure.
FIELD_CUES = {
    "reserve_estimate": ("reserve", "resource", "भंडार", "निक्षेप", "నిల్వ"),
    "quantity_extracted": ("production", "produced", "extracted", "output", "उत्पादन",
                           "ఉత్పత్తి", "ఉత్పాదన"),
}


def _is_bare_number(variant: str) -> bool:
    return bool(re.fullmatch(r"[\d,.\s]+", variant))


def _find_in_pages(pages: List[str], value: str, field: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Locate a value in the page text, returning its page and passage."""
    cues = FIELD_CUES.get(field or "")
    for variant in _search_variants(value):
        # Digits on either side mean a different number: "780" is not the
        # middle of "17,800".
        before = r"(?<![\d.,])" if variant[0].isdigit() else ""
        after = r"(?![\d])" if variant[-1].isdigit() else ""
        pattern = re.compile(before + _digit_tolerant_pattern(variant) + after, re.IGNORECASE)
        needs_cue = cues is not None and _is_bare_number(variant)
        for index, page_text in enumerate(pages):
            if not page_text:
                continue
            match = None
            for candidate in pattern.finditer(page_text):
                if needs_cue:
                    window = page_text[max(0, candidate.start() - CONTEXT_RADIUS):candidate.end() + CONTEXT_RADIUS].casefold()
                    if not any(cue.casefold() in window for cue in cues):
                        continue
                match = candidate
                break
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

        location = _find_in_pages(pages, str(value), field)
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
