"""
Measure what a passage costs and how many of them fit.

The capacity numbers we give judges were estimates until this existed, and an
estimate about storage is the kind that is quietly wrong: the HNSW graph turns
out to cost nearly as much as the data it indexes, which no amount of reading
the schema would have told us. So this script measures rather than calculates,
and anyone can re-run it.

Two halves, independently useful:

  corpus   How many passages a document actually yields, run over the test
           corpus. The transferable number is passages *per page* - a per
           document average from two-page fixtures says nothing about a real
           annual report.

  storage  What a passage costs on disk, and how long a top-k lookup takes,
           against a real Postgres with pgvector. Needs VECTOR_DATABASE_URL.
           It creates its own table, and drops it again.

    python -m benchmarks.measure_capacity            # both, storage skipped
                                                     #   without a database
    python -m benchmarks.measure_capacity corpus
    python -m benchmarks.measure_capacity storage --rows 20000
"""
from __future__ import annotations

import argparse
import io
import os
import pathlib
import random
import statistics
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent

#: Text long enough to be a realistic row without being the largest one the
#: chunker can emit - see CHUNK_CHARS in vector_store.
SAMPLE_PASSAGE_CHARS = 1100

#: Filler vocabulary. Mining words rather than lorem ipsum so the stored text
#: compresses roughly the way real passages do.
_WORDS = ("coal production target achieved overburden removal mine safety "
          "quarter tonnes despatch grade seam washery reject").split()


def _filler(length: int) -> str:
    """Text of roughly the right size and shape, not lorem ipsum."""
    out: list[str] = []
    size = 0
    while size < length:
        word = random.choice(_WORDS)
        out.append(word)
        size += len(word) + 1
    return " ".join(out)[:length]


# ----------------------------------------------------------- corpus ---


def measure_corpus() -> None:
    from document_processor import extract_pages_from_pdf
    from vector_store import CHUNK_CHARS, CHUNK_OVERLAP, chunk_pages

    files = sorted((PROJECT_ROOT / "samples" / "corpus").glob("*.pdf"))
    sample = PROJECT_ROOT / "sample_mining_report.pdf"
    if sample.exists():
        files.append(sample)
    if not files:
        print("No corpus found. Run samples/generate_test_corpus.py first.")
        return

    print(f"chunking at {CHUNK_CHARS} chars, {CHUNK_OVERLAP} overlap\n")
    print(f"{'file':<48}{'pages':>6}{'chars':>9}{'passages':>10}")
    pages_total = chars_total = passages_total = 0
    for path in files:
        pages = extract_pages_from_pdf(path.read_bytes())
        passages = chunk_pages(pages, "\n".join(pages))
        chars = sum(len(p) for p in pages)
        pages_total += len(pages)
        chars_total += chars
        passages_total += len(passages)
        print(f"{path.name:<48}{len(pages):>6}{chars:>9}{len(passages):>10}")

    print(
        f"\n{len(files)} documents, {pages_total} pages, {passages_total} passages\n"
        f"  passages per page  {passages_total / pages_total:.2f}   <- the transferable ratio\n"
        f"  chars per passage  {chars_total / passages_total:.0f}\n"
        f"  passages per document {passages_total / len(files):.1f} "
        f"(about these fixtures, not about real reports)"
    )


# ---------------------------------------------------------- storage ---


def measure_storage(rows: int, dimension: int, queries: int) -> None:
    dsn = os.getenv("VECTOR_DATABASE_URL")
    if not dsn:
        print("VECTOR_DATABASE_URL is not set; skipping the storage measurement.")
        return
    import psycopg2

    def vector() -> str:
        return "[" + ",".join(f"{random.gauss(0, 1):.5f}" for _ in range(dimension)) + "]"

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
    cur.execute("DROP TABLE IF EXISTS capacity_probe")
    # Deliberately the same column set as report_chunks: a measurement taken
    # against a narrower table would understate every figure below.
    cur.execute(
        f"""
        CREATE TABLE capacity_probe (
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
    try:
        started = time.time()
        buffer = io.StringIO()
        for i in range(rows):
            buffer.write("\t".join([
                str(i // 40), "South Eastern Coalfields Limited",
                f"report_{i // 40:05d}_FY2024-25.pdf", str(i % 40), str(i),
                _filler(SAMPLE_PASSAGE_CHARS), vector(),
            ]) + "\n")
        buffer.seek(0)
        cur.copy_from(
            buffer, "capacity_probe",
            columns=("report_id", "organisation", "filename", "page",
                     "chunk_index", "content", "embedding"),
        )
        print(f"loaded {rows:,} passages in {time.time() - started:.1f}s")

        def total() -> int:
            cur.execute("SELECT pg_total_relation_size('capacity_probe')")
            return cur.fetchone()[0]

        before = total()
        started = time.time()
        cur.execute(
            "CREATE INDEX ON capacity_probe USING hnsw (embedding vector_cosine_ops)"
        )
        build_seconds = time.time() - started
        after = total()
        cur.execute("ANALYZE capacity_probe")

        print(
            f"HNSW built in {build_seconds:.1f}s\n\n"
            f"  per passage, table only   {before / rows:,.0f} bytes\n"
            f"  per passage, with index   {after / rows:,.0f} bytes\n"
            f"  the index alone           {(after - before) / rows:,.0f} bytes\n"
            f"  a 500 MB volume holds     ~{int(500 * 1048576 / (after / rows)):,} passages"
        )

        sql = ("SELECT id, page, content FROM capacity_probe "
               "ORDER BY embedding <=> %s::vector LIMIT 32")
        for _ in range(5):                       # warm the cache first
            cur.execute(sql, (vector(),))
            cur.fetchall()
        timings = []
        for _ in range(queries):
            probe = vector()
            started = time.perf_counter()
            cur.execute(sql, (probe,))
            cur.fetchall()
            timings.append((time.perf_counter() - started) * 1000)
        timings.sort()
        print(
            f"\n  top-32 lookup over {rows:,} passages, {queries} queries\n"
            f"    median {statistics.median(timings):.1f} ms   "
            f"p95 {timings[int(queries * 0.95) - 1]:.1f} ms   "
            f"max {timings[-1]:.1f} ms"
        )
    finally:
        cur.execute("DROP TABLE IF EXISTS capacity_probe")
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("what", nargs="?", default="both",
                        choices=("both", "corpus", "storage"))
    parser.add_argument("--rows", type=int, default=20000)
    parser.add_argument("--dimension", type=int, default=768)
    parser.add_argument("--queries", type=int, default=100)
    args = parser.parse_args()

    if args.what in ("both", "corpus"):
        measure_corpus()
    if args.what == "both":
        print()
    if args.what in ("both", "storage"):
        measure_storage(args.rows, args.dimension, args.queries)


if __name__ == "__main__":
    main()
