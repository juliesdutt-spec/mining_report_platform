/**
 * Three places where a value was displayed in a way that misread it.
 *
 * Found by looking at the pages in the typeface they are actually set in —
 * until the fonts were self-hosted, every screenshot of this app was taken in
 * a system fallback, so the metrics were never the shipped ones.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require(path.join(here, "..", "node_modules", "esbuild"));
const built = esbuild.buildSync({
  entryPoints: [path.join(here, "..", "src", "components", "shared", "SourceComparator.tsx")],
  bundle: true, format: "cjs", write: false, platform: "node",
  external: ["react", "react/jsx-runtime"],
  loader: { ".tsx": "tsx" },
});
// Written inside the project, not /tmp: the bundle leaves react external, and
// from a temp directory node cannot resolve it.
const cache = path.join(here, "..", "node_modules", ".cache");
fs.mkdirSync(cache, { recursive: true });
const tmp = path.join(cache, "source-comparator.test.cjs");
fs.writeFileSync(tmp, built.outputFiles[0].text);
const { valueSize } = require(tmp);

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const analytics = read("../src/pages/AnalyticsPage.tsx");
const studio = read("../src/pages/ReportStudioPage.tsx");
const audit = read("./ux-audit.mjs");

test("a figure keeps the size that makes the comparison read instantly", () => {
  // The whole point of the two panes is that 3,50,000 MT against 2,90,000 MT
  // is legible at a glance.
  assert.equal(valueSize("3,50,000 MT"), "text-3xl");
  assert.equal(valueSize("125000"), "text-3xl");
  assert.equal(valueSize(undefined), "text-3xl");
});

test("a value too long for its pane is stepped down instead of overrunning", () => {
  // Measured: sample_mining_report.pdf at 30px overran its pane by 135px and
  // collided with the value beside it. A duplicate finding disputes `filename`,
  // so this is a real field, not a hypothetical one.
  assert.equal(valueSize("sample_mining_report.pdf"), "text-lg [overflow-wrap:anywhere]");
  assert.match(valueSize("Opencast, multi-seam"), /text-lg/);
  // Longer again — a mine name and its block, say — steps down once more.
  assert.equal(valueSize("Korba Block B, Gevra expansion"), "text-sm [overflow-wrap:anywhere]");
});

test("only the stepped-down sizes may break inside a token", () => {
  // Breaking 1,25,000 mid-number would read as a different figure.
  for (const value of ["3,50,000 MT", "125000", "2,50,000 MT"]) {
    assert.doesNotMatch(valueSize(value), /overflow-wrap/, `${value} must never break`);
  }
});

test("a bar chart with one category draws a bar, not a filled panel", () => {
  // recharts divides the plot area between however many categories there are:
  // one location drew a 510px block, and two would take half the chart each.
  assert.match(analytics, /maxBarSize=\{\d+\}/);
});

test("the dossier does not paint every status green", () => {
  // A document whose extraction failed was listed in the same colour as one
  // that succeeded, on a page whose own banner promises that sections without
  // supporting data say so.
  assert.doesNotMatch(studio, /className="text-xs text-success">\{doc\.status\}/);
  assert.match(studio, /<StatusBadge status=\{doc\.status\} \/>/);
});

test("the audit watches for content spilling out of its box", () => {
  // The page did not scroll sideways, so the existing horizontal-scroll check
  // never saw the overlap.
  assert.match(audit, /overflows its box by/);
  assert.match(audit, /style\.overflowX !== "visible"/);
});
