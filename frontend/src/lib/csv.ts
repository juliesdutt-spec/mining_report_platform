/**
 * CSV serialisation and download for the Analytics export.
 *
 * Kept separate from the page so the escaping rules are testable on their own:
 * mineral names and locations come from uploaded documents, so a value can
 * legitimately contain a comma, a quote or a newline, and any of those written
 * raw would shift every following column.
 */

/**
 * Quote a single field per RFC 4180.
 *
 * A field is quoted only when it has to be, so ordinary values stay readable
 * in the file. Embedded quotes are doubled, which is how the format escapes
 * them - backslashes are not special in CSV and would be read literally.
 */
export function escapeCsvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Join rows into a CSV document, with CRLF line endings as the format specifies. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

/**
 * Hand a generated CSV to the browser as a download.
 *
 * The object URL is revoked once the click has been dispatched: without that
 * every export leaks a blob for the lifetime of the tab. The anchor is created
 * and removed per call rather than being reused, so repeated exports cannot
 * accumulate handlers or fire more than one download each.
 *
 * The BOM is deliberate - Excel reads a UTF-8 CSV as the local codepage
 * without it, which mangles any non-ASCII place name.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    // Safari needs the URL to outlive the click, so revoke on the next tick.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
