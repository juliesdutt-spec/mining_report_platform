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

**Budget about three minutes for the 13-document corpus.** Gemini's free tier
allows five generation calls a minute, so the scorer paces itself to that and
one document per call means the run is mostly waiting. That is the correct
behaviour: the alternative is what happened the first time this was run
against a real key — four 503s, seven 429s, and 11 of 13 documents silently
answered with mock fields. `GEMINI_RPM` raises the pace on a paid plan.

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

**A run that hits the quota keeps what it paid for.** The free tier caps
generation per *day* as well as per minute — the observed cap is 20 requests,
and the corpus needs 13. A run that dies partway used to discard every
document it had already extracted, so the next attempt cost 13 again, which
against a daily cap is unfinishable. Successful extractions are now saved to
`evaluation/.extractions/`, so a second run only pays for what is left:

    5 of 13 document(s) fell back to mock extraction ...
    The other 8 are extracted and saved, so running again costs 5 call(s), not 13.

Finish the corpus across two or three runs, then the score is written as
normal. Nothing about that weakens it: each entry is a real model extraction
of that exact document, and the key includes the model and the extractor's
source, so changing either re-extracts rather than silently scoring stale
answers. Mock output is never saved. `--fresh` ignores the lot and re-calls
for every document.

**Every field missing, on every document?** That is not a bad model, it is a
model that did not answer the question — and the score table cannot tell you
which. Send one document and look at what comes back:

    python -m evaluation.show_reply samples/corpus/EN-01_Jharia_BCCL_FY2024-25.pdf

It prints the raw reply and what the parser makes of it, using the exact
prompt extraction sends. One call, nothing cached.

**A host that cannot read scans is not allowed to score them.** Two of the
thirteen labelled documents are scans, carrying 20 of the 124 fields. Without
working OCR they extract to nothing, score all-missing, and cap the run at
83.9% — a number that reads as "the extractor got a fifth of the corpus wrong"
when what it means is "this laptop has no tesseract". The scorer checks before
it spends any quota and stops, naming the documents and what is missing.

### Installing OCR

`pip install pytesseract` is not enough. It is a wrapper around a separate
binary, and installing the wrapper alone is the quiet failure above: every
other check in the codebase believes OCR is present.

**Windows** — install from the [UB Mannheim
build](https://github.com/UB-Mannheim/tesseract/wiki). During setup, expand
*Additional language data* and tick **Hindi** and **Telugu**; the corpus has
documents in both, and tesseract with only English does not fail on a
Devanagari page, it returns confident Latin nonsense. Let the installer add
the directory to PATH, then open a new terminal.

If you already installed it and PATH was missed — which is the common outcome,
the checkbox is easy to skip — you do not have to fix PATH. The standard
install locations are checked automatically; for anywhere else, put the full
path in `.env`:

    TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe

**Not sure what is wrong?** One command reports both the AI provider and OCR,
including the exact folder tesseract reads language data from and the command
to fill it:

    python doctor.py

**If the language checkboxes were missed**, you do not need to reinstall. The
language data is two files. In PowerShell, using the folder `doctor.py`
printed — not a guessed one, since a machine with two tesseract installs has
two of them:

    $dir = "C:\Program Files\Tesseract-OCR\tessdata"
    $base = "https://github.com/tesseract-ocr/tessdata/raw/main"
    foreach ($lang in "hin", "tel") {
      Invoke-WebRequest "$base/$lang.traineddata" -OutFile "$dir\$lang.traineddata"
    }

That needs an elevated terminal, because the folder is under Program Files.
Re-run the inspector afterwards; the last line should read `eng+hin+tel`.

This matters more than it looks. tesseract with only `eng` does **not** fail on
a Devanagari page — it reads it as Latin and returns confident nonsense, which
extraction then parses into fields. Those score *wrong* rather than *missing*,
and wrong is the bucket that corrupts a conflict report. The scorer refuses on
this case for that reason.

**macOS** — `brew install tesseract tesseract-lang`

**Debian/Ubuntu** — `sudo apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-tel`

Check it took effect without running the scorer:

    python -m evaluation.inspect_documents samples/corpus

The last line reports the tesseract version and the languages it found, or
says OCR is not working and why. It needs no API key.

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
