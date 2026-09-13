/**
 * The app's two text faces are served from this repo, not from a font CDN.
 *
 * Inter sets every word in the app and Geist Mono sets every figure in it.
 * Both were fetched from Google at runtime through a render-blocking
 * stylesheet, so nothing painted until a third party answered — and where
 * Google is unreachable, neither face loaded at all and the whole UI rendered
 * in a system fallback.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync, statSync } from "node:fs";

const url = (p) => new URL(p, import.meta.url);
const css = readFileSync(url("../src/index.css"), "utf8");
const html = readFileSync(url("../index.html"), "utf8");
const tailwind = readFileSync(url("../tailwind.config.js"), "utf8");

const FILES = [
  ["../public/fonts/inter-latin-variable.woff2", 80_000],
  ["../public/fonts/geist-mono-latin-variable.woff2", 60_000],
  ["../public/fonts/poppins-600-wordmark.woff2", 8_000],
];

test("nothing in the page reaches out to a font CDN", () => {
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /fonts\.gstatic\.com/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com\/css/);
});

test("every face the design asks for is actually in the repo", () => {
  for (const [path, ceiling] of FILES) {
    const size = statSync(url(path)).size;
    assert.ok(size > 500, `${path} is empty`);
    assert.ok(size < ceiling, `${path} is ${size} bytes, above the ${ceiling} budget`);
  }
});

test("the families Tailwind names are the families declared", () => {
  // A @font-face for "Inter Variable" while Tailwind asks for "Inter" loads
  // the file and then does not use it.
  for (const family of ["Inter", "Geist Mono", "Poppins"]) {
    assert.match(css, new RegExp(`font-family: "${family}";`), `no @font-face for ${family}`);
    assert.match(tailwind, new RegExp(`"${family}"`), `Tailwind does not name ${family}`);
  }
});

test("the text faces cover the whole weight range the UI uses", () => {
  // Variable files, so 300/400/500/600/700 all come out of one request each.
  const blocks = css
    .split("@font-face")
    .filter((b) => /font-family: "(Inter|Geist Mono)";/.test(b));
  assert.equal(blocks.length, 2);
  for (const block of blocks) assert.match(block, /font-weight: 100 900;/);
});

test("text stays visible while a face is still arriving", () => {
  // font-display: swap paints the fallback immediately. Measured: switching
  // these to `optional` changed CLS on none of the nine routes, so the shift
  // that remains is data arriving, not the typeface swapping in.
  const faces = css.split("@font-face").slice(1);
  for (const face of faces) assert.match(face, /font-display: swap;/);
});

test("the fonts on the critical path are preloaded", () => {
  for (const file of ["inter-latin-variable", "geist-mono-latin-variable", "poppins-600-wordmark"]) {
    assert.match(html, new RegExp(`rel="preload"[^>]*${file}\\.woff2`), `${file} is not preloaded`);
  }
});

test("the licence travels with each font, as the OFL requires", () => {
  for (const licence of ["OFL-Inter.txt", "OFL-GeistMono.txt", "OFL-Poppins.txt"]) {
    assert.ok(statSync(url(`../public/fonts/${licence}`)).size > 1000, `${licence} missing`);
  }
});
