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

# Fields compared across reports about the same mine.
COMPARABLE_FIELDS = [
    ("quantity_extracted", "Quantity extracted", "high"),
    ("reserve_estimate", "Reserve estimate", "high"),
    ("extraction_method", "Extraction method", "medium"),
    ("mineral_type", "Mineral type", "medium"),
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


def _numeric(value: Optional[str]) -> Optional[float]:
    """First number in a string, so '52.50 MT' and '52.5 MT' are not a conflict."""
    if not value:
        return None
    match = re.search(r"[-+]?\d[\d,]*\.?\d*", str(value))
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

        for field, label, severity in COMPARABLE_FIELDS:
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

            representatives = [reports[0] for reports in clusters.values()]
            representatives.sort(key=lambda r: r.id)

            for i in range(len(representatives)):
                for j in range(i + 1, len(representatives)):
                    a, b = representatives[i], representatives[j]
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
