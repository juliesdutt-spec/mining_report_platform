/**
 * lib/markdown.ts — the slice of Markdown a language model actually emits.
 *
 * The Ask page printed answers as source: `**Question:**` with its asterisks
 * showing, bullet lists as a run of hyphens, a production breakdown as a wall
 * of pipes. Transpiled with the esbuild Vite already depends on, as
 * test-csv.mjs does, so these run against the shipped source.
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
  entryPoints: [path.join(here, '..', 'src', 'lib', 'markdown.ts')],
  bundle: true, format: 'cjs', write: false, platform: 'node',
});
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'md-')), 'markdown.cjs');
fs.writeFileSync(tmp, built.outputFiles[0].text);
const { parseMarkdown, parseInline } = require(tmp);

const text = (spans) => spans.map((s) => s.text).join('');

test('the answer the mock provider returns comes out as prose, not asterisks', () => {
  const answer = [
    'Based on the available mining report data:',
    '',
    '**Question:** total production',
    '',
    '*This is a deterministic demo response, not model output.*',
  ].join('\n');
  const blocks = parseMarkdown(answer);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].spans[0].type, 'strong');
  assert.equal(blocks[1].spans[0].text, 'Question:');
  assert.equal(blocks[2].spans[0].type, 'em');
  // Nothing anywhere still carries the markers.
  for (const block of blocks) assert.doesNotMatch(text(block.spans), /\*/);
});

test('bold is never read as two italics', () => {
  const spans = parseInline('**Answer:** the *Jharia* seam');
  assert.deepEqual(spans.map((s) => s.type), ['strong', 'text', 'em', 'text']);
  assert.equal(spans[0].text, 'Answer:');
  assert.equal(spans[2].text, 'Jharia');
});

test('an underscore inside a word is left alone', () => {
  // reserve_estimate and quantity_extracted are field names that appear in
  // answers verbatim; read as emphasis they would lose their underscores.
  const spans = parseInline('The field reserve_estimate was blank');
  assert.equal(spans.length, 1);
  assert.equal(spans[0].type, 'text');
  assert.match(spans[0].text, /reserve_estimate/);
});

test('inline code survives', () => {
  const spans = parseInline('Run `python -m evaluation.score` first');
  assert.equal(spans[1].type, 'code');
  assert.equal(spans[1].text, 'python -m evaluation.score');
});

test('a link renders as its label, never as a destination the model chose', () => {
  const spans = parseInline('See [the report](https://example.invalid/x) for detail');
  assert.equal(spans.length, 1);
  assert.equal(spans[0].text, 'See the report for detail');
});

test('bulleted and numbered lists become lists', () => {
  const blocks = parseMarkdown('- Jharia\n- Raniganj\n\n1. First\n2. Second');
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].ordered, false);
  assert.deepEqual(blocks[0].items.map(text), ['Jharia', 'Raniganj']);
  assert.equal(blocks[1].ordered, true);
  assert.deepEqual(blocks[1].items.map(text), ['First', 'Second']);
});

test('a production table becomes a table, with figures right-aligned', () => {
  const blocks = parseMarkdown([
    '| Mine | Production |',
    '|---|---:|',
    '| Jharia | 1,25,000 MT |',
    '| Raniganj | 98,400 MT |',
  ].join('\n'));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].head.map(text), ['Mine', 'Production']);
  assert.equal(blocks[0].rows.length, 2);
  assert.deepEqual(blocks[0].rows[0].map(text), ['Jharia', '1,25,000 MT']);
  assert.deepEqual(blocks[0].numeric, [false, true]);
});

test('pipes without a separator row stay ordinary text', () => {
  const blocks = parseMarkdown('The delimiter is | and that is all');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
});

test('a fenced block keeps its own line breaks', () => {
  const blocks = parseMarkdown('Try:\n\n```\nuvicorn backend.api:app\n  --reload\n```\n\nThen open it.');
  assert.equal(blocks[1].type, 'code');
  assert.equal(blocks[1].text, 'uvicorn backend.api:app\n  --reload');
  assert.equal(blocks[2].type, 'paragraph');
});

test('an unclosed fence does not swallow the rest silently', () => {
  const blocks = parseMarkdown('```\nhalf a block');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'code');
  assert.equal(blocks[0].text, 'half a block');
});

test('headings never climb above the question they sit under', () => {
  // The question is the section's h2; an answer heading starts below it.
  const blocks = parseMarkdown('# Summary\n\n###### Deep');
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].level, 3);
});

test('empty and non-string input produce nothing rather than throwing', () => {
  assert.deepEqual(parseMarkdown(''), []);
  assert.deepEqual(parseMarkdown(null), []);
  assert.deepEqual(parseMarkdown(undefined), []);
});

test('a Hindi or Telugu answer is passed through unharmed', () => {
  const blocks = parseMarkdown('**उत्पादन:** 1,25,000 टन\n\n- బొగ్గు ఉత్పత్తి');
  assert.equal(blocks[0].spans[0].text, 'उत्पादन:');
  assert.match(text(blocks[0].spans), /1,25,000 टन/);
  assert.equal(blocks[1].items[0][0].text, 'బొగ్గు ఉత్పత్తి');
});
