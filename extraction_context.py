# -*- coding: utf-8 -*-
"""
Choose which parts of a document extraction should read.

The extraction prompt has a character budget, and until now it spent that
budget on the opening of the document: `text[:8000]`. On the two-page
fixtures this project was built against, that is the whole document and the
choice is invisible. On a real one it is not. A 342-page Coal India annual
report runs to roughly half a million characters, so the first 8000 are the
cover, the contents page and the chairman's foreword - and every extracted
field comes from there. The platform reports "completed" over values read
from about one percent of the document.

The budget was never the problem. Spending it on the beginning was. This
module picks the passages most likely to carry the fields the schema asks
for, from anywhere in the document, and hands back the same amount of text.
The model call costs exactly what it did before, and no embedding quota is
spent choosing - selection is lexical, so it works with no vector database
configured, no API key, and no network.

Two properties matter more than cleverness here:

  Short documents must come back unchanged. Everything in the evaluation
  corpus fits inside the budget, so selection is a no-op there and the
  measured accuracy of those documents cannot move. A change that improves
  long documents by quietly altering short ones would be impossible to
  attribute.

  Selection must not be English-only. The corpus is English, Hindi and
  Telugu, and a Latin-only cue list would silently down-rank every Devanagari
  and Telugu passage - turning a multilingual system into an English one with
  extra steps.
"""
from __future__ import annotations

import re
from typing import Iterable, Sequence

import vector_store

#: Roughly what the extraction prompt can spend on document text.
#: Matched to ai_extractor's existing slice so this is a change of *which*
#: characters are sent, never of how many.
DEFAULT_BUDGET_CHARS = 8000

#: Cues per field group, lowercased. Hindi and Telugu are listed beside the
#: English because the corpus is trilingual; an English-only list would rank
#: an entire Hindi report below a passing English footer.
#:
#: These are deliberately ordinary words rather than a tuned vocabulary. The
#: job is to tell "this passage talks about production" from "this passage is
#: a table of contents", not to parse the sentence.
FIELD_CUES: dict[str, tuple[str, ...]] = {
    "identity": (
        "limited", "ltd", "colliery", "collieries", "company", "subsidiary",
        "कंपनी", "लिमिटेड", "खान", "సంస్థ", "లిమిటెడ్", "గని",
    ),
    "period": (
        "financial year", "fiscal", "during the year", "reporting period",
        "quarter", "fy20", "fy 20", "वर्ष", "वित्तीय", "अवधि",
        "సంవత్సరం", "ఆర్థిక",
    ),
    "location": (
        "district", "state of", "tehsil", "village", "block", "coalfield",
        "located", "situated", "जिला", "राज्य", "क्षेत्र", "स्थित",
        "జిల్లా", "రాష్ట్రం", "ప్రాంతం",
    ),
    "production": (
        "production", "produced", "output", "extracted", "despatch",
        "dispatch", "tonne", "tonnes", "million tonnes", "mt", "lakh",
        "overburden", "उत्पादन", "टन", "निष्कासन", "ఉత్పత్తి", "టన్నులు",
    ),
    "reserves": (
        "reserve", "reserves", "proved", "indicated", "inferred",
        "estimated reserves", "geological", "भंडार", "अनुमानित", "सिद्ध",
        "నిల్వలు", "అంచనా",
    ),
    "method": (
        "opencast", "open cast", "underground", "mining method", "longwall",
        "board and pillar", "खुली", "भूमिगत", "विधि",
        "ఓపెన్‌కాస్ట్", "భూగర్భ", "పద్ధతి",
    ),
    "mineral": (
        "coal", "coking", "non-coking", "lignite", "iron ore", "bauxite",
        "mineral", "grade", "कोयला", "खनिज", "బొగ్గు", "ఖనిజ",
    ),
    "environment": (
        "environment", "environmental", "reclamation", "plantation",
        "afforestation", "safety", "accident", "पर्यावरण", "सुरक्षा",
        "పర్యావరణ", "భద్రత",
    ),
}

#: A figure with a unit or a separator, which is what a production or reserve
#: statement looks like in every language here. Passages carrying numbers are
#: worth more than prose that merely mentions the topic - "production rose
#: sharply" is not a value, "21.9 million tonnes" is.
_NUMERIC = re.compile(r"\d[\d,.]*\s*(?:%|million|lakh|crore|mt\b|tonne|टन|టన్నులు)?", re.I)
_DIGITS = re.compile(r"\d")


