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
