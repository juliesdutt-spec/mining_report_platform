# Real documents

The 13 documents in `samples/corpus` are fixtures this project generated.
Their answers are known because we wrote them, so the 100% they score shows
that extraction works on clean, known documents. It does not show how
extraction does on what CMPDI and CIL actually publish. This folder holds the
real documents for that second question.

The scorer reports the two sets separately and never blends them:

    synthetic  100.0%  over 124 field(s) in 13 document(s)
    real        ...

## What stays out of git

The PDFs in this folder are **not committed**, because annual reports run
past 20 MB and would ship inside every backend deploy. Their **labels are
committed** in `evaluation/labelled/REAL-*.json`. Each label records the URL
the PDF came from and the file's SHA-256, so anyone can download the same
file and the scorer can prove it is the one that was read. If a publisher
revises a report under the same name, the hash no longer matches and the
scorer stops rather than scoring the new file against the old answers.

## Which documents to pick

Aim for 8–10, mixed like this. Documents about one mine are the most useful,
because they state the most fields the extractor looks for.

| Kind | Where | What it states |
|---|---|---|
| **EC compliance report** (six-monthly) | parivesh.nic.in, the subsidiary's website | one mine's **actual production** for a period, location, method. Often scanned, which tests OCR |
| **EIA / EMP executive summary** | parivesh.nic.in, cmpdi.co.in | mine, company, district, state, method, **reserves**, capacity |
| **Environmental Clearance letter** | parivesh.nic.in | mine, company, location, method, a dated letter |
| **Mining plan / mine closure plan summary** | the subsidiary's website | reserves, method, location |
| **Subsidiary annual report**, English | nclcil.in, secl-cil.in, mcl.gov.in, … | company-level: company, year's production, date. Also tests a long document |
| **Subsidiary annual report**, Hindi (वार्षिक प्रतिवेदन) | same sites | the same fields, in real Hindi |

Try to include at least one scan and at least one Hindi document. Keep each
filename short and descriptive, e.g. `NCL_Jayant_EC-compliance_2024-H1.pdf`.

## Labelling one document

1. Put the PDF in this folder.
2. Write its skeleton. This needs no API key, and it fills in the hash for you:

       python -m evaluation.inspect_documents evaluation/real --labels

   An existing label is never overwritten.
3. Open `evaluation/labelled/REAL-<name>.json` and the PDF side by side:
   - Fill in `source`: `title`, `publisher`, and the `url` you downloaded it from.
   - Set `language` (`en`, `hi` or `te`).
   - For each field the document **states**, write the value under `expected`,
     and under `evidence` give the `page` number (as your PDF viewer counts
     it, starting at 1) and a `quote` of the words it was read from.
   - **Delete** every field the document does not state, from both `expected`
     and `evidence`. A field left blank is an error, not "not stated".
4. Check the label. This makes no provider calls and spends no quota:

       python -m evaluation.score --check

5. Once every value has been checked against its page, set `"status":
   "verified"` and put your name in `labelled_by`. Draft labels are never
   scored into the dashboard figure.
6. Score and record:

       python -m evaluation.score --json

7. Commit `evaluation/labelled/REAL-*.json` and `evaluation/latest.json`.
   **Never commit the PDF** (the gitignore already keeps it out).

## Rules for the values

The point of these rules is that the answer key reflects what the document
says, not what a reader or a model thinks it means.

- **Read the PDF, not DataForge.** Do not upload the document first and copy
  what the extractor says. That builds the extractor's own mistakes into the
  answer key, and the score then measures nothing.
- **Write values as the document writes them.** `6.25 MT` stays `6.25 MT`;
  do not convert it to tonnes. The scorer already treats `Opencast` and
  `Open Cast`, or `45,000 t` and `45000 tonnes`, as the same.
- **`quantity_extracted` is actual production, not capacity.** "Capacity 10
  MTPA" or "peak rated capacity" is not what was extracted. If the document
  gives only capacity, leave the field out.
- **`reserve_estimate`**: when several figures are given (geological,
  extractable, proved), label the one the document itself headlines, usually
  in its summary, and quote that sentence.
- **`report_date`** is the date on the document, written `DD-MM-YYYY`. A
  financial year alone ("FY 2023-24") is not a date; leave it out.
- **`mine_name`, `district`, `state`**: only if the document names one mine.
  A company annual report covering 40 mines has no single mine name.
- **`company_name`** as written on the document, including any abbreviation
  it gives, e.g. `Northern Coalfields Limited (NCL)`.
- **Unsure? Leave it out.** A field left out is not scored. A guessed field
  scores the labeller instead of the extractor.

## A label, filled in

This shows the shape only; the values are illustrative, not from a real
document.

```json
{
  "document": "evaluation/real/NCL_Jayant_EC-compliance_2024-H1.pdf",
  "corpus": "real",
  "status": "verified",
  "language": "en",
  "source": {
    "title": "Six-monthly EC compliance report, Jayant OCP, Apr-Sep 2024",
    "publisher": "Northern Coalfields Limited",
    "url": "https://…/jayant-ec-compliance-2024-h1.pdf",
    "retrieved": "2026-09-24",
    "sha256": "(written by inspect_documents)",
    "pages": 18
  },
  "labelled_by": "Your Name",
  "expected": {
    "mine_name": "Jayant Opencast Project",
    "district": "Singrauli",
    "quantity_extracted": "9.42 MT"
  },
  "evidence": {
    "mine_name": {"page": 1, "quote": "Jayant Opencast Project, NCL"},
    "district": {"page": 2, "quote": "located in Singrauli district of Madhya Pradesh"},
    "quantity_extracted": {"page": 5, "quote": "Coal production during Apr-Sep 2024: 9.42 MT"}
  }
}
```
