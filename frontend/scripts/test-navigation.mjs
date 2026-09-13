/**
 * Arriving on a new screen.
 *
 * A hash change swaps the whole screen without a page load. Three things have
 * to happen that a real navigation would have done for free: the scroll
 * container goes back to the top, the browser tab says which screen this is,
 * and a screen reader is told the screen changed. Each was missing.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const tabs = read("../src/lib/tabs.ts");
const shell = read("../src/components/layout/AppShell.tsx");
const header = read("../src/components/layout/Header.tsx");
const sidebar = read("../src/components/layout/Sidebar.tsx");
const types = read("../src/types/index.ts");

test("every navigation tab has a title", () => {
  // The union in types/index.ts is the list that matters; a tab missing from
  // TAB_TITLES would render `undefined · DataForge` in the browser tab.
  const union = types
    .slice(types.indexOf("export type NavigationTab"))
    .split(";")[0]
    .match(/'([a-z]+)'|"([a-z]+)"/g)
    .map((s) => s.replace(/['"]/g, ""));
  assert.ok(union.length >= 9, `expected the full tab union, found ${union.length}`);
  for (const tab of union) {
    assert.match(tabs, new RegExp(`\\b${tab}:\\s*"`), `TAB_TITLES is missing ${tab}`);
  }
});

test("the sidebar, the header and the tab title read from one list", () => {
  // Three separate copies drifted the moment one screen was renamed.
  assert.match(header, /import \{ TAB_TITLES \} from "@\/lib\/tabs"/);
  assert.match(sidebar, /import \{ TAB_TITLES \} from "@\/lib\/tabs"/);
  assert.doesNotMatch(header, /const TAB_TITLES[\s\S]*dashboard: "Dashboard"/);
  assert.doesNotMatch(sidebar, /label: "Dashboard"/);
});

test("the browser tab names the screen and keeps the app name", () => {
  assert.match(tabs, /\$\{TAB_TITLES\[tab\]\} · \$\{APP_NAME\}/);
});

test("a route change resets the scroll container and retitles the tab", () => {
  // <main> is the scroll container and survives every route change, so its
  // offset carried over: a scrolled Dashboard opened Documents mid-table.
  const effect = shell.slice(shell.indexOf("document.getElementById(\"main-content\")?.scrollTo"));
  assert.match(effect, /scrollTo\(\{ top: 0 \}\)/);
  assert.match(effect, /document\.title = documentTitleFor\(currentTab\)/);
  assert.match(effect.slice(0, 400), /\}, \[currentTab\]\)/);
});

test("the new screen is announced politely, from a region that is always mounted", () => {
  // Mounting the region together with its text is what stops it being read:
  // it is the change in text content that gets announced.
  assert.match(shell, /role="status" aria-live="polite" className="sr-only"/);
  assert.match(shell, /\{TAB_TITLES\[currentTab\]\}/);
});
