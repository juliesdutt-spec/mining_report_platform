"""
Semantic retrieval over the indexed corpus, in Postgres with pgvector.

Why this exists
---------------
Before it, /query built its prompt by concatenating every completed report's
extracted fields and cutting the result at 6000 characters. Two things follow
from that, and both get worse as the corpus grows. Whatever fell past the cut
was never seen by the model, with nothing in the answer to say so. And the
document *body* was never in the prompt at all — only the handful of fields
extraction had already pulled out — so a question whose answer sat in a
paragraph nobody had extracted could not be answered from it.

Chunks are cut along page boundaries, so a retrieved passage carries the page
it came from. That is the same claim the rest of the platform makes about
every figure it reports, and it is the reason retrieval is worth having here
rather than being a search box bolted on the side.

Why a second database
---------------------
Railway's standard Postgres image ships no extensions, pgvector included:

    "Railway's standard Postgres image does not include pgvector.
     Use the pgvector template instead."  — docs.railway.com

So this points at its own VECTOR_DATABASE_URL. Embeddings are derived data —
every row here can be rebuilt from the reports table by re-running the
backfill — so keeping them out of the database that holds the only copy of
anything is the cautious way round, not a compromise.

Everything degrades
-------------------
No VECTOR_DATABASE_URL, no embeddings API, an unreachable database, a missing
extension: each returns "unavailable" with a reason, and /query falls back to
the behaviour it had before. Retrieval failing must never mean the question
goes unanswered.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

logger = logging.getLogger(__name__)

VECTOR_DATABASE_URL = os.getenv("VECTOR_DATABASE_URL", "").strip()

# How much text goes in one chunk, and how much of the previous chunk is
# repeated at the start of the next. The overlap is what stops a sentence that
# straddles a boundary from being retrievable by neither half.
CHUNK_CHARS = int(os.getenv("VECTOR_CHUNK_CHARS", "1200") or 1200)
CHUNK_OVERLAP = int(os.getenv("VECTOR_CHUNK_OVERLAP", "150") or 150)

# How many chunks a question retrieves. Enough to cover a figure quoted in
# more than one report, which is the case this platform exists for.
TOP_K = int(os.getenv("VECTOR_TOP_K", "8") or 8)

# How many rows to pull per requested passage before collapsing duplicates.
OVERFETCH = 4

_SCHEMA_READY = False
_UNAVAILABLE_REASON: str | None = None

# How long an availability probe is trusted for.
#
# /health calls this, and Railway polls /health. Without a cache every poll
# opened a connection to the vector database — and worse, while that database
# was unreachable each poll blocked for the connect timeout below, so an
# outage of the *search index* could fail the platform's healthcheck and
# restart the whole API. The index being down must never take the API with
# it.
AVAILABILITY_TTL_SECONDS = float(os.getenv("VECTOR_AVAILABILITY_TTL", "30") or 30)
CONNECT_TIMEOUT_SECONDS = int(os.getenv("VECTOR_CONNECT_TIMEOUT", "5") or 5)
_availability_cache: tuple[float, bool, str | None] | None = None


class VectorStoreError(RuntimeError):
    """Raised for a failure the caller should report rather than swallow."""


# ------------------------------------------------------------- chunking ---

_WHITESPACE = re.compile(r"[ \t]+")


def _tidy(text: str) -> str:
    """Collapse the ragged whitespace PDF extraction leaves behind."""
    return _WHITESPACE.sub(" ", (text or "").replace("\r", "")).strip()


def chunk_pages(page_texts: Sequence[str] | None, raw_text: str | None = None) -> list[dict]:
    """
    Cut a document into retrievable pieces, each knowing its page.

    page_texts is the per-page list the extractor stores. Reports ingested
    before that column existed have none, so raw_text is the fallback and
    those chunks report page 0 — "somewhere in this document" — rather than
    inventing a page number that would then be cited as evidence.
    """
    pages: list[tuple[int, str]] = []
    if page_texts:
        pages = [(i + 1, _tidy(t)) for i, t in enumerate(page_texts) if _tidy(t)]
    elif raw_text:
        pages = [(0, _tidy(raw_text))]

    chunks: list[dict] = []
    for page_number, text in pages:
        start = 0
        while start < len(text):
            end = min(start + CHUNK_CHARS, len(text))
            # Prefer to break at a sentence or word boundary rather than mid-word.
            if end < len(text):
                window = text.rfind(". ", start + CHUNK_CHARS // 2, end)
                if window == -1:
                    window = text.rfind(" ", start + CHUNK_CHARS // 2, end)
                if window != -1:
                    end = window + 1
            piece = text[start:end].strip()
            if piece:
                chunks.append({"page": page_number, "content": piece})
            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


# ------------------------------------------------------------ plumbing ---


def configured() -> bool:
    """Whether an operator has pointed this at a database at all."""
    return bool(VECTOR_DATABASE_URL)


@contextmanager
def _connect() -> Iterator[Any]:
    import psycopg2  # imported here so the module loads without the driver

    conn = psycopg2.connect(VECTOR_DATABASE_URL, connect_timeout=CONNECT_TIMEOUT_SECONDS)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _as_vector(values: Sequence[float]) -> str:
    """
    pgvector's wire format, as a string.

    psycopg2 has no adapter for a Python list to `vector`, so passing one
    straight through fails or — worse, with a list of floats — is adapted to
    an ARRAY that Postgres then refuses to compare. Every call site sends this
    string and casts it with ::vector.
    """
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


#: pgvector's ceiling for an HNSW index. A wider column can be stored but not
#: indexed, which would turn every search into a sequential scan.
HNSW_MAX_DIMENSIONS = 2000


def ensure_schema(dimension: int, model: str) -> None:
    """
    Create the extension, table and index, once per process.

    The dimension is fixed in the column type, so the model that produced the
    vectors is recorded alongside it. Embedding a question with one model and
    comparing it against an index built by another returns nonsense that looks
    exactly like a working search, so a mismatch is refused loudly instead.
    """
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return

    # pgvector builds no HNSW index above this width, and the error it raises
    # names neither the model nor the setting that would fix it.
    if dimension > HNSW_MAX_DIMENSIONS:
        raise VectorStoreError(
            f"{model} produces {dimension}-dimensional vectors, and pgvector "
            f"cannot build an HNSW index above {HNSW_MAX_DIMENSIONS}. Ask the "
            "provider for a narrower vector - GEMINI_EMBED_DIMENSIONS=768, say."
        )

    with _connect() as conn, conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vector_index_meta (
                id          BOOLEAN PRIMARY KEY DEFAULT TRUE,
                model       TEXT NOT NULL,
                dimension   INTEGER NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT vector_index_meta_single_row CHECK (id)
            )
            """
        )
        cur.execute("SELECT model, dimension FROM vector_index_meta WHERE id")
        row = cur.fetchone()
        if row and (row[0] != model or row[1] != dimension):
            # An empty index carrying a stale marker is not data worth
            # protecting, and refusing it is a dead end: the operator is told
            # to rebuild an index that has nothing in it. This happens for real
            # whenever the provider retires an embedding model, since the
            # replacement rarely has the same dimension.
            cur.execute("SELECT to_regclass('report_chunks')")
            table_exists = cur.fetchone()[0] is not None
            existing = 0
            if table_exists:
                cur.execute("SELECT count(*) FROM report_chunks")
                existing = cur.fetchone()[0]

            if existing:
                raise VectorStoreError(
                    f"This index holds {existing} passages built with {row[0]} at "
                    f"{row[1]} dimensions, and the configured model is now {model} "
                    f"at {dimension}. Vectors from two models are not comparable — "
                    "rebuild the index from Settings, or run "
                    "`python -m vector_backfill --reset`, before searching again."
                )

            if table_exists:
                cur.execute("DROP TABLE report_chunks")
            cur.execute("DELETE FROM vector_index_meta WHERE id")
            row = None

        if not row:
            cur.execute(
                "INSERT INTO vector_index_meta (model, dimension) VALUES (%s, %s)",
                (model, dimension),
            )

        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS report_chunks (
                id            BIGSERIAL PRIMARY KEY,
                report_id     INTEGER NOT NULL,
                organisation  TEXT,
                filename      TEXT,
                page          INTEGER NOT NULL DEFAULT 0,
                chunk_index   INTEGER NOT NULL,
                content       TEXT NOT NULL,
                embedding     vector({dimension}) NOT NULL,
                indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (report_id, chunk_index)
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS report_chunks_report_id_idx "
            "ON report_chunks (report_id)"
        )
        # Cosine, because the question and the passage differ in length and
        # only their direction should matter.
        cur.execute(
            "CREATE INDEX IF NOT EXISTS report_chunks_embedding_idx "
            "ON report_chunks USING hnsw (embedding vector_cosine_ops)"
        )
    _SCHEMA_READY = True


