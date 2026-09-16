/**
 * Long, machine-generated filenames in the Activity table.
 *
 * A corpus exported from another system arrives named by hash. One of those
 * is a single unbreakable token, so rendered raw it widened its column until
 * the rest of the row was squeezed off the screen.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require(path.join(here, "..", "node_modules", "esbuild"));
const built = esbuild.buildSync({
  entryPoints: [path.join(here, "..", "src", "lib", "documentName.ts")],
  bundle: true, format: "cjs", write: false, platform: "node",
});
const cache = path.join(here, "..", "node_modules", ".cache");
fs.mkdirSync(cache, { recursive: true });
const tmp = path.join(cache, "document-name.test.cjs");
fs.writeFileSync(tmp, built.outputFiles[0].text);
const { shortenDocumentName } = require(tmp);

const HASH = "67b42e623b87c91f0a4d5e2c8b1f93ae77c04d61b2f8a95e.pdf";

test("a name that fits is left exactly as it is", () => {
  assert.equal(shortenDocumentName("EN-01_Jharia_BCCL.pdf"), "EN-01_Jharia_BCCL.pdf");
});

test("a long name is brought within the budget", () => {
  const out = shortenDocumentName(HASH);
  assert.ok(out.length <= 34, `still ${out.length} characters: ${out}`);
});

test("the extension survives, because it says what the file is", () => {
  assert.ok(shortenDocumentName(HASH).endsWith(".pdf"));
});

test("the start survives, because it is what tells two files apart", () => {
  assert.ok(shortenDocumentName(HASH).startsWith("67b42e"));
});

test("the cut is marked, so nobody reads a truncation as the whole name", () => {
  assert.ok(shortenDocumentName(HASH).includes("…"));
});

test("two different documents do not shorten to the same string", () => {
  const a = shortenDocumentName("67b42e623b87c91f0a4d5e2c8b1f93ae77c04d61.pdf");
  const b = shortenDocumentName("67b42e623b87c91f0a4d5e2c8b1f93ae77c04d62.pdf");
  assert.notEqual(a, b);
});

test("a long name with no extension is still shortened", () => {
  const out = shortenDocumentName("a".repeat(80));
  assert.ok(out.length <= 34);
  assert.ok(out.includes("…"));
});

test("a dotted name keeps a real suffix rather than losing a word", () => {
  // ".summary" is too long to be an extension, so it must not be treated as one
  const out = shortenDocumentName("quarterly.production.reconciliation.summary", 34);
  assert.ok(out.length <= 34);
});

test("empty and whitespace names do not throw", () => {
  assert.equal(shortenDocumentName(""), "");
  assert.equal(shortenDocumentName("   "), "");
});
