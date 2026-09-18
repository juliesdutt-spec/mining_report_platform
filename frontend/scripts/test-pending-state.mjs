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


test("a busy backend is given longer than a second to answer", () => {
  // Uploading a long document is synchronous work on the same worker -
  // parsing, OCR, then the model call - and CPU-bound work starves other
  // requests under the GIL. A 148-page PDF pushed /health past 1.8 seconds
  // and the pill read "Backend Offline" while the upload it was blocked
  // behind completed perfectly.
  const api = readFileSync(
    new URL("../src/services/api.ts", import.meta.url), "utf8"
  );
  const call = api.match(/checkBackendHealth[\s\S]*?apiFetch<[^>]*>\('\/health',\s*undefined,\s*(\d+)\)/);
  assert.ok(call, "checkBackendHealth should still call /health with a timeout");
  assert.ok(
    Number(call[1]) >= 5000,
    `health timeout is ${call[1]}ms - too tight for a worker doing OCR`
  );
});

test("one slow reply does not report the backend as offline", () => {
  // A pill that flips to "Backend Offline" and back a few seconds later is
  // alarming and wrong. Two failures in a row is a pattern; one is traffic.
  const shell = readFileSync(
    new URL("../src/components/layout/AppShell.tsx", import.meta.url), "utf8"
  );
  assert.match(shell, /consecutiveFailures/, "the poller should count failures");
  assert.match(
    shell, /consecutiveFailures\s*>=\s*2/,
    "it should take two consecutive failures to show offline"
  );
  assert.match(
    shell, /consecutiveFailures\s*=\s*0/,
    "a success must reset the counter, or it would latch"
  );
});
