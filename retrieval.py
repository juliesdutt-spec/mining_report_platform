"""
Turning a question into the passages worth putting in front of the model.

This is the seam between the vector store and /query. It exists so that the
endpoint has one thing to call and one thing to check: either it got passages
and a note saying where they came from, or it got nothing and a reason, and
falls back to the prompt it built before.

Retrieval is an optimisation on top of a working feature. It is never allowed
to be the reason a question goes unanswered, so every failure here returns a
reason rather than raising.
"""

from __future__ import annotations

import logging

import ai_providers
import vector_store
from ai_providers import ProviderError

logger = logging.getLogger(__name__)


def index_report(report) -> tuple[int, str | None]:
    """
    Embed one report's pages and write them to the index.

    Returns (chunks_written, error). Callers treat the error as something to
    log and carry on from: a document that failed to index is still ingested,
    still extracted and still answerable from its extracted fields.
    """
    ok, reason = vector_store.available()
    if not ok:
        return 0, reason

    embeddings_ok = ai_providers.embeddings_describe()
    if not embeddings_ok["available"]:
        return 0, embeddings_ok["reason"]

    chunks = vector_store.chunk_pages(
        getattr(report, "page_texts", None), getattr(report, "raw_text", None)
    )
    if not chunks:
        return 0, "This document has no extractable text to index."

    try:
        vectors = ai_providers.embed([c["content"] for c in chunks])
        written = vector_store.index_report(
            report.id,
            chunks,
            vectors,
            model=embeddings_ok["model"],
            organisation=getattr(report, "company_name", None),
            filename=getattr(report, "filename", None),
        )
        return written, None
    except (ProviderError, vector_store.VectorStoreError) as exc:
        return 0, str(exc)
    except Exception as exc:  # noqa: BLE001 - indexing must not break ingestion
        logger.warning("Indexing report %s failed: %s", getattr(report, "id", "?"), exc)
        return 0, str(exc)[:200]


def retrieve(question: str, organisation: str | None = None) -> dict:
    """
    The passages closest to a question.

    Returns {"passages", "context", "reason"}. An empty passages list with a
    reason means /query should build its prompt the old way; an empty list
    with no reason means retrieval worked and the corpus genuinely has
    nothing indexed yet.
    """
    ok, reason = vector_store.available()
    if not ok:
        return {"passages": [], "context": "", "reason": reason}

    embeddings = ai_providers.embeddings_describe()
    if not embeddings["available"]:
        return {"passages": [], "context": "", "reason": embeddings["reason"]}

    try:
        vector = ai_providers.embed([question])[0]
        passages = vector_store.search(vector, organisation=organisation)
    except (ProviderError, vector_store.VectorStoreError) as exc:
        return {"passages": [], "context": "", "reason": str(exc)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Retrieval failed: %s", exc)
        return {"passages": [], "context": "", "reason": str(exc)[:200]}

    return {"passages": passages, "context": as_context(passages), "reason": None}


def as_context(passages: list[dict]) -> str:
    """
    Lay retrieved passages out for the prompt.

    Each one is labelled with the document and page it came from, so the model
    can attribute a figure to a page rather than to the corpus in general —
    which is the claim the rest of this platform makes about every number it
    reports.
    """
    blocks = []
    for passage in passages:
        where = passage.get("filename") or f"report {passage.get('report_id')}"
        page = passage.get("page") or 0
        cite = f"{where}, page {page}" if page else where
        blocks.append(f"[{cite}]\n{passage['content']}")
    return "\n\n---\n\n".join(blocks)