def _score(text: str) -> tuple[float, dict[str, int]]:
    """How much this passage looks like it carries schema fields, and which."""
    lowered = text.lower()
    hits: dict[str, int] = {}
    for group, cues in FIELD_CUES.items():
        count = sum(lowered.count(cue) for cue in cues)
        if count:
            hits[group] = count

    # Breadth beats repetition: a passage touching four field groups is worth
    # more than one saying "coal" forty times, which is what a running header
    # does.
    breadth = len(hits)
    depth = sum(min(count, 3) for count in hits.values())
    numbers = len(_DIGITS.findall(text)) / max(len(text), 1)

    return breadth * 2.0 + depth * 0.5 + numbers * 12.0, hits


def _head_chunks(chunks: Sequence[dict], budget: int) -> list[int]:
    """
    Indices of the opening passages, which are kept regardless of score.

    Company name, mine name and reporting period live on the title page and
    nowhere else in many reports. They rarely score well - a cover page is
    mostly a logo and a title - so scoring alone would drop the very fields
    that identify the document.
    """
    kept: list[int] = []
    spent = 0
    for index, chunk in enumerate(chunks[:2]):
        length = len(chunk["content"])
        if spent + length > budget:
            break
        kept.append(index)
        spent += length
    return kept


def select_passages(
    page_texts: Sequence[str] | None,
    raw_text: str | None = None,
    budget: int = DEFAULT_BUDGET_CHARS,
) -> tuple[str, list[int]]:
    """
    The text extraction should read, and the pages it came from.

    Returns the excerpt and the sorted page numbers it was drawn from, so an
    operator can be told which pages a value was read from rather than being
    asked to trust that the right ones were chosen.

    A document that fits inside the budget comes back whole, in order, which
    is what every document in the evaluation corpus does.
    """
    chunks = vector_store.chunk_pages(page_texts, raw_text)
    if not chunks:
        return "", []

    total = sum(len(chunk["content"]) for chunk in chunks)
    if total <= budget:
        # Short document: nothing to choose between. Join in document order.
        text = "\n\n".join(chunk["content"] for chunk in chunks)
        pages = sorted({chunk["page"] for chunk in chunks if chunk["page"]})
        return text, pages

    scored = [(index, *_score(chunk["content"])) for index, chunk in enumerate(chunks)]

    chosen = set(_head_chunks(chunks, budget))
    spent = sum(len(chunks[index]["content"]) for index in chosen)

    # One pass per field group before any group gets a second passage, so a
    # report that discusses production for eighty pages cannot crowd out the
    # single paragraph naming the district.
    by_group: dict[str, list[tuple[float, int]]] = {group: [] for group in FIELD_CUES}
    for index, score, hits in scored:
        for group in hits:
            by_group[group].append((score, index))
    for group in by_group:
        by_group[group].sort(reverse=True)

    # A cursor per group, not one shared between them. A shared cursor stalls:
    # when a group's next candidate is already chosen the cursor never
    # advances, so that group is skipped for the rest of the selection and the
    # budget is left part-spent.
    cursor = {group: 0 for group in FIELD_CUES}

    while spent < budget:
        added = False
        for group in FIELD_CUES:
            candidates = by_group[group]
            while cursor[group] < len(candidates):
                _, index = candidates[cursor[group]]
                cursor[group] += 1
                if index in chosen:
                    continue
                length = len(chunks[index]["content"])
                if spent + length > budget:
                    continue
                chosen.add(index)
                spent += length
                added = True
                break
            if spent >= budget:
                break
        if not added:
            break

    # Whatever is left goes to the best-scoring passages regardless of group.
    # Stopping with budget unspent sends the model less evidence than it was
    # willing to read, for no reason.
    if spent < budget:
        for index, _score_value, _hits in sorted(scored, key=lambda row: row[1], reverse=True):
            if index in chosen:
                continue
            length = len(chunks[index]["content"])
            if spent + length > budget:
                continue
            chosen.add(index)
            spent += length
            if spent >= budget:
                break

    ordered = sorted(chosen)
    parts: list[str] = []
    previous: int | None = None
    for index in ordered:
        chunk = chunks[index]
        # Mark a jump so the model is not told that two distant passages are
        # one continuous argument, and so a page number stays attached to the
        # text it belongs to.
        if previous is not None and index != previous + 1:
            parts.append(f"[... page {chunk['page']} ...]" if chunk["page"] else "[...]")
        parts.append(chunk["content"])
        previous = index

    pages = sorted({chunks[index]["page"] for index in ordered if chunks[index]["page"]})
    return "\n\n".join(parts), pages
