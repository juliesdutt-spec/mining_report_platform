"""
Build the semantic index from the reports already in the database.

    python -m vector_backfill              # index anything not yet indexed
    python -m vector_backfill --all        # re-index everything
    python -m vector_backfill --reset      # drop the index first, then rebuild

Every row in the vector store is derived from the reports table, so this can
be run at any time and is the answer to every "the index is wrong" problem:
reset and rebuild. It is also what has to be run after changing the embedding
model, because vectors from two models are not comparable and the store
refuses to mix them.
"""

from __future__ import annotations

import argparse
import sys

import ai_providers
import retrieval
import vector_store
from database import MiningReport, SessionLocal


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="re-index reports already indexed")
    parser.add_argument("--reset", action="store_true", help="drop the index and rebuild it")
    parser.add_argument("--limit", type=int, default=0, help="stop after this many reports")
    args = parser.parse_args(argv)

    ok, reason = vector_store.available()
    if not ok:
        print(f"Vector store unavailable: {reason}", file=sys.stderr)
        return 2

    embeddings = ai_providers.embeddings_describe()
    if not embeddings["available"]:
        print(f"No embeddings available: {embeddings['reason']}", file=sys.stderr)
        return 2

    print(f"Embedding with {embeddings['provider']} / {embeddings['model']}")

    if args.reset:
        vector_store.reset()
        print("Index dropped.")

    already: set[int] = set()
    if not args.all and not args.reset:
        try:
            with vector_store._connect() as conn, conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.report_chunks')")
                if cur.fetchone()[0] is not None:
                    cur.execute("SELECT DISTINCT report_id FROM report_chunks")
                    already = {row[0] for row in cur.fetchall()}
        except Exception as exc:  # noqa: BLE001
            print(f"Could not read the existing index, rebuilding all: {exc}")

    db = SessionLocal()
    try:
        reports = (
            db.query(MiningReport)
            .filter(MiningReport.status == "completed")
            .order_by(MiningReport.id)
            .all()
        )
        pending = [r for r in reports if r.id not in already]
        if args.limit:
            pending = pending[: args.limit]

        print(f"{len(reports)} completed report(s); {len(pending)} to index.")
        total_chunks = 0
        failed = 0
        for report in pending:
            written, error = retrieval.index_report(report)
            if error:
                failed += 1
                print(f"  report {report.id} ({report.filename}): {error}")
            else:
                total_chunks += written
                print(f"  report {report.id} ({report.filename}): {written} chunk(s)")

        print(f"\nIndexed {total_chunks} chunk(s) across {len(pending) - failed} report(s).")
        if failed:
            print(f"{failed} report(s) failed — see above.", file=sys.stderr)
        print("Index now holds:", vector_store.stats())
        return 1 if failed else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