def _remember(ok: bool, reason: str | None) -> tuple[bool, str | None]:
    """Record a probe verdict so the next caller inside the TTL is free."""
    global _availability_cache
    _availability_cache = (time.monotonic(), ok, reason)
    return ok, reason


def forget_availability() -> None:
    """
    Drop the cached verdict.

    Called after a write succeeds against the database, so a probe that
    failed while the index was being provisioned does not keep /health
    reporting it down for another TTL once it plainly works.
    """
    global _availability_cache
    _availability_cache = None


def available() -> tuple[bool, str | None]:
    """
    Whether a search can actually be served, and why not when it cannot.

    Probes rather than assumes: a URL that is set but unreachable, or a
    database without the extension, are both ordinary states here and both
    have to read as "retrieval is off", never as "no results found".
    """
    global _UNAVAILABLE_REASON, _availability_cache
    if not configured():
        return False, "VECTOR_DATABASE_URL is not set."

    now = time.monotonic()
    if _availability_cache is not None:
        checked_at, ok, reason = _availability_cache
        if now - checked_at < AVAILABILITY_TTL_SECONDS:
            return ok, reason
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        return _remember(False, "psycopg2 is not installed.")
    try:
        with _connect() as conn, conn.cursor() as cur:
            # Two different things, and conflating them misdiagnoses the one
            # case that matters. pg_extension lists extensions that have been
            # CREATEd; pg_available_extensions lists what this image *can*
            # create. A freshly provisioned pgvector database has the second
            # and not the first — ensure_schema creates it on the first write
            # — so checking only pg_extension told an operator who had done
            # exactly the right thing to go and use the pgvector template.
            cur.execute(
                "SELECT"
                " EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector'),"
                " EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'vector')"
            )
            installed, installable = cur.fetchone()
            if not installed and not installable:
                return _remember(False, (
                    "This database does not ship the pgvector extension. "
                    "Railway's standard Postgres image does not — use the "
                    "pgvector template, or an image with pgvector built in."
                ))
    except Exception as exc:  # noqa: BLE001 - reported, never raised onward
        _UNAVAILABLE_REASON = str(exc)[:200]
        return _remember(False, f"Could not reach the vector database: {_UNAVAILABLE_REASON}")
    return _remember(True, None)


