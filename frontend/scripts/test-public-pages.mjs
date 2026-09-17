/**
 * The three screens that exist outside the sign-in wall.
 *
 * A privacy policy that needs an account to read answers nobody's question,
 * and a 404 that demands a password is worse than the host's default page.
 * These also carry claims about data handling, so the point of most of what
 * follows is that the claims match the code.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const legal = read("../src/pages/LegalPage.tsx");
const app = read("../src/App.tsx");
const login = read("../src/pages/LoginPage.tsx");
const documents = read("../src/pages/DocumentsPage.tsx");
const api = read("../src/services/api.ts");
const backend = read("../../backend/api.py");
const database = read("../../database.py");
const vercel = JSON.parse(read("../vercel.json"));

const esbuild = require_(path.join(here, "..", "node_modules", "esbuild"));
const bundle = esbuild.buildSync({
  entryPoints: [path.join(here, "..", "src", "lib", "publicRoute.ts")],
  bundle: true, format: "cjs", write: false, platform: "node",
  external: ["react"], loader: { ".ts": "ts" },
});
const cache = path.join(here, "..", "node_modules", ".cache");
mkdirSync(cache, { recursive: true });
const built = path.join(cache, "public-route.test.cjs");
writeFileSync(built, bundle.outputFiles[0].text);
const { publicRouteFor } = require_(built);

test("the policy resolves before the sign-in gate, not after it", () => {
  const gate = app.indexOf("if (!user) {");
  const legalBranch = app.indexOf("if (publicRoute) {");
  assert.ok(legalBranch > 0, "App must handle the public routes");
  assert.ok(legalBranch < gate, "a gated privacy policy is not a privacy policy");
  // And before the session restore, or reading it waits on a token exchange.
  assert.ok(legalBranch < app.indexOf("if (isRestoringSession) {"));
});

test("hash routes resolve, and an unknown one is not silently the dashboard", () => {
  assert.equal(publicRouteFor("/", "#/privacy"), "privacy");
  assert.equal(publicRouteFor("/", "#/terms"), "terms");
  assert.equal(publicRouteFor("/", "#/dashboard"), null);
  assert.equal(publicRouteFor("/", ""), null);
});

test("a path that is not the app's is a 404, whatever the hash says", () => {
  // Reachable only because the host rewrites unknown paths to index.html.
  // Routing is hash-based, so /privacy is a wrong address and /#/privacy is not.
  assert.equal(publicRouteFor("/privacy", ""), "not-found");
  assert.equal(publicRouteFor("/anything/at/all", "#/dashboard"), "not-found");
  assert.equal(publicRouteFor("", "#/terms"), "terms");
});

test("moving between the two legal pages is not a no-op", () => {
  // useHashRoute maps every unrecognised hash to the dashboard, so both of
  // these are one value to it and nothing re-renders. Clicking "Terms of use"
  // from the privacy page did exactly nothing until this had its own listener.
  const route = read("../src/lib/publicRoute.ts");
  assert.match(route, /addEventListener\("hashchange"/);
  assert.match(app, /const publicRoute = usePublicRoute\(\)/);
});

test("both pages are linked from the screen everyone lands on", () => {
  assert.match(login, /href=\{PRIVACY_HREF\}/);
  assert.match(login, /href=\{TERMS_HREF\}/);
});

test("the policy's claims match what the code actually stores", () => {
  // The whole value of this page is that it is true. A template would say
  // "we may collect certain information"; these are the columns.
  assert.doesNotMatch(database, /LargeBinary|BYTEA|file_bytes|pdf_data/i,
    "the policy says the PDF itself is never stored");
  assert.match(legal, /the\s+text,\s+not\s+the\s+file/);

  // Passwords: hash only, and the policy says so.
  assert.match(database, /only\s*\n?\s*#?\s*the PBKDF2 hash|PBKDF2/);
  assert.match(legal, /PBKDF2/);

  // No cookies anywhere in the frontend, which is what lets it say so.
  for (const source of [login, documents, api, app]) {
    assert.doesNotMatch(source, /document\.cookie/);
  }
  assert.match(legal, /sets\s+no\s+cookies/);
});

test("the terms do not claim to be an official system", () => {
  // CMPDI and Coal India are named because they are the problem statement.
  // A prototype implying it speaks for a ministry is the one claim here that
  // could actually cause harm.
  assert.match(legal, /not\s+an\s+official\s+system/);
  assert.match(legal, /has\s+not\s+been\s+commissioned/);
  // And the accuracy disclaimer, which is the substantive one.
  assert.match(legal, /not\s+guaranteed\s+to\s+be\s+correct/);
});

test("the host serves the app for an unknown path instead of its own 404", () => {
  const rewrite = vercel.rewrites?.[0];
  assert.ok(rewrite, "an unknown path must reach the app to get a branded 404");
  assert.equal(rewrite.destination, "/index.html");
  // Static files must not be swallowed by it, or robots.txt returns HTML.
  for (const asset of ["assets/", "robots\\.txt", "sitemap\\.xml", "favicon\\.svg"]) {
    assert.ok(rewrite.source.includes(asset), `${asset} must be excluded from the rewrite`);
  }
});

test("HTTPS is not merely available", () => {
  const headers = vercel.headers.flatMap((h) => h.headers).map((h) => h.key);
  assert.ok(headers.includes("Strict-Transport-Security"));
  assert.ok(headers.includes("X-Content-Type-Options"));
  assert.ok(headers.includes("X-Frame-Options"), "an auth'd tool should not be framed");
});

test("an oversized or non-PDF file is refused before it is sent", () => {
  // `accept` on the input is a filter, not a rule: drag-and-drop and "All
  // files" walk past it. And sending a file the server will certainly refuse
  // costs the whole upload before saying so.
  assert.match(documents, /const limit = await maxUploadBytes\(\)/);
  assert.match(documents, /only PDF files can be processed/);
  assert.match(documents, /is over the/);
  // The refusal must happen before the upload loop.
  assert.ok(
    documents.indexOf("maxUploadBytes()") < documents.indexOf("await uploadMiningDocument(file)")
  );
});

test("the ceiling has one source, and it is the server", () => {
  // Two copies of a limit drift, and the copy that drifts is the browser's -
  // which would either reject files the server would take, or let someone
  // wait out a 200 MB upload to be told no at the end.
  assert.match(backend, /"max_upload_mb": MAX_UPLOAD_BYTES \/\/ \(1024 \* 1024\)/);
  assert.match(api, /health\.max_upload_mb \?\? FALLBACK_MAX_UPLOAD_MB/);
  // An unreachable backend must not invent a limit error for a network fault.
  assert.match(api, /Number\.POSITIVE_INFINITY/);
});

test("the page owns a scroller, because body cannot be one here", () => {
  // `body` is overflow-hidden for the app shell. A legal page built with
  // min-h-screen grows underneath the viewport with nothing able to scroll
  // it, and everything past the fold is simply unreachable - the terms were
  // readable to "What you may upload" and stopped dead on the deployed site.
  assert.match(legal, /className="h-screen overflow-y-auto bg-background"/);
  assert.doesNotMatch(legal, /min-h-screen overflow-y-auto/);

  // And the audit has to be able to see it. Checking scrollHeight alone
  // reports overflow-hidden content as scrollable, which is why this shipped.
  const audit = read("./ux-audit.mjs");
  assert.match(audit, /below the fold and nothing scrolls/);
  assert.match(audit, /overflowY === "hidden"/);
});
