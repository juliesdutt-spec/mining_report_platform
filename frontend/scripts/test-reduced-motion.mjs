/**
 * prefers-reduced-motion.
 *
 * Nothing honoured the setting: dialogs zoomed, the evidence sheet slid in
 * and skeletons pulsed regardless. Motion that travels is the part that
 * causes trouble; a frozen spinner would read as a hung request, so loading
 * indicators keep a fade rather than being switched off with everything else.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

test("the stylesheet answers the media query at all", () => {
  assert.ok(block.length > 0, "no prefers-reduced-motion block in index.css");
});

test("travelling animations and transitions are cut", () => {
  assert.match(block, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(block, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(block, /animation-iteration-count:\s*1\s*!important/);
});

test("loading indicators keep signalling", () => {
  // A spinner stopped dead says the request has hung. The replacement is an
  // opacity fade, which is not a vestibular trigger.
  assert.match(block, /\.animate-spin,\s*\n?\s*\.animate-pulse\s*\{[\s\S]*df-loading-fade[\s\S]*infinite\s*!important/);
  assert.match(css, /@keyframes df-loading-fade[\s\S]*opacity: 0\.45/);
});

test("the class rule can actually beat the universal rule", () => {
  // `*` sets animation-duration !important; a class selector outranks it, but
  // only because the replacement uses the `animation` shorthand.
  const idxUniversal = block.indexOf("animation-duration");
  const idxClass = block.indexOf(".animate-spin");
  assert.ok(idxClass > idxUniversal, "the override must come after the blanket rule");
  assert.match(block, /animation: df-loading-fade/);
});
