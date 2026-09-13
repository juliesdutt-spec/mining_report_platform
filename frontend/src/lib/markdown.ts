/**
 * The small slice of Markdown that a language model actually emits.
 *
 * Answers came back onto the page as raw source: `**Question:**` with the
 * asterisks showing, bullet lists as a run of hyphens, and a production table
 * as a wall of pipes. Every provider formats this way whether or not it is
 * asked to, so the answer has to be parsed rather than the model told to stop.
 *
 * It is a parser, not a renderer: it returns a description of the blocks and
 * the component turns those into elements. Nothing here produces HTML, so
 * model output has no way to inject any — which is the reason not to reach for
 * a full Markdown library plus a sanitiser for six constructs.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; spans: Inline[] }
  | { type: "paragraph"; spans: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "code"; text: string }
  | { type: "table"; head: Inline[][]; rows: Inline[][][]; numeric: boolean[] };

const BULLET = /^\s{0,3}[-*•]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const FENCE = /^\s{0,3}```/;
const TABLE_ROW = /^\s{0,3}\|(.+)\|\s*$/;
const TABLE_RULE = /^\s{0,3}\|[\s:|-]+\|\s*$/;

/**
 * Inline spans.
 *
 * One pass, longest-marker-first, so `**bold**` is never read as two `*em*`.
 * A link renders as its label alone: the href would be a URL chosen by the
 * model, and a grounded answer has no reason to send the reader off-site.
 */
export function parseInline(input: string): Inline[] {
  const spans: Inline[] = [];
  let rest = input.replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1");
  const pattern = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])|`([^`]+)`/;

  for (;;) {
    const match = pattern.exec(rest);
    if (!match) break;
    if (match.index > 0) spans.push({ type: "text", text: rest.slice(0, match.index) });
    if (match[1] !== undefined || match[2] !== undefined) {
      spans.push({ type: "strong", text: match[1] ?? match[2] });
    } else if (match[3] !== undefined || match[4] !== undefined) {
      spans.push({ type: "em", text: match[3] ?? match[4] });
    } else {
      spans.push({ type: "code", text: match[5] });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest) spans.push({ type: "text", text: rest });
  return spans.length ? spans : [{ type: "text", text: "" }];
}

const cells = (row: string) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

/** Whether a column holds figures, so the renderer can right-align it. */
const looksNumeric = (values: string[]) =>
  values.length > 0 && values.every((v) => v === "" || /^[₹$]?[\d,.\s]+(%|MT|mt|kg|t|ha)?$/.test(v.trim()));

export function parseMarkdown(source: string): Block[] {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buffer: string[]) => {
    const text = buffer.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", spans: parseInline(text) });
    buffer.length = 0;
  };

  const paragraph: string[] = [];
  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flushParagraph(paragraph);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i += 1; // closing fence, or the end of the input
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    // A table needs its separator row; without one the pipes are just text.
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      flushParagraph(paragraph);
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]));
      const numeric = head.map((_, c) => looksNumeric(rows.map((r) => r[c] ?? "")));
      blocks.push({
        type: "table",
        head: head.map(parseInline),
        rows: rows.map((r) => r.map(parseInline)),
        numeric,
      });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      // An answer sits under the question, which is already the page's h2, so
      // model headings start a level below it and never climb past h4.
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, spans: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      flushParagraph(paragraph);
      const ordered = !BULLET.test(line);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const bullet = BULLET.exec(lines[i]);
        const numbered = ORDERED.exec(lines[i]);
        if (ordered && numbered) items.push(parseInline(numbered[2]));
        else if (!ordered && bullet) items.push(parseInline(bullet[1]));
        else break;
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(paragraph);
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph(paragraph);
  return blocks;
}
