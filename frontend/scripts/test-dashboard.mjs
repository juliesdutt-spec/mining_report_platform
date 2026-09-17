/**
 * The dashboard.
 *
 * It is the first screen after sign-in, and four of the things on it were
 * saying something untrue.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../src/pages/DashboardPage.tsx", import.meta.url), "utf8");

test("an empty state waits until the request has come back", () => {
  // Measured before: with /reports taking 2.5s, the dashboard told a reader
  // with sixteen indexed documents "No documents indexed yet. Upload a report
  // to begin", and showed no skeleton anywhere to suggest otherwise. Said
  // while the request is in flight it is not a state, it is a false statement
  // about the corpus.
  assert.match(dashboard, /\{!isLoadingDocs && filteredDocs\.length === 0 && \(/);
  assert.match(dashboard, /\{!isLoadingAlerts && openAlerts\.length === 0 && \(/);
  assert.match(dashboard, /\{!isLoadingQueries && recentQueries\.length === 0 && \(/);
});

test("each table shows it is working rather than showing nothing", () => {
  for (const key of ["doc-skeleton", "alert-skeleton", "query-skeleton"]) {
    assert.ok(dashboard.includes(key), `no loading rows for ${key}`);
  }
});

test("a refused request cannot pass for an empty corpus", () => {
  // Every fetch was caught into an empty array, so a backend refusing
  // connections rendered identically to a database with nothing in it.
  assert.match(dashboard, /<LoadFailure/);
  assert.match(dashboard, /setReloadKey\(\(key\) => key \+ 1\)/);
  // Retrying has to re-run the requests, not just clear the message.
  assert.match(dashboard, /\}, \[reloadKey\]\)/);
  assert.match(dashboard, /\}, \[selectedOrganisation, reloadKey\]\)/);
  assert.doesNotMatch(dashboard, /\.catch\(\(\) => setDocuments\(\[\]\)\)/);
});

test("the discrepancies tab says it is empty once, at the right width", () => {
  // It was written twice — once at colSpan 6 over a five-column table, once
  // at colSpan 5 below the rows — so an empty tab said so twice, in two
  // different widths.
  const matches = dashboard.match(/No open discrepancies/g) ?? [];
  assert.equal(matches.length, 1, "the empty state is duplicated again");
  assert.doesNotMatch(dashboard, /colSpan=\{6\}/, "colSpan 6 over a five-column table");
});

test("a count nobody has taken yet is not rendered as zero", () => {
  assert.match(dashboard, /Documents\{isLoadingDocs \? "" : ` \(\$\{filteredDocs\.length\}\)`\}/);
  assert.match(dashboard, /Discrepancies\{isLoadingAlerts \? "" : ` \(\$\{openAlerts\.length\}\)`\}/);
});

test("answers are rendered, not printed as Markdown source", () => {
  // 76 pairs of asterisks were on screen at once, one tab away from the Ask
  // page that renders them properly.
  assert.match(dashboard, /<Markdown text=\{q\.answer\}/);
  assert.doesNotMatch(dashboard, /\{q\.answer\}\s*\n?\s*<\/p>/);
});

test("the dashboard summarises the questions rather than dumping them", () => {
  // /query-history returns twenty, each with a full answer.
  assert.match(dashboard, /const RECENT_QUERY_LIMIT = \d+;/);
  assert.match(dashboard, /recentQueries\.slice\(0, RECENT_QUERY_LIMIT\)/);
  assert.match(dashboard, /recentQueries\.length > RECENT_QUERY_LIMIT/);
});

test("every cell in the documents table falls back the same way", () => {
  // Output rendered blank where its siblings rendered an em dash.
  assert.match(dashboard, /\{doc\.quantityExtracted \?\? "\\u2014"\}/);
});

test("nothing on the dashboard appears out of nowhere", () => {
  // Measured: the quality panel returned null while the counts were in
  // flight, then appeared and pushed the Activity section 111px down. The
  // stat strip had a separate skeleton copy with a different box model and
  // grew 7px. Together they put the dashboard at CLS 0.055; it is 0.002 now.
  const quality = readFileSync(new URL("../src/components/shared/ExtractionQuality.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(quality, /if \(!quality\) return null;/);
  // Both states build their cells from the same component, so the box model
  // cannot drift between them.
  assert.equal((quality.match(/<QualityCell/g) ?? []).length, 4);
  assert.equal((quality.match(/className=\{FRAME\}/g) ?? []).length, 2);
  // And the strip is the real one in both states — labels are static text.
  assert.doesNotMatch(dashboard, /grid grid-cols-2 gap-6 border-y border-border py-4/);
  assert.match(dashboard, /value=\{stats \? stats\.total_reports\.toLocaleString\("en-IN"\) : <StatSkeleton \/>\}/);
});

test("monospace is kept for figures and identifiers, not for names", () => {
  // Geist Mono earns its place on a tonnage, a page number, a snake_case
  // field name — a fixed advance lines digits up and says "read from the
  // document, unaltered". Spent on a company's name it says the opposite:
  // "Coal India Limited (CIL)" set as code reads as a database key.
  const organisation = dashboard.slice(
    dashboard.indexOf("{doc.organisation") - 260,
    dashboard.indexOf("{doc.organisation")
  );
  assert.doesNotMatch(organisation, /font-mono/, "organisation is a name, not a figure");

  // The columns that are figures keep it, and keep tabular figures with it.
  const quantity = dashboard.slice(
    dashboard.indexOf("{doc.quantityExtracted") - 200,
    dashboard.indexOf("{doc.quantityExtracted")
  );
  assert.match(quantity, /font-mono[^"]*tabular-nums/);

  // So does the field name, which really is snake_case off the backend.
  const field = dashboard.slice(
    dashboard.indexOf("{alert.fieldName") - 160,
    dashboard.indexOf("{alert.fieldName")
  );
  assert.match(field, /font-mono/);
});

test("the sentence standing in for a measurement is not set as one", () => {
  // "Not measured" occupied the slot a percentage occupies, at the same size,
  // in the face this platform reserves for measured figures. That is how an
  // absence of evidence starts looking like a reading.
  const quality = readFileSync(
    new URL("../src/components/shared/ExtractionQuality.tsx", import.meta.url), "utf8"
  );
  const notMeasured = quality.slice(quality.indexOf("Not measured") - 200, quality.indexOf("Not measured"));
  assert.doesNotMatch(notMeasured, /font-mono/);
  // The real percentage beside it keeps mono, or this proves nothing.
  assert.match(quality, /font-mono text-2xl[^>]*>\s*\n?\s*\{Math\.round\(measured\.accuracy/);
});