# --------------------------------------------------------------- writing ---


def index_report(
    report_id: int,
    chunks: Sequence[dict],
    embeddings: Sequence[Sequence[float]],
    *,
    model: str,
    organisation: str | None = None,
    filename: str | None = None,
) -> int:
    """
    Replace everything stored for one report.

    Replace rather than append: re-indexing a document that was re-extracted
    would otherwise leave the old passages in the index, and a stale passage
    is worse than a missing one — it is quoted back as current.
    """
    if not chunks:
        return 0
    if len(chunks) != len(embeddings):
        raise VectorStoreError(
            f"{len(chunks)} chunks but {len(embeddings)} embeddings for report {report_id}."
        )

    ensure_schema(len(embeddings[0]), model)
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM report_chunks WHERE report_id = %s", (report_id,))
        for position, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            cur.execute(
                """
                INSERT INTO report_chunks
                    (report_id, organisation, filename, page, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                """,
                (
                    report_id,
                    organisation,
                    filename,
                    int(chunk.get("page") or 0),
                    position,
                    chunk["content"],
                    _as_vector(vector),
                ),
            )
    forget_availability()
    return len(chunks)


def forget_report(report_id: int) -> int:
    """Drop a deleted document's passages, so they stop being retrievable."""
    if not configured():
        return 0
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM report_chunks WHERE report_id = %s", (report_id,))
        return cur.rowcount or 0


