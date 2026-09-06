/**
 * Tests for lib/staleChunk.ts, run with:
 *
 *   node --test scripts/test-stale-chunk.mjs
 *
 * The failure being handled: a tab holding an older index.html asks for a
 * chunk filename the current deployment no longer has, so the import rejects
 * with "Failed to fetch dynamically imported module" and the page never
 * renders. The recovery is one reload; the thing worth pinning is that it
 * happens at most once and only for that failure.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'));

const { outputFiles } = esbuild.buildSync({
  entryPoints: [path.join(here, '..', 'src', 'lib', 'staleChunk.ts')],
  bundle: true,
  format: 'cjs',
  write: false,
});

/** Fresh module plus a fake browser, so each case starts with empty storage. */
function load({ storageThrows = false } = {}) {
  const store = new Map();
  let reloads = 0;

  globalThis.sessionStorage = {
    getItem: (k) => {
      if (storageThrows) throw new Error('storage blocked');
      return store.has(k) ? store.get(k) : null;
    },
    setItem: (k, v) => {
      if (storageThrows) throw new Error('storage blocked');
      store.set(k, String(v));
    },
    removeItem: (k) => {
      if (storageThrows) throw new Error('storage blocked');
      store.delete(k);
    },
  };
  globalThis.window = { location: { reload: () => { reloads += 1; } } };

  const module = { exports: {} };
  new Function('module', 'exports', 'require', outputFiles[0].text)(
    module, module.exports, require
  );
  return { ...module.exports, reloads: () => reloads };
}

/** The reload happens in a rejection handler, so let microtasks drain. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const CHUNK_ERROR = new Error(
  'Failed to fetch dynamically imported module: https://example.vercel.app/assets/DataExplorerPage-Bd_knbzr.js'
);

test('a stale chunk reloads the page', async () => {
  const m = load();
  const wrapped = m.retryOnStaleChunk(() => Promise.reject(CHUNK_ERROR));

  // Never settles by design: the document is being replaced.
  const pending = wrapped();
  const settled = await Promise.race([
    pending.then(() => 'resolved', () => 'rejected'),
    new Promise((r) => setTimeout(() => r('still pending'), 20)),
  ]);

  assert.equal(m.reloads(), 1, 'should reload exactly once');
  assert.equal(settled, 'still pending', 'must not flash an error mid-reload');
});

test('a second failure after the reload surfaces instead of looping', async () => {
  const m = load();
  const wrapped = m.retryOnStaleChunk(() => Promise.reject(CHUNK_ERROR));

  wrapped();                                    // spends the one reload
  await tick();
  await assert.rejects(wrapped(), /dynamically imported module/);
  assert.equal(m.reloads(), 1, 'a reload loop would make the app unusable');
});

test('a real error inside a page is never swallowed', async () => {
  const m = load();
  const bug = new TypeError('Cannot read properties of undefined (reading "map")');
  const wrapped = m.retryOnStaleChunk(() => Promise.reject(bug));

  await assert.rejects(wrapped(), /Cannot read properties of undefined/);
  assert.equal(m.reloads(), 0, 'reloading would hide the bug and lose the stack');
});

test('a successful load restores the reload for a later deploy', async () => {
  const m = load();
  let failing = true;
  const wrapped = m.retryOnStaleChunk(() =>
    failing ? Promise.reject(CHUNK_ERROR) : Promise.resolve('page')
  );

  wrapped();
  await tick();
  assert.equal(m.reloads(), 1);

  failing = false;
  assert.equal(await wrapped(), 'page');

  // A second deploy during the same session must still be recoverable.
  failing = true;
  wrapped();
  await tick();
  assert.equal(m.reloads(), 2);
});

test('blocked sessionStorage does not cause a reload loop', async () => {
  // Private modes can throw on any access. Failing closed means no reload
  // rather than an unstoppable one.
  const m = load({ storageThrows: true });
  const wrapped = m.retryOnStaleChunk(() => Promise.reject(CHUNK_ERROR));

  await assert.rejects(wrapped(), /dynamically imported module/);
  assert.equal(m.reloads(), 0);
});

test('the wordings other browsers use are recognised', () => {
  const m = load();
  for (const message of [
    'Failed to fetch dynamically imported module: /assets/Page-abc123.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
  ]) {
    assert.ok(m.isChunkLoadError(new Error(message)), message);
  }
  assert.equal(m.isChunkLoadError(new Error('Network request failed')), false);
  assert.equal(m.isChunkLoadError(null), false);
});
