# Measuring extraction accuracy

Everything this platform reports rests on the extraction step, and until this
existed there was **no number attached to it** — in any language. A conflict
detector is only as trustworthy as the figures it compares, so "the extractor
works" was an assumption, not a measurement.

This scores extraction against documents a person has read by hand.

## Running it

    python -m evaluation.score                      # every labelled document
    python -m evaluation.score --language hi        # only Hindi ones
    python -m evaluation.score --json report.json   # machine-readable

It calls the configured AI provider, so set a key first. Without one the
extractor falls back to mock output and the score is meaningless — the
scorer refuses to run in that state rather than reporting a fake number.

## Adding a document

Put the PDF anywhere in the repository, then add a label file beside the
others in `labelled/`:

    {
      "document": "relative/path/to/report.pdf",
      "language": "hi",
      "expected": { "mine_name": "...", "mineral_type": "..." }
    }

**List only the fields the document actually states.** A field you leave out
is not scored. Labelling a field the document never mentions would count a
correct `null` as a miss.

## How it scores

Each labelled field lands in one of four buckets:

| | |
|---|---|
| **exact** | identical after normalisation |
| **equivalent** | different wording the platform already treats as the same — `Open Cast` / `opencast`, `coal` / `कोयला` |
| **missing** | the document states it, extraction returned nothing |
| **wrong** | extraction returned something else |

Equivalence uses `validation_engine`'s own comparison, so the score reflects
what the product actually treats as agreement rather than a stricter standard
it never applies. A field the extractor gets *usefully* right should not be
marked wrong for choosing a different word than the labeller did.

`missing` and `wrong` are reported separately on purpose: a blank field is a
gap the user can see and fill, while a confidently wrong value is the one
that silently corrupts a conflict report.