def reset() -> None:
    """Drop the index entirely, for a rebuild after the model changes."""
    global _SCHEMA_READY
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS report_chunks")
        cur.execute("DROP TABLE IF EXISTS vector_index_meta")
    _SCHEMA_READY = False


# --------------------------------------------------------------- reading ---


def search(
    embedding: Sequence[float],
    *,
    limit: int = TOP_K,
    organisation: str | None = None,
) -> list[dict]:
    """
    The passages closest to a question, nearest first.

    The organisation filter is applied in SQL rather than to the results:
    filtering afterwards would let another organisation's documents consume
    the top-k and hand back fewer passages than asked for, or none, from a
    corpus that had plenty.
    """
    sql = """
        SELECT report_id, filename, organisation, page, content,
               embedding <=> %s::vector AS distance
        FROM report_chunks
    """
    params: list[Any] = [_as_vector(embedding)]
    if organisation:
        sql += " WHERE organisation = %s"
        params.append(organisation)
    # Over-fetch, because near-duplicate passages are collapsed below and
    # collapsing after a LIMIT would hand back fewer distinct passages than
    # asked for. This corpus makes that the common case rather than the edge
    # one: the platform exists partly to find documents ingested twice, so
    # the same paragraph legitimately sits under several report ids.
    # report_id breaks the tie. Identical passages score identically, and
    # without a tiebreaker the same question cites a different document each
    # time it is asked — on a tool whose whole claim is traceability.
    sql += " ORDER BY embedding <=> %s::vector, report_id, chunk_index LIMIT %s"
    params.extend([_as_vector(embedding), int(limit) * OVERFETCH])

    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    seen: dict[str, dict] = {}
    for row in rows:
        content = row[4]
        key = " ".join(content.split()).casefold()
        hit = seen.get(key)
        if hit is None:
            seen[key] = {
                "report_id": row[0],
                "filename": row[1],
                "organisation": row[2],
                "page": row[3],
                "content": content,
                # Cosine distance runs 0..2; similarity is the friendlier way round.
                "similarity": round(1.0 - float(row[5]), 4),
                # Which documents carry this same passage. One passage
                # appearing in four reports is a fact about the corpus worth
                # keeping, not a duplicate row worth spending the model's
                # context window on four times.
                "also_in": [],
            }
        elif row[0] != hit["report_id"] and row[0] not in hit["also_in"]:
            hit["also_in"].append(row[0])
        if len(seen) >= limit and rows.index(row) > limit:
            continue

    return list(seen.values())[:limit]


def stats() -> dict:
    """What is actually indexed, for /health and the Settings screen."""
    ok, reason = available()
    if not ok:
        return {"available": False, "reason": reason, "chunks": 0, "reports": 0, "model": None}
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.report_chunks')")
        if cur.fetchone()[0] is None:
            return {
                "available": True,
                "reason": None,
                "chunks": 0,
                "reports": 0,
                "model": None,
            }
        cur.execute("SELECT count(*), count(DISTINCT report_id) FROM report_chunks")
        chunks, reports = cur.fetchone()
        cur.execute("SELECT model, dimension FROM vector_index_meta WHERE id")
        meta = cur.fetchone()
    return {
        "available": True,
        "reason": None,
        "chunks": int(chunks or 0),
        "reports": int(reports or 0),
        "model": meta[0] if meta else None,
        "dimension": meta[1] if meta else None,
    }
