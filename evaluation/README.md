# Measuring extraction accuracy

Everything this platform reports rests on the extraction step, and until this
existed there was **no number attached to it** — in any language. A conflict
detector is only as trustworthy as the figures it compares, so "the extractor
works" was an assumption, not a measurement.

This scores extraction against documents a person has read by hand.

## Running it

    python -m evaluation.score                    # every labelled document
    python -m evaluation.score --language hi      # only Hindi ones
    python -m evaluation.score --json             # and record it for the dashboard
    python -m evaluation.score --json mine.json   # write it somewhere of your own

It calls the configured AI provider, so set a key first. Without one the
extractor falls back to mock output and the score is meaningless — the
scorer refuses to run in that state rather than reporting a fake number.

## Getting the number onto the dashboard

The Extraction accuracy card reads one file: `evaluation/latest.json`. That is
where `--json` writes when you give it no path, and nowhere else will do —
`--json report.json` scores extraction and shows nobody.

Three steps, in full:

    1. set GEMINI_API_KEY in .env          # a free key is enough
    2. python -m evaluation.score --json   # a few minutes; one call per document
    3. git commit evaluation/latest.json   # and deploy

The third step is not optional for the deployed dashboard. The backend runs
from the repository and has no writable volume, so a run recorded on a laptop
reaches production by being committed, the same way code does. That is also
what makes the figure auditable: the run that produced it is in the history,
next to the labels it scored against.

**A run that fell back mid-way is not scored at all.** The extractor answers
with mock fields when a provider call fails — right for an upload, fatal for
a measurement. One rate-limit partway through would score fabricated fields
against hand-read labels and publish the average as if it were real. The
scorer now checks which provider answered *per document* and stops, naming
the ones that fell back. Nothing is cached, so running again costs only the
calls.

**A `--language` run cannot be recorded as the corpus figure.** The dashboard
presents that file as the accuracy of every document, so a Hindi-only score
saved there would be a number nobody measured. The scorer refuses, before
calling the provider rather than after spending the quota, and tells you to
pass an explicit path if you want to keep the run for yourself.

## Before you label: what does the pipeline make of it?

Everything scored so far is a fixture this project generated, and fixtures are
clean in ways real departmental reporting is not. Run this over real PDFs
first — **it needs no API key**, because it exercises the document-processing
half, which is the half that either survives a real scan or does not:

    python -m evaluation.inspect_documents ~/Downloads/cmpdi
    python -m evaluation.inspect_documents ~/Downloads/cmpdi --labels

It reports, per document, the page count, whether there is a usable text layer
or OCR has to carry it, how much text comes out, which scripts appear, how many
passages it will index to, and whether the upload ceiling would refuse it. A
document that comes back with almost no text is one to look at by eye before
trusting anything downstream of it.

`--labels` then writes a blank skeleton per document into `labelled/`, with
every field the scorer knows about left empty. Fill in what the document
states, delete the rest, and score.

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
