/**
 * The sign-in screen.
 *
 * Every pass in ux-audit.mjs began by signing in, so the one page every
 * visitor sees first had never been checked. It is checked now, in both
 * themes and at both widths, and it found two contrast failures on the first
 * run.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const login = read("../src/pages/LoginPage.tsx");
const backdrop = read("../src/components/brand/StrataBackdrop.tsx");
const wordmark = read("../src/components/brand/Wordmark.tsx");
const audit = read("./ux-audit.mjs");
const css = read("../src/index.css");

test("the backdrop is drawn, not fetched", () => {
  // A coal-mine photograph off the web is someone's copyright, and this is a
  // submission to a government competition. It is also 200 kB–2 MB on the one
  // request that decides whether the page feels instant.
  // `url(#df-ground)` is how SVG references its own gradients — the point is
  // that nothing is fetched over the network.
  assert.doesNotMatch(backdrop, /<img\b|url\(["']?(https?:|\/|\.)/);
  assert.doesNotMatch(backdrop, /\.(jpe?g|png|webp|avif|gif)\b/);
  assert.doesNotMatch(backdrop, /https?:\/\//);
  assert.match(backdrop, /<svg/);
  // Gradients, not SVG filters: feGaussianBlur at full-bleed size is expensive
  // to rasterise on every paint.
  assert.doesNotMatch(backdrop, /feGaussianBlur|filter=/);
});

test("the ground under the headline is chosen, not inherited", () => {
  // A photograph's luminance varies across the frame, so contrast becomes
  // something you hope for. The panel is a fixed dark value in both themes.
  assert.match(login, /bg-\[#04070f\]/);
  assert.match(login, /tone="light"/);
  assert.match(backdrop, /df-scrim/);
});

test("the wordmark declares its exemption rather than assuming it", () => {
  // WCAG 1.4.3 exempts text that is part of a logo or brand name. The orange
  // half is 2.51:1 on the light canvas and stays there, because it is the mark.
  assert.match(wordmark, /data-logotype="DataForge"/);
  assert.match(audit, /el\.closest\("\[data-logotype\]"\)/);
  assert.match(audit, /WCAG 1\.4\.3 exempts/);
});

test("the exemption covers the mark and nothing else", () => {
  // A blanket skip would be a way to silence real findings — and there was a
  // real one on this page: 12px brand orange on the light canvas, also 2.51:1,
  // in text that is not a logo.
  //
  // The evaluator card's heading is where that finding was. The orange is a
  // 3px rule beside it now; the words are on --foreground.
  assert.match(login, /const SECTION_LABEL =\s*\n?\s*"[^"]*text-foreground"/);
  assert.match(login, /className=\{SECTION_LABEL\}>Evaluator access/);
  assert.doesNotMatch(login, /text-brand[^>]*>\s*\n?\s*(Evaluator access|System status)/);
});

test("the audit now opens the page a visitor opens first", () => {
  assert.match(audit, /"sign-in"/);
  assert.match(audit, /"sign-in 390px"/);
  // Both themes, because the panel is dark in one of them by design.
  assert.match(audit, /for \(const theme of \["light", "dark"\]\)/);
  // And the demo account is the only way in for someone never issued
  // credentials, so its absence is a broken deployment.
  assert.match(audit, /no demo sign-in offered/);
});

test("the backdrop's drift settles where it started", () => {
  // The reduced-motion rule collapses an animation to 0.01ms and one
  // iteration, which lands on the final keyframe. A drift that ended
  // displaced would jump the image instead of stopping it.
  for (const name of ["df-strata-drift", "df-seam-breathe"]) {
    const frames = css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf("}", css.indexOf(`@keyframes ${name}`) + 200));
    assert.match(frames, /0%,\s*\n?\s*100% \{/, `${name} must start and end in the same place`);
  }
});


/* ---------------------------------------------------------------------- */
/* The status panel, run rather than read.                                 */
/*                                                                         */
/* A panel of four green dots is worth nothing if the dots are painted on. */
/* These drive a degraded backend through the same function the page calls */
/* and check it reports the degradation.                                   */
/* ---------------------------------------------------------------------- */

const require_ = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require_(path.join(here, "..", "node_modules", "esbuild"));
const bundle = esbuild.buildSync({
  entryPoints: [path.join(here, "..", "src", "lib", "systemStatus.ts")],
  bundle: true, format: "cjs", write: false, platform: "node",
  loader: { ".ts": "ts" },
});
const cache = path.join(here, "..", "node_modules", ".cache");
mkdirSync(cache, { recursive: true });
const built = path.join(cache, "system-status.test.cjs");
writeFileSync(built, bundle.outputFiles[0].text);
const { statusRows } = require_(built);

const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));
const healthy = {
  online: true,
  ai: { ai_mode: "gemini", ai_model: "gemini-3.6-flash", ai_mode_reason: null },
  retrieval: { enabled: true, indexed_chunks: 240, indexed_reports: 6, index_reason: null, embeddings_reason: null },
  ocr: { ok: true, reason: null, version: "5.3.4", languages: "eng+hin+tel" },
};

