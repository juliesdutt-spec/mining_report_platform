/**
 * Tests for how lib/settings.ts decides which backend to call, run with:
 *
 *   node --test scripts/test-api-base.mjs
 *
 * Same approach as test-csv.mjs: esbuild transpiles the real module, so these
 * cases run against shipped source rather than a copy of its logic.
 *
 * This is worth pinning because the value is decided at build time and cannot
 * be corrected afterwards. A Preview deployment built without VITE_API_URL
 * once shipped "http://localhost:8000" inside the bundle, so every visitor's
 * browser looked for the backend on their own machine and the app reported it
 * unreachable while it was running normally.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = require(path.join(here, '..', 'node_modules', 'esbuild'));

const DEPLOYED = 'https://miningreportplatform-production.up.railway.app';

/**
 * Load settings.ts as it would be after a build with the given VITE_API_URL,
 * evaluated as if served from `hostname`.
 *
 * The module computes BUILT_IN_API_URL once at load, which is the behaviour
 * under test, so each case needs its own evaluation rather than a cached one.
 */
function loadModule({ viteApiUrl, hostname }) {
  const { outputFiles } = esbuild.buildSync({
    entryPoints: [path.join(here, '..', 'src', 'lib', 'settings.ts')],
    bundle: true,
    format: 'cjs',
    write: false,
    define: {
      'import.meta.env.VITE_API_URL':
        viteApiUrl === undefined ? 'undefined' : JSON.stringify(viteApiUrl),
    },
  });

  const previousWindow = globalThis.window;
  if (hostname === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = { location: { hostname } };
  }
  try {
    const module = { exports: {} };
    new Function('module', 'exports', 'require', outputFiles[0].text)(
      module,
      module.exports,
      require
    );
    return module.exports;
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

const builtIn = (opts) => loadModule(opts).BUILT_IN_API_URL;

test('a build with VITE_API_URL uses it wherever the page is served', () => {
  const configured = 'https://api.example.com';
  assert.equal(builtIn({ viteApiUrl: configured, hostname: 'localhost' }), configured);
  assert.equal(builtIn({ viteApiUrl: configured, hostname: 'dataforge.vercel.app' }), configured);
});

test('a build without VITE_API_URL served from a real host uses the deployed backend', () => {
  // The reported failure: a Vercel Preview build opened on a phone.
  assert.equal(
    builtIn({ viteApiUrl: undefined, hostname: 'df-8gsh3oe0s-data-forge1.vercel.app' }),
    DEPLOYED
  );
});

test('localhost stays the default only when the page is itself served locally', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'macbook.local']) {
    assert.equal(
      builtIn({ viteApiUrl: undefined, hostname }),
      'http://localhost:8000',
      `${hostname} should keep the local default`
    );
  }
});

test('a LAN address is a real host, not the viewer machine', () => {
  // Opening the dev server from a phone on the same network: the backend is on
  // the developer's machine, not the phone, so localhost would be wrong there
  // too. Falling back to the deployed backend at least reaches something.
  assert.equal(builtIn({ viteApiUrl: undefined, hostname: '192.168.1.42' }), DEPLOYED);
});

test('no window at all falls back to localhost rather than throwing', () => {
  // Server-side evaluation or a prerender pass has no window; the module must
  // still load, since every page imports it.
  assert.equal(builtIn({ viteApiUrl: undefined, hostname: undefined }), 'http://localhost:8000');
});

test('the deployed fallback is https, so a browser on an https page can use it', () => {
  const resolved = builtIn({ viteApiUrl: undefined, hostname: 'dataforge.vercel.app' });
  assert.ok(
    resolved.startsWith('https://'),
    'a page served over https cannot call an http backend - the browser blocks it'
  );
});
