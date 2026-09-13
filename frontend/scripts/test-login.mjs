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
import { readFileSync } from "node:fs";

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
  assert.doesNotMatch(login, /text-brand">\s*\n?\s*Evaluating this project\?/);
  const panel = login.slice(login.indexOf("Evaluating this project?") - 400, login.indexOf("Evaluating this project?"));
  assert.match(panel, /text-foreground/);
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
