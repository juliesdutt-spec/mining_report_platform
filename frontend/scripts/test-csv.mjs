/**
 * Tests for lib/csv.ts, run with node's built-in test runner:
 *
 *   node --test scripts/test-csv.mjs
 *
 * The project has no frontend test framework and this does not add one: the
 * module is transpiled with the esbuild that Vite already depends on, so these
 * cases run against the shipped source with no new dependency.
 *
 * Escaping is what is worth pinning. Mineral names and locations come from
 * uploaded documents, so "Dhanbad, Jharkhand" is an ordinary value - written
 * unquoted it would shift every column after it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'));

const built = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'csv.ts')],
  bundle: true,
  format: 'cjs',
  write: false,
  platform: 'node',
});
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csv-')), 'csv.cjs');
fs.writeFileSync(tmp, built.outputFiles[0].text);
const { escapeCsvField, toCsv } = require(tmp);

test('plain values are not quoted', () => {
  assert.equal(escapeCsvField('Iron Ore'), 'Iron Ore');
  assert.equal(escapeCsvField(1250), '1250');
});

test('null and undefined become empty, not the literal words', () => {
  assert.equal(escapeCsvField(null), '');
  assert.equal(escapeCsvField(undefined), '');
});

test('a comma forces quoting so the column count holds', () => {
  assert.equal(escapeCsvField('Dhanbad, Jharkhand'), '"Dhanbad, Jharkhand"');
});

test('embedded quotes are doubled, which is how CSV escapes them', () => {
  assert.equal(escapeCsvField('The "Gevra" block'), '"The ""Gevra"" block"');
});

test('newlines are quoted rather than breaking the row', () => {
  assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCsvField('line1\r\nline2'), '"line1\r\nline2"');
});

test('rows are joined with CRLF as the format specifies', () => {
  assert.equal(toCsv([['a', 'b'], ['c', 'd']]), 'a,b\r\nc,d');
});

test('every row keeps the same column count under escaping', () => {
  const csv = toCsv([
    ['Section', 'Label', 'Value'],
    ['Location distribution', 'Dhanbad, Jharkhand', 2],
    ['Location distribution', 'The "Gevra" block', 1],
  ]);
  for (const line of csv.split('\r\n')) {
    let columns = 1;
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) columns += 1;
    }
    assert.equal(columns, 3, `row shifted columns: ${line}`);
  }
});
