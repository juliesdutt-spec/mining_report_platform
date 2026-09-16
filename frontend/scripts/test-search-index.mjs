/**
 * The "Build search index" control in Settings.
 *
 * It exists because the vector database is reachable only over the
 * deployment's private network, so the index cannot be built from a laptop -
 * it has to be triggered from inside the deployment. That used to mean a curl
 * with a hand-pasted bearer token, which is not something to put in front of
 * an auditor.
 *
 * What is worth pinning is the handful of things that make it safe to press.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const settings = read("../src/pages/SettingsPage.tsx");
const api = read("../src/services/api.ts");
const app = read("../src/App.tsx");

test("the button is closed to a read-only account", () => {
  // The demo password is printed on the sign-in page and every passage costs
  // an embedding call. The server returns 403 regardless - this keeps the
  // browser from offering an action it knows will be refused.
  assert.match(settings, /disabled=\{indexing \|\| !!user\?\.readonly\}/);
});

test("a read-only account is told why, not just refused", () => {
  // A disabled button with no visible reason is a dead end. The explanation
  // has to be text on the page, not only a title attribute.
  assert.match(settings, /Read-only account\s*[—-]\s*sign in with a writing account/);
});

test("Settings is actually given the user to make that decision with", () => {
  // Without this the gate above reads as working while user is always
  // undefined, and every account would see an enabled button.
  assert.match(app, /<SettingsPage user=\{user\}\s*\/>/);
});

test("the reindex request is allowed far longer than a normal call", () => {
  // Every passage is an embedding call. At the 30s default the request aborts
  // part-way through a corpus, which looks like a failure while the server is
  // still writing rows.
  const call = api.match(/rebuildSearchIndex[\s\S]{0,320}?apiFetch<ReindexResult>\([^)]*\)/);
  assert.ok(call, "rebuildSearchIndex should call apiFetch");
  const timeout = Number(call[0].match(/,\s*(\d{5,})\s*\)/)?.[1]);
  assert.ok(timeout >= 300000, `timeout should be minutes, got ${timeout}`);
});

test("the index state is re-read from the backend, not inferred from the write", () => {
  // What /health reports is what the rest of the platform answers from, so a
  // successful POST is not by itself evidence the index is usable.
  assert.match(settings, /setRetrieval\(await fetchRetrievalStatus\(\)\)/);
});

test("documents that failed to index are named, not counted", () => {
  // "3 failed" is not something an operator can act on.
  assert.match(settings, /failures\.map\(/);
  assert.match(settings, /\{failure\.filename\}/);
  assert.match(settings, /\{failure\.error\}/);
});

test("an unusable index explains itself", () => {
  // index_reason and embeddings_reason are the whole value of the health
  // block; "Not available" on its own leaves nowhere to go.
  assert.match(settings, /retrieval\.index_reason \?\? retrieval\.embeddings_reason/);
});

test("a failed build surfaces the backend's reason", () => {
  assert.match(settings, /err instanceof ApiError \? err\.message/);
  assert.match(settings, /role="alert"/);
});

test("the button cannot be pressed twice while a build is running", () => {
  assert.match(settings, /setIndexing\(true\)/);
  assert.match(settings, /finally \{\s*setIndexing\(false\)/);
});

test("reading the index state never needs a token to be handled by the page", () => {
  // apiFetch attaches auth itself; a page assembling an Authorization header
  // is a page one refactor away from logging a token.
  assert.doesNotMatch(settings, /Authorization|Bearer /);
});
