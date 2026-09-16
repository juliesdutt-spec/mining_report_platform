# Test corpus

Thirteen fictional mining reports for exercising DataForge end to end.
Regenerate with:

```bash
python samples/generate_test_corpus.py
```

Everything is invented — no real production figures, no real report
references. What is real is the *shape*: each file is built to drive one
specific path through the platform, so a demo can show a feature working
rather than hoping the corpus happens to contain the right thing.

## What each file is for

| File | Language | Tests |
|---|---|---|
| `EN-01_Jharia_BCCL_FY2024-25.pdf` | English | Baseline extraction — every field present |
| `EN-02_Gevra_SECL_FY2024-25.pdf` | English | Second mine, opencast, large producer |
| `EN-03_Gevra_SECL_FY2024-25_REVISED.pdf` | English | **Conflict**: EN-02's mine and year, 49.8 Mt against 52.5 Mt |
| `EN-04_Talcher_MCL_FY2023-24.pdf` | English | **Negative control** — a different year, so it must *not* be flagged against EN-02/03 |
| `EN-05_Bailadila_NMDC_FY2024-25.pdf` | English | A second mineral (iron ore), so the corpus isn't all coal |
| `EN-06_Korba_SECL_FY2024-25_INCOMPLETE.pdf` | English | **Missing data** — states outright that production figures are unavailable |
| `EN-07_Jharia_BCCL_FY2024-25_copy.pdf` | English | **Duplicate** — identical text to EN-01 under another filename |
| `HI-01_Jayant_NCL_FY2024-25.pdf` | Hindi | Devanagari extraction, 23.6 Mt |
| `HI-02_Jayant_NCL_FY2024-25_sanshodhit.pdf` | Hindi | **Conflict in Hindi** — same mine and year, 21.9 Mt |
| `TE-01_Ramagundam_SCCL_FY2024-25.pdf` | Telugu | Telugu extraction, opencast |
| `TE-02_Kothagudem_SCCL_FY2024-25.pdf` | Telugu | Telugu, underground, tonnes rather than million tonnes |
| `SCAN-01_Sohagpur_SECL_FY2024-25_scanned.pdf` | English | **OCR** — no text layer at all, only page images |
| `SCAN-02_Jayant_NCL_hindi_scanned.pdf` | Hindi | **OCR in Devanagari** — needs `tesseract-ocr-hin` |

The two `SCAN-*` files have no text layer whatsoever, so they cannot be read
by any means except OCR. They are the only honest test of that path: a
scanned-looking PDF that still carries text underneath proves nothing.

## A demo that shows something

1. Upload all thirteen. The dashboard should show 13 documents across five
   organisations and two minerals.
2. **Validation** — expect a production conflict on Gevra (EN-02 vs EN-03), the
   same in Hindi on Jayant (HI-01 vs HI-02), a duplicate (EN-01 vs EN-07), and
   missing data on Kusmunda (EN-06). Talcher should *not* appear: it is a
   different reporting year, and a detector that flags it is over-reporting.
3. **Ask DataForge** — "Which mine produced the most coal in FY 2024-25?" should
   answer from Gevra with a page citation. "What is the reserve position at
   Ramagundam?" exercises retrieval over Telugu.
4. **Data Explorer** — sort by production; the Telugu and Hindi rows should
   carry normalised English values for mineral and method, because the
   extraction prompt asks for those fields transliterated.
5. **Documents** — open `SCAN-01`. Its text came from OCR, and evidence from it
   still cites a page number.

## Known rough edges, deliberately left in

- `SCAN-02` OCRs "नॉर्दर्न" imperfectly in one place, because the language list
  is `eng+hin+tel` and tesseract occasionally reaches for the wrong script.
  That is what real multi-language OCR does, and it is a fair thing for
  confidence-based validation to be judged on.
- The Hindi PDFs carry shaped Devanagari, which `pypdf` extracts with some
  stray control characters. This is a property of how the text is drawn into
  the PDF, and it is worth seeing: real Hindi government PDFs extract badly too.
