"""
Validation Engine — cross-document discrepancy detection.
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Findings are derived only from data the extractor actually produced. Nothing
here invents confidence scores, page numbers or synthetic conflicts: if the
database does not support a claim, the claim is not made.

Four kinds of finding, all computed from stored reports:
  conflict    - two reports describing the same mine disagree on a field
  duplicate   - the same document (or same mine and reporting date) ingested twice
  missing     - a completed report is missing a field the extractor should fill
  error       - extraction failed outright for a report
"""
import re
from typing import Any, Dict, List, Optional

# Fields compared across reports about the same mine, and whether the value is
# expected to change between reporting periods.
#
# Production and reserves do change: a mine that extracted 45,000 t in Q1 and
# 52,000 t in Q2 is not contradicting itself, and reporting that as a conflict
# is a false alarm on the most ordinary pair of documents a corpus can hold.
# What a mine produces and how it is worked do not vary by quarter, so those
# stay comparable across periods - a report calling a mine coal and another
# calling it iron ore disagree whenever they were written.
COMPARABLE_FIELDS = [
    ("quantity_extracted", "Quantity extracted", "high", True),
    ("reserve_estimate", "Reserve estimate", "high", True),
    ("extraction_method", "Extraction method", "medium", False),
    ("mineral_type", "Mineral type", "medium", False),
]

# Fields a completed extraction is expected to populate.
REQUIRED_FIELDS = [
    ("mineral_type", "Mineral type"),
    ("quantity_extracted", "Quantity extracted"),
    ("location", "Location"),
]


def _norm(value: Optional[str]) -> str:
    """Normalise for comparison: trim, collapse whitespace, casefold."""
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


# Period labels that sit in front of the figure they describe. Extracted values
# arrive as free text, so "Q1 2026: 45,000 t" is an ordinary shape - and the
# first number in it is the 1 of "Q1", not the quantity. Two such values were
# compared as 1 against 1 and agreed, so the real disagreement between 45,000
# and 46,000 was never reported.
_PERIOD_LABEL = re.compile(
    r"""(?ix)
    \b(?:
        q[1-4]                              # Q1, Q4
      | (?:fy|ay)\s*[-/]?\s*\d{2,4}         # FY2026, FY 25-26
      | h[12]                               # H1, H2
      | (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*
    )
    \s*[-/]?\s*
    (?:                                     # an optional year, or year range
        \d{4}\s*[-/]\s*\d{2,4}(?![\d,])     # 2025-26, but not "2025 - 46,000"
      | \d{2,4}(?![\d,])
    )?
    """,
)


