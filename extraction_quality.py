# -*- coding: utf-8 -*-
"""
How good the extraction is, using only figures that can be derived honestly.

Two different things, deliberately not conflated:

COMPLETENESS is computable from the live corpus right now. It asks how many
of the fields the platform actually depends on came back populated. It says
nothing about whether those values are *right* - a confidently wrong figure
counts as complete - so it is labelled as coverage, never as accuracy.

ACCURACY requires documents a person has read, and is produced by
`python -m evaluation.score`. Until such a run exists this reports None, and
the dashboard says the number has not been measured rather than showing a
stand-in. A fabricated accuracy figure on a compliance tool is worse than an
empty one.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from validation_engine import COMPARABLE_FIELDS, REQUIRED_FIELDS

#: The fields the platform depends on: what a finding is raised for being
#: missing, plus what conflicts are detected on. Anything else is useful
#: context but its absence breaks nothing.
DEPENDED_ON_FIELDS = sorted(
    {field for field, _label in REQUIRED_FIELDS}
    | {field for field, _label, _sev, _period in COMPARABLE_FIELDS}
)

#: Where `evaluation.score --json` is expected to leave its result.
MEASUREMENT_PATH = Path(
    os.getenv("EXTRACTION_MEASUREMENT", Path(__file__).resolve().parent / "evaluation" / "latest.json")
)


def _populated(report: Any, field: str) -> bool:
    value = getattr(report, field, None)
    if value is None:
        extracted = getattr(report, "extracted_data", None) or {}
        value = extracted.get(field)
    return bool(str(value).strip()) if value is not None else False


def completeness(reports: List[Any]) -> Dict[str, Any]:
    """What fraction of the depended-on fields actually came back."""
    considered = [r for r in reports if getattr(r, "status", None) == "completed"]
    if not considered:
        return {"documents": 0, "fieldsExpected": 0, "fieldsPopulated": 0, "ratio": None}

    expected = len(considered) * len(DEPENDED_ON_FIELDS)
    populated = sum(
        1 for report in considered for field in DEPENDED_ON_FIELDS if _populated(report, field)
    )
    return {
        "documents": len(considered),
        "fieldsExpected": expected,
        "fieldsPopulated": populated,
        "ratio": populated / expected if expected else None,
    }


def measured_accuracy() -> Optional[Dict[str, Any]]:
    """
    The last recorded accuracy run, or None if extraction has never been scored.

    None is the honest answer for this project today, and the UI is expected
    to say so rather than substituting completeness, which measures something
    else entirely.
    """
    try:
        if not MEASUREMENT_PATH.exists():
            return None
        result = json.loads(MEASUREMENT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # A corrupt measurement file must read as "not measured", never as a
        # number nobody can trace.
        return None

    if not isinstance(result, dict) or "accuracy" not in result:
        return None

    by_corpus = result.get("byCorpus") or {}
    real = by_corpus.get("real")
    if isinstance(real, dict) and real.get("fieldsScored"):
        # Real documents lead once any are scored. They answer the question
        # people actually ask of this figure - does it work on what CIL
        # publishes - and blending in the fixtures, whose answers were
        # written by construction, would let them flatter it.
        synthetic = by_corpus.get("synthetic") or {}
        return {
            **_figures(real, real.get("documents", 0)),
            "corpus": "real",
            "synthetic": (
                {
                    "accuracy": synthetic.get("accuracy"),
                    "fieldsScored": synthetic.get("fieldsScored", 0),
                    "documents": synthetic.get("documents", 0),
                }
                if synthetic.get("fieldsScored") else None
            ),
        }

    # A run recorded before real documents existed has no byCorpus, and
    # everything in it is synthetic.
    return {
        **_figures(result, len(result.get("documents", []) or [])),
        "corpus": "synthetic",
        "synthetic": None,
    }


def _figures(part: Dict[str, Any], documents: int) -> Dict[str, Any]:
    totals = part.get("totals", {}) or {}
    return {
        "accuracy": part.get("accuracy"),
        "fieldsScored": part.get("fieldsScored", 0),
        "documents": documents,
        "exact": totals.get("exact", 0),
        "equivalent": totals.get("equivalent", 0),
        "missing": totals.get("missing", 0),
        "wrong": totals.get("wrong", 0),
    }


def summarise(reports: List[Any]) -> Dict[str, Any]:
    return {
        "fields": DEPENDED_ON_FIELDS,
        "completeness": completeness(reports),
        "measured": measured_accuracy(),
    }
