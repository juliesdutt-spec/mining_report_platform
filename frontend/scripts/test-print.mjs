/**
 * The print rules in index.css.
 *
 * The app is a fixed-height shell: h-screen on the frame, overflow hidden on
 * it, and a scroll container for the page. Right on a screen and wrong on
 * paper — measured before these rules, printing the Data Explorer gave one A4
 * sheet carrying nine of sixteen rows, with four of nine columns cut off the
 * right edge and nothing on the sheet to say so. Topics printed 844px of 2910.
 *
 * scripts/ux-audit.mjs drives the behaviour in a real browser under print
 * media; these pin the decisions a browser test would not explain.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/index.css");
const shell = read("../src/components/layout/AppShell.tsx");
const pageHeader = read("../src/components/shared/PageHeader.tsx");

const print = css.slice(css.indexOf("@media print"));

test("the stylesheet has print rules at all", () => {
  assert.ok(print.length > 0, "no @media print block in index.css");
});

test("the shell stops being a viewport on paper", () => {
  // Every one of these was clamping the document to one screenful.
  for (const id of ["#app-shell", "#app-content", "#main-content"]) {
    assert.ok(print.includes(id), `${id} is not released for print`);
  }
  assert.match(print, /overflow: visible !important/);
  assert.match(print, /height: auto !important/);
});

test("chrome that cannot be used on paper is left off", () => {
  assert.match(print, /#app-sidebar,\s*\n\s*header,/);
  assert.match(print, /\[data-print-hide\]/);
  assert.match(print, /\[role="dialog"\]/);
  assert.match(pageHeader, /data-print-hide/);
});

test("the sheet says which screen it is, whose, and when", () => {
  // With the sidebar and header gone there is otherwise nothing on a page of
  // production figures to say what it is a record of.
  assert.match(shell, /hidden border-b border-border pb-3 print:block/);
  assert.match(shell, /DataForge · \{TAB_TITLES\[currentTab\]\}/);
  assert.match(shell, /Scope:/);
  assert.match(shell, /Printed \{new Date\(\)\.toLocaleString\("en-IN"\)\}/);
});

test("a long table repeats its headings and does not split a row", () => {
  assert.match(print, /thead \{\s*\n\s*display: table-header-group;/);
  assert.match(print, /tr,[\s\S]*break-inside: avoid/);
});

test("the app's gutter is dropped, because @page already gives one", () => {
  // Two margins stacked cost the table the 21px it needed to fit.
  assert.match(print, /#main-content > div \{[\s\S]*padding-left: 0 !important/);
  assert.match(print, /@page \{\s*\n\s*margin: 14mm;/);
});

test("figures are never broken mid-number, filenames always may be", () => {
  // `anywhere` on every cell fitted the width and wrecked the content:
  // METHOD came out "METHO / D" and a production figure "1,25,0 / 00 MT".
  assert.match(print, /overflow-wrap: break-word !important/);
  assert.match(print, /td \.font-mono:not\(\.tabular-nums\),[\s\S]*overflow-wrap: anywhere !important/);
  assert.doesNotMatch(print, /^\s*th,\s*\n\s*td \{[^}]*overflow-wrap: anywhere/m);
});

test("paper is white whatever the reader's theme is", () => {
  const themed = print.slice(print.indexOf(":root,"));
  assert.match(themed, /:root\.dark \{/);
  assert.match(themed, /--background: 0 0% 100%/);
  assert.match(themed, /--foreground: 0 0% 0%/);
});
