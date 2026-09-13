/**
 * usePendingState decides whether an action is worth showing a spinner for.
 * The hook itself needs a renderer, so the timing rules are asserted against
 * the same thresholds the hook uses.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/usePendingState.ts", import.meta.url), "utf8");

test("a fast action shows nothing at all", () => {
  // 250ms is above the ~40-140ms an export actually takes, which is the
  // point: the common case must not flash.
  assert.match(source, /showAfterMs = 250/);
});

test("a slow action is explained rather than left silent", () => {
  assert.match(source, /slowAfterMs = 2500/);
});

test("both timers are cleared, so a finished action cannot flash late", () => {
  assert.match(source, /clearTimeout\(show\)/);
  assert.match(source, /clearTimeout\(warn\)/);
});

test("state resets when the action ends", () => {
  assert.match(source, /setVisible\(false\)[\s\S]*setSlow\(false\)/);
});
