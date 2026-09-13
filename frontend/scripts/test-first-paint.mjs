/**
 * The boot screen, and what a first visit downloads.
 *
 * Measured on a 400 kbps / 400ms connection against the built app: #root was
 * empty until the bundle mounted at 4.5s — four and a half seconds of white,
 * with not even the wordmark to say the page was loading. Now index.html
 * carries a wordmark and a line of text that paints at 526ms.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const html = read("../index.html");
const main = read("../src/main.tsx");
const css = read("../src/index.css");
const vite = read("../vite.config.ts");

const boot = html.slice(html.indexOf("#app-boot {"), html.indexOf("</style>"));

/** An `--x: H S% L%` token from index.css, as the hex the browser paints. */
function tokenHex(source, name, { dark = false } = {}) {
  const scope = dark ? source.slice(source.indexOf(".dark {")) : source;
  const match = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(scope);
  assert.ok(match, `token --${name} not found`);
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return "#" + seg.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

test("the page shows something before the bundle arrives", () => {
  // Inside #root, so React replaces it rather than sitting beside it.
  assert.match(html, /<div id="root">\s*[\s\S]*id="app-boot"/);
  assert.match(html, /Loading the indexed reports/);
  assert.match(html, /Data<i>forge<\/i>/);
});

test("its styles are inline, so the first paint waits on nothing extra", () => {
  const styleBlock = html.slice(0, html.indexOf("</head>"));
  assert.ok(styleBlock.includes("#app-boot {"), "the boot styles are not in <head>");
  assert.doesNotMatch(boot, /url\(/, "the boot screen must not pull another request");
});

test("it is painted on the same ground the app opens on, in both themes", () => {
  // A different background here would flash when React takes over.
  assert.ok(boot.includes(`background: ${tokenHex(css, "background")};`),
    `light boot background should be ${tokenHex(css, "background")}`);
  assert.ok(boot.includes(`color: ${tokenHex(css, "muted-foreground")};`),
    `light boot text should be ${tokenHex(css, "muted-foreground")}`);
  const dark = boot.slice(boot.indexOf(":root.dark"));
  assert.ok(dark.includes(`background: ${tokenHex(css, "background", { dark: true })};`),
    `dark boot background should be ${tokenHex(css, "background", { dark: true })}`);
});

test("the wordmark keeps its orange, lifted on slate as the app lifts it", () => {
  assert.ok(boot.includes(tokenHex(css, "brand")), "light brand colour missing");
  assert.ok(boot.includes(tokenHex(css, "brand", { dark: true })), "dark brand colour missing");
});

test("React clears it rather than rendering on top of it", () => {
  assert.match(main, /container\.replaceChildren\(\)/);
  assert.ok(main.indexOf("replaceChildren") < main.indexOf("createRoot"),
    "the boot screen must be cleared before the root renders");
});

test("the charts library is not forced onto every page's chunk", () => {
  // manualChunks: { charts: ['recharts'] } did not isolate recharts — it swept
  // its shared dependencies in too, so all nine page chunks imported the
  // result and whichever screen you opened first pulled 541 kB.
  // scripts/bundle-audit.mjs walks the built output and proves it.
  assert.doesNotMatch(vite, /charts:\s*\['recharts'\]/);
});

test("with scripting off, the page says so instead of promising a load", () => {
  // Measured before: JavaScript disabled left "Loading the indexed reports…"
  // on screen permanently, and there was no <noscript> anywhere in the page.
  assert.match(html, /<noscript>[\s\S]*needs JavaScript[\s\S]*<\/noscript>/);
  // And the promise itself is withdrawn, rather than sitting above the
  // explanation contradicting it.
  const noscriptStyle = html.slice(html.indexOf("<noscript>\n      <style>"));
  assert.match(noscriptStyle, /#app-boot-note \{\s*\n\s*display: none;/);
});

test("a bundle that never arrives stops claiming to be loading", () => {
  // Blocking the script left the page saying "Loading…" at six seconds, and
  // it would have at six hours.
  const stall = html.slice(html.indexOf("setTimeout(function"));
  assert.match(stall, /getElementById\("app-boot-note"\)/);
  // React removes the boot screen, so a healthy load finds nothing to rewrite.
  assert.match(stall, /if \(!note\) return;/);
  assert.match(stall, /could not finish loading/);
  // Well past the ~4.5s a 400 kbps connection needs, so reaching it means the
  // request failed rather than that it is slow.
  const delay = Number(/\}, (\d+)\);/.exec(stall)[1]);
  assert.ok(delay >= 10000, `the stall message fires after ${delay}ms, too soon to be sure`);
});