def _numeric(value: Optional[str]) -> Optional[float]:
    """
    The quantity a value states, ignoring any period label in front of it.

    '52.50 MT' and '52.5 MT' are the same figure; 'Q1 2026: 45,000 t' is 45,000
    rather than 1. Period labels are stripped rather than guessed at by size -
    a rule like "take the largest number" would read a reserve stated as
    "500 MT over 2026-2030" as 2030.
    """
    if not value:
        return None

    text = _fold_digits(str(value))
    without_period = text
    for pattern in (_PERIOD_LABEL, _PERIOD_LABEL_HI, _PERIOD_LABEL_TE):
        without_period = pattern.sub(" ", without_period)
    if without_period != text:
        # A period label was present. What remains is the figure it described -
        # and if nothing remains, the value stated a period and no quantity.
        if not re.search(r"\d", without_period):
            return None
        text = without_period

    match = re.search(r"[-+]?\d[\d,]*\.?\d*", text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def _values_conflict(a: Optional[str], b: Optional[str]) -> bool:
    """True when two reported values genuinely disagree."""
    if not a or not b:
        return False
    if _norm(a) == _norm(b):
        return False

    num_a, num_b = _numeric(a), _numeric(b)
    if num_a is not None and num_b is not None:
        # Same magnitude written differently is not a conflict.
        if abs(num_a - num_b) < 1e-9:
            return False
        larger = max(abs(num_a), abs(num_b)) or 1.0
        # Ignore sub-1% differences, which are rounding rather than disagreement.
        return abs(num_a - num_b) / larger >= 0.01

    return True


def _field_of(report: Any, field: str) -> Optional[str]:
    """Read a field from the column, falling back to the extracted JSON."""
    value = getattr(report, field, None)
    if value:
        return str(value)
    extracted = getattr(report, "extracted_data", None) or {}
    value = extracted.get(field)
    return str(value) if value else None


# Reporting periods, as they appear in extracted text: "2026-03-01", "Q1 2026",
# "March 2026", "FY2026", a bare year.
# Indic digits are matched by \d and understood by int(), but not by a
# pattern like (?:19|20)\d{2} - "२०२६" and "౨౦౨౬" are years and never look
# like one. Folding them to ASCII once lets every pattern below stay as it is.
_INDIC_DIGITS = str.maketrans(
    "०१२३४५६७८९" "౦౧౨౩౪౫౬౭౮౯",
    "0123456789" "0123456789",
)


def _fold_digits(text: str) -> str:
    return text.translate(_INDIC_DIGITS)


# Hindi period vocabulary, kept as its own pattern rather than folded into the
# English one, because \b is not usable in Devanagari: word boundaries are
# defined by \w, matras are not \w, so \b fires *inside* "तिमाही" between
# त and ि. These words are distinctive enough not to need the anchor.
_HI_ORDINAL = (
    "पहली|पहला|प्रथम|दूसरी|दूसरा|द्वितीय|"
    "तीसरी|तीसरा|तृतीय|चौथी|चौथा|चतुर्थ"
)
_HI_MONTHS = {
    "जनवरी": 1, "फरवरी": 2, "मार्च": 3, "अप्रैल": 4, "मई": 5, "जून": 6,
    "जुलाई": 7, "अगस्त": 8, "सितंबर": 9, "सितम्बर": 9, "अक्टूबर": 10,
    "नवंबर": 11, "नवम्बर": 11, "दिसंबर": 12, "दिसम्बर": 12,
}
_HI_PERIOD_WORD = (
    rf"(?:{_HI_ORDINAL})\s*तिमाही"
    r"|तिमाही\s*[1-4]?"
    r"|(?:वित्त|वित्तीय)\s*वर्ष"
    r"|छमाही|अर्धवार्षिक"
    rf"|{'|'.join(_HI_MONTHS)}"
)
_PERIOD_LABEL_HI = re.compile(
    rf"(?:{_HI_PERIOD_WORD})"
    r"\s*[-/]?\s*"
    r"(?:\d{4}\s*[-/]\s*\d{2,4}(?![\d,])|\d{2,4}(?![\d,]))?"
)

# "पहली तिमाही" / "तिमाही 2" -> the quarter number.
_HI_QUARTER_ORDINAL = re.compile(rf"({_HI_ORDINAL})\s*तिमाही")
_HI_QUARTER_NUMBER = re.compile(r"तिमाही\s*([1-4])")
_HI_ORDINAL_VALUE = {
    "पहली": 1, "पहला": 1, "प्रथम": 1,
    "दूसरी": 2, "दूसरा": 2, "द्वितीय": 2,
    "तीसरी": 3, "तीसरा": 3, "तृतीय": 3,
    "चौथी": 4, "चौथा": 4, "चतुर्थ": 4,
}
_HI_MONTH_NAME = re.compile("(" + "|".join(_HI_MONTHS) + ")")


# Telugu, same shape as the Hindi block above and for the same reason: \b is
# defined by \w, which matches no combining mark, so it fires inside a word.
_TE_ORDINAL = (
    "మొదటి|మొదట|ప్రథమ|"
    "రెండవ|రెండో|ద్వితీయ|"
    "మూడవ|మూడో|తృతీయ|"
    "నాల్గవ|నాలుగవ|నాల్గో|చతుర్థ"
)
_TE_MONTHS = {
    "జనవరి": 1, "ఫిబ్రవరి": 2, "మార్చి": 3, "ఏప్రిల్": 4, "మే": 5, "జూన్": 6,
    "జూలై": 7, "ఆగస్టు": 8, "సెప్టెంబర్": 9, "అక్టోబర్": 10,
    "నవంబర్": 11, "డిసెంబర్": 12,
}
# Longest first, so "మార్చి" is not cut short by a shorter alternative.
_TE_MONTH_ALT = "|".join(sorted(_TE_MONTHS, key=len, reverse=True))
_TE_PERIOD_WORD = (
    rf"(?:{_TE_ORDINAL})\s*త్రైమాసికం?"
    r"|త్రైమాసికం?\s*[1-4]?"
    r"|ఆర్థిక\s*సంవత్సరం"
    r"|అర్ధ\s*సంవత్సరం|అర్ధవార్షిక"
    rf"|{_TE_MONTH_ALT}"
)
_PERIOD_LABEL_TE = re.compile(
    rf"(?:{_TE_PERIOD_WORD})"
    r"\s*[-/]?\s*"
    r"(?:\d{4}\s*[-/]\s*\d{2,4}(?![\d,])|\d{2,4}(?![\d,]))?"
)

_TE_QUARTER_ORDINAL = re.compile(rf"({_TE_ORDINAL})\s*త్రైమాసికం?")
_TE_QUARTER_NUMBER = re.compile(r"త్రైమాసికం?\s*([1-4])")
_TE_ORDINAL_VALUE = {
    "మొదటి": 1, "మొదట": 1, "ప్రథమ": 1,
    "రెండవ": 2, "రెండో": 2, "ద్వితీయ": 2,
    "మూడవ": 3, "మూడో": 3, "తృతీయ": 3,
    "నాల్గవ": 4, "నాలుగవ": 4, "నాల్గో": 4, "చతుర్థ": 4,
}
_TE_MONTH_NAME = re.compile("(" + _TE_MONTH_ALT + ")")


_ISO_DATE = re.compile(r"\b((?:19|20)\d{2})[-/](\d{1,2})")
_QUARTER = re.compile(r"(?i)\bQ([1-4])\b")
_YEAR = re.compile(r"\b((?:19|20)\d{2})\b")
_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_NAME = re.compile(r"(?i)\b(" + "|".join(_MONTHS) + r")[a-z]*\b")


def _period_of(report: Any) -> Optional[tuple]:
    """
    The reporting period as (year, quarter), with quarter None when unknown.

    Returns None when no period can be read at all, which is the common case
    for a poor extraction - and the reason a missing period never suppresses a
    comparison below.
    """
    raw = _field_of(report, "report_date")
    if not raw:
        return None
    text = _fold_digits(str(raw))

    iso = _ISO_DATE.search(text)
    if iso:
        month = int(iso.group(2))
        if 1 <= month <= 12:
            return (int(iso.group(1)), (month - 1) // 3 + 1)

    year_match = _YEAR.search(text)
    year = int(year_match.group(1)) if year_match else None
    if year is None:
        return None

    quarter = _QUARTER.search(text)
    if quarter:
        return (year, int(quarter.group(1)))

    hi_ordinal = _HI_QUARTER_ORDINAL.search(text)
    if hi_ordinal:
        return (year, _HI_ORDINAL_VALUE[hi_ordinal.group(1)])

    hi_number = _HI_QUARTER_NUMBER.search(text)
    if hi_number:
        return (year, int(hi_number.group(1)))

    te_ordinal = _TE_QUARTER_ORDINAL.search(text)
    if te_ordinal:
        return (year, _TE_ORDINAL_VALUE[te_ordinal.group(1)])

    te_number = _TE_QUARTER_NUMBER.search(text)
    if te_number:
        return (year, int(te_number.group(1)))

    month_name = _MONTH_NAME.search(text)
    if month_name:
        month = _MONTHS[month_name.group(1).lower()[:3]]
        return (year, (month - 1) // 3 + 1)

    hi_month = _HI_MONTH_NAME.search(text)
    if hi_month:
        return (year, (_HI_MONTHS[hi_month.group(1)] - 1) // 3 + 1)

    te_month = _TE_MONTH_NAME.search(text)
    if te_month:
        return (year, (_TE_MONTHS[te_month.group(1)] - 1) // 3 + 1)

    return (year, None)


def _periods_differ(a: Any, b: Any) -> bool:
    """
    True only when both reports state a period and those periods disagree.

    Deliberately one-directional: an unknown period is not evidence that two
    documents describe different periods, and suppressing a comparison on a
    guess would hide the conflicts this engine exists to find. Coarser beats
    wrong - "2026" against "Q1 2026" agrees on everything both of them state.
    """
    period_a, period_b = _period_of(a), _period_of(b)
    if period_a is None or period_b is None:
        return False
    if period_a[0] != period_b[0]:
        return True
    return (
        period_a[1] is not None
        and period_b[1] is not None
        and period_a[1] != period_b[1]
    )


def _mine_key(report: Any) -> Optional[str]:
    """Group reports by the mine they describe; fall back to location."""
    return _norm(_field_of(report, "mine_name")) or _norm(_field_of(report, "location")) or None


def _source(report: Any, field: str) -> Dict[str, Any]:
    """A finding's reference to one report. Only real fields are included."""
    return {
        "documentId": report.id,
        "documentName": report.filename,
        "value": _field_of(report, field),
    }


def _comparable_pair(group_a: List[Any], group_b: List[Any], period_sensitive: bool):
    """
    Two documents stating different values that can fairly be compared.

    Picking one representative per value and testing only those would decide a
    whole position on whichever document happened to come first: a genuine
    same-quarter disagreement would be dropped because the two documents chosen
    to stand for it were from different quarters. So when the period matters,
    look for a pair that actually shares one.

    Returns (None, None) when no such pair exists.
    """
    if not period_sensitive:
        return group_a[0], group_b[0]

    for a in group_a:
        for b in group_b:
            if not _periods_differ(a, b):
                return a, b
    return None, None


def detect_discrepancies(reports: List[Any]) -> List[Dict[str, Any]]:
    """
    Compute findings across all reports.

    Each finding carries a deterministic `id` derived from its content, so a
    resolution recorded against it survives recomputation.
    """
    findings: List[Dict[str, Any]] = []
    completed = [r for r in reports if getattr(r, "status", None) == "completed"]

    # --- conflicts: same mine, disagreeing field values -------------------
    groups: Dict[str, List[Any]] = {}
    for report in completed:
        key = _mine_key(report)
        if key:
            groups.setdefault(key, []).append(report)

    for key, group in groups.items():
        if len(group) < 2:
            continue
        ordered = sorted(group, key=lambda r: r.id)

        for field, label, severity, period_sensitive in COMPARABLE_FIELDS:
            # Cluster reports by the value they state, so a field is compared
            # once per distinct value rather than once per document pair. Ten
            # copies of the same figure are one position, not forty-five
            # conflicts.
            clusters: Dict[str, List[Any]] = {}
            for report in ordered:
                value = _field_of(report, field)
                if value:
                    clusters.setdefault(_norm(value), []).append(report)

            if len(clusters) < 2:
                continue

            # One position per distinct value, ordered so findings are stable.
            positions = sorted(clusters.values(), key=lambda group: group[0].id)

            for i in range(len(positions)):
                for j in range(i + 1, len(positions)):
                    a, b = _comparable_pair(positions[i], positions[j], period_sensitive)
                    if a is None:
                        # Every document stating one value covers a different
                        # period from every document stating the other. Different
                        # quarters reporting different production is the expected
                        # case, not a contradiction.
                        continue
                    if not _values_conflict(_field_of(a, field), _field_of(b, field)):
                        continue

                    # How many documents back each stated value.
                    count_a = len(clusters[_norm(_field_of(a, field) or "")])
                    count_b = len(clusters[_norm(_field_of(b, field) or "")])
                    corroboration = ""
                    if count_a > 1 or count_b > 1:
                        corroboration = (
                            f" The first value appears in {count_a} document(s), "
                            f"the second in {count_b}."
                        )

                    findings.append({
                        "id": f"conflict:{field}:{a.id}:{b.id}",
                        "type": "conflict",
                        "severity": severity,
                        "title": f"{label} disagrees between two reports",
                        "fieldName": field,
                        "mineName": _field_of(a, "mine_name") or _field_of(a, "location"),
                        "organisation": _field_of(a, "company_name"),
                        "sourceA": _source(a, field),
                        "sourceB": _source(b, field),
                        "detail": (
                            f"Both documents describe the same mine but report a different "
                            f"{label.lower()}.{corroboration}"
                        ),
                    })

    # --- duplicates: same filename, or same mine and reporting date -------
    by_filename: Dict[str, List[Any]] = {}
    for report in completed:
        by_filename.setdefault(_norm(report.filename), []).append(report)
    for name, group in by_filename.items():
        if len(group) < 2:
            continue
        ordered = sorted(group, key=lambda r: r.id)
        first = ordered[0]
        for other in ordered[1:]:
            findings.append({
                "id": f"duplicate:filename:{first.id}:{other.id}",
                "type": "duplicate",
                "severity": "medium",
                "title": "Same document ingested more than once",
                "fieldName": "filename",
                "mineName": _field_of(first, "mine_name") or _field_of(first, "location"),
                "organisation": _field_of(first, "company_name"),
                "sourceA": _source(first, "filename"),
                "sourceB": _source(other, "filename"),
                "detail": "These entries share a filename, so the corpus may double-count them.",
            })

    # --- missing fields on an otherwise successful extraction -------------
    for report in completed:
        for field, label in REQUIRED_FIELDS:
            if not _field_of(report, field):
                findings.append({
                    "id": f"missing:{field}:{report.id}",
                    "type": "missing_data",
                    "severity": "low",
                    "title": f"{label} not extracted",
                    "fieldName": field,
                    "mineName": _field_of(report, "mine_name") or _field_of(report, "location"),
                    "organisation": _field_of(report, "company_name"),
                    "sourceA": _source(report, field),
                    "sourceB": None,
                    "detail": f"The extractor returned no {label.lower()} for this document.",
                })

    # --- outright extraction failures -------------------------------------
    for report in reports:
        if getattr(report, "status", None) == "error":
            findings.append({
                "id": f"error:{report.id}",
                "type": "extraction_error",
                "severity": "high",
                "title": "Extraction failed for this document",
                "fieldName": "status",
                "mineName": _field_of(report, "mine_name"),
                "organisation": _field_of(report, "company_name"),
                "sourceA": {
                    "documentId": report.id,
                    "documentName": report.filename,
                    "value": getattr(report, "error_message", None) or "Processing error",
                },
                "sourceB": None,
                "detail": "The document was uploaded but could not be processed.",
            })

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: (severity_rank.get(f["severity"], 3), f["id"]))
    return findings
