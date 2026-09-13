/**
 * The sidebar.
 *
 * Four things were wrong with it, and only one of them was cosmetic.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sidebar = read("../src/components/layout/Sidebar.tsx");
const types = read("../src/types/index.ts");

test("Settings is not a ninth destination", () => {
  // It is the utility every application keeps beside the account. Listed with
  // the eight, it made the primary navigation one item longer than the work.
  const groups = sidebar.slice(sidebar.indexOf("const NAV_GROUPS"), sidebar.indexOf("const SETTINGS_ITEM"));
  assert.doesNotMatch(groups, /TAB_TITLES\.settings/);
  assert.match(sidebar, /const SETTINGS_ITEM: NavItem = \{ id: "settings"/);
  // Rendered from the footer, with the same control as every other row.
  const footer = sidebar.slice(sidebar.indexOf('border-t border-border p-2'));
  assert.match(footer, /<NavButton\s+item=\{SETTINGS_ITEM\}/);
});

test("every screen is still reachable from the sidebar", () => {
  // Grouping is a way of losing one. The union is the list that matters.
  const union = types
    .slice(types.indexOf("export type NavigationTab"))
    .split(";")[0]
    .match(/'([a-z]+)'|"([a-z]+)"/g)
    .map((s) => s.replace(/['"]/g, ""));
  const reachable = new Set(
    [...sidebar.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1])
  );
  for (const tab of union) assert.ok(reachable.has(tab), `${tab} is not in the sidebar`);
});

test("the filter only appears when there is a choice to make", () => {
  // One organisation rendered "All organisations 2 / Coal India Limited (CIL)
  // 2" — the same number twice, and no decision behind it.
  assert.match(sidebar, /\{organisations\.length > 1 &&/);
});

test("collapsing no longer deletes the filter", () => {
  // The whole block used to sit behind `!isCollapsed`, so a reader who
  // collapsed to icons lost the organisation filter with no sign it existed.
  const filter = sidebar.slice(sidebar.indexOf("{organisations.length > 1 &&"));
  assert.match(filter, /isCollapsed \? \(/, "there is no collapsed form of the filter");
  assert.match(filter, /abbreviate\(org\.name\)/);
  // And it is still named for a screen reader, where the label is now an
  // abbreviation rather than the organisation.
  assert.match(filter, /aria-label=\{`Show \$\{label\}, \$\{org\.count\} document/);
});

test("the filter does not look like navigation", () => {
  // Two lists of near-identical rows, one navigating and one filtering what
  // every screen shows. The semantics were already right; the picture was not.
  const filter = sidebar.slice(sidebar.indexOf("{organisations.length > 1 &&"));
  assert.match(filter, /border-dashed/);
  assert.match(filter, /<Filter className/);
  assert.match(filter, /Filters every screen\./);
  assert.match(filter, /<Check/);
  // Navigation says which page; the filter says which subset.
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(filter, /aria-pressed=\{isSelected\}/);
});

test("an abbreviation prefers the one the organisation already uses", () => {
  assert.match(sidebar, /\\\(\(\[A-Z\]\{2,5\}\)\\\)/);
});