test("nothing is claimed before the backend has answered", () => {
  for (const row of statusRows(null)) {
    assert.equal(row.tone, "idle");
    assert.equal(row.value, "Checking…");
  }
});

test("an unreachable API does not leave three rows reading operational", () => {
  // This is the failure the panel is most likely to be seen in, and the one a
  // decorative panel gets wrong.
  const rows = byLabel(statusRows({ online: false, ai: null, retrieval: null }));
  assert.equal(rows.API.tone, "down");
  assert.equal(rows.API.value, "Unreachable");
  for (const label of ["Document engine", "Semantic search", "Evidence retrieval", "Scanned documents"]) {
    assert.equal(rows[label].value, "Unknown", `${label} cannot be known from here`);
    assert.notEqual(rows[label].tone, "ok");
  }
});

test("mock answers are reported as stand-ins, not as a working engine", () => {
  const rows = byLabel(statusRows({
    ...healthy,
    ai: { ai_mode: "mock", ai_model: null, ai_mode_reason: "No API key is configured." },
  }));
  assert.equal(rows["Document engine"].tone, "warn");
  assert.equal(rows["Document engine"].value, "Stand-in mode");
  assert.equal(rows["Document engine"].detail, "No API key is configured.");
});

test("an index that is off carries the backend's own reason", () => {
  const rows = byLabel(statusRows({
    ...healthy,
    retrieval: {
      enabled: false, indexed_chunks: 0, indexed_reports: 0,
      index_reason: "VECTOR_DATABASE_URL is not set.", embeddings_reason: null,
    },
  }));
  assert.equal(rows["Semantic search"].tone, "warn");
  assert.equal(rows["Semantic search"].detail, "VECTOR_DATABASE_URL is not set.");
});

test("an index that is reachable but empty is not the same as one that is broken", () => {
  // The production index has been empty for most of this project's life. The
  // fix is one button in Settings, and saying "unavailable" would send an
  // operator looking at the deployment instead.
  const rows = byLabel(statusRows({
    ...healthy,
    retrieval: { enabled: true, indexed_chunks: 0, indexed_reports: 0, index_reason: null, embeddings_reason: null },
  }));
  assert.equal(rows["Semantic search"].value, "Index empty");
  assert.equal(rows["Semantic search"].tone, "warn");
});

test("a healthy backend does read operational, across all five", () => {
  const rows = statusRows(healthy);
  assert.equal(rows.length, 5);
  for (const row of rows) assert.equal(row.tone, "ok", `${row.label} should be ok`);
  assert.equal(byLabel(rows)["Semantic search"].detail, "6 reports · 240 passages");
});

test("a host that cannot read scans says so rather than showing green", () => {
  // The failure this row exists for: pytesseract installs without the binary
  // it wraps, so scanned uploads succeed and extract nothing.
  const rows = byLabel(statusRows({
    ...healthy,
    ocr: { ok: false, reason: "the tesseract binary is not on PATH", version: null, languages: null },
  }));
  assert.equal(rows["Scanned documents"].value, "Cannot be read");
  assert.equal(rows["Scanned documents"].tone, "warn");
  assert.equal(rows["Scanned documents"].detail, "the tesseract binary is not on PATH");
});

test("a backend too old to report OCR does not crash the panel or cry wolf", () => {
  // `ocr` absent is undefined, not null. A strict null check here threw on
  // every row, so the panel that exists to report a degraded backend was the
  // thing that broke against one.
  const { ocr, ...older } = healthy;
  const rows = byLabel(statusRows(older));
  assert.equal(rows["Scanned documents"].tone, "idle");
  assert.equal(rows["Scanned documents"].value, "Not reported");
  assert.equal(rows.API.tone, "ok", "the rest of the panel still reports");
});

test("the demo button the audit clicks is the one the page renders", () => {
  // Renaming it and not the audit would silently stop every page after
  // sign-in from being audited at all.
  const name = login.match(/onClick=\{\(e\) => submit\(e, demo\)\}[\s\S]{0,200}?>\s*\n\s*([^\n<]+)/);
  assert.ok(name, "the demo button should have a visible label");
  assert.match(audit, new RegExp(name[1].trim().toLowerCase().replace(/\s+/g, "\\s+"), "i"));
});

test("the column can grow taller than the viewport without losing its top", () => {
  // `items-center` on a scrolling flex parent centres the child and then, once
  // it is taller than the container, pushes its top above the scroll origin
  // where nothing reaches it. Adding the status panel made the column tall
  // enough for that to happen, and the wordmark went missing at 390px.
  const main = login.slice(login.indexOf("<main"), login.indexOf("</main>"));
  assert.doesNotMatch(main, /<main[^>]*items-center/);
  assert.match(main, /df-rise[^"]*my-auto/);
});
