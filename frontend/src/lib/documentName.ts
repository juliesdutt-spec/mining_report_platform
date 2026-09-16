/**
 * Shorten a document name without throwing away the end of it.
 *
 * Uploaded files are not always named by a person. A corpus exported from
 * another system arrives as `67b42e623b87c91f0a...pdf`, and one of those laid
 * raw into a table cell is a single unbreakable token: it widens its column
 * until every other column is squeezed off the screen, and the reader learns
 * nothing from the forty characters they can see.
 *
 * Truncating from the middle keeps the start, which is what distinguishes one
 * file from its neighbours, and the extension, which is what says what it is.
 * The full name stays available as a `title`, so nothing is actually lost.
 */
export function shortenDocumentName(name: string, max = 34): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length <= max) return trimmed;

  // Only treat a trailing dot-group as an extension if it is short enough to
  // actually be one; "report.final.summary" should not lose ".summary".
  const dot = trimmed.lastIndexOf(".");
  const extension = dot > 0 && trimmed.length - dot <= 6 ? trimmed.slice(dot) : "";
  const stem = extension ? trimmed.slice(0, dot) : trimmed;

  const room = max - extension.length - 1; // one character for the ellipsis
  if (room < 8) return `${trimmed.slice(0, Math.max(1, max - 1))}…`;

  // Weighted towards the front: the leading characters carry the identity.
  const head = Math.ceil(room * 0.62);
  const tail = room - head;
  return `${stem.slice(0, head)}…${stem.slice(stem.length - tail)}${extension}`;
}
