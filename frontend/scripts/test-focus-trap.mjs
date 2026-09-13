/**
 * lib/useFocusTrap.ts — the rules the mobile navigation drawer depends on.
 *
 * The drawer is an <aside> with a transform, not a Radix dialog, so it had
 * none of a dialog's behaviour. Measured before: opening it left focus on the
 * toggle, Tab then walked eleven controls on the page behind it, and closing
 * dropped focus on <body> so the next Tab restarted from the top of the page.
 *
 * The behaviour itself is asserted end to end by scripts/ux-audit.mjs, which
 * drives a real browser; these pin the decisions in the hook that a browser
 * test would not explain.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const hook = read("../src/lib/useFocusTrap.ts");
const sidebar = read("../src/components/layout/Sidebar.tsx");

test("the trap is tied to the drawer being open, not to the sidebar existing", () => {
  // Docked from `md` up, the same element is ordinary page furniture. A trap
  // there would lock a desktop reader inside the navigation.
  assert.match(sidebar, /useFocusTrap\(isMobileOpen, drawerRef, onCloseMobile\)/);
});

test("it is announced as a modal only while it covers the page", () => {
  assert.match(sidebar, /role=\{isMobileOpen \? "dialog" : undefined\}/);
  assert.match(sidebar, /aria-modal=\{isMobileOpen \? true : undefined\}/);
});

test("focus goes into the panel when it opens", () => {
  assert.match(hook, /const items = focusableWithin\(container\);\s*\n\s*\(items\[0\] \?\? container\)\.focus\(\);/);
});

test("focus returns to whatever opened it", () => {
  // Without this the reader is dropped on <body> and the next Tab starts
  // again at the top of the page.
  assert.match(hook, /const previous = document\.activeElement/);
  assert.match(hook, /if \(previous && document\.contains\(previous\)\) previous\.focus\(\)/);
});

test("the focusable list is read on every Tab, not captured on open", () => {
  // The drawer's organisation filter fills in when the corpus loads, so a
  // list taken at open time is stale by the time anyone presses Tab.
  const handler = hook.slice(hook.indexOf("const onKeyDown"));
  assert.match(handler, /const focusable = focusableWithin\(container\)/);
});

test("Tab wraps in both directions", () => {
  const handler = hook.slice(hook.indexOf("const onKeyDown"));
  assert.match(handler, /event\.shiftKey && current === first[\s\S]*last\.focus\(\)/);
  assert.match(handler, /!event\.shiftKey && current === last[\s\S]*first\.focus\(\)/);
});

test("focus that has drifted outside is pulled back rather than left there", () => {
  const handler = hook.slice(hook.indexOf("const onKeyDown"));
  assert.match(handler, /!container\.contains\(current\)[\s\S]*?\(event\.shiftKey \? last : first\)\.focus\(\)/);
});

test("a panel with nothing focusable swallows Tab instead of releasing it", () => {
  assert.match(hook, /if \(focusable\.length === 0\) \{\s*\n\s*event\.preventDefault\(\);/);
});

test("hidden controls are not counted as focus stops", () => {
  assert.match(hook, /offsetWidth > 0 \|\| el\.offsetHeight > 0 \|\| el\.getClientRects\(\)\.length > 0/);
});

test("Escape is handled, and the listener is removed again", () => {
  assert.match(hook, /if \(event\.key === "Escape"\)[\s\S]*onEscape\?\.\(\)/);
  assert.match(hook, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(hook, /document\.removeEventListener\("keydown", onKeyDown, true\)/);
});
