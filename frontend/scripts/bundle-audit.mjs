/**
 * What a first visit actually downloads.
 *
 *   npm run build
 *   node scripts/bundle-audit.mjs
 *
 * The charts library is 541 kB and only the Analytics page draws a chart, so
 * it must not be on the path to the sign-in screen. It was, for a reason that
 * reads as the opposite of what the config said:
 *
 *   manualChunks: { charts: ['recharts'] }
 *
 * That did not isolate recharts. It swept recharts' shared transitive
 * dependencies into the same chunk, so every page chunk — Dashboard, Ask,
 * Settings, Documents, Validation, Topics, Report Studio, Data Explorer —
 * imported it, and whichever screen you opened first pulled all 541 kB.
 * Lazily importing AnalyticsPage never helped. Measured on a 400 kbps
 * connection it was 151 kB over the wire and 6.2s of the critical path.
 *
 * This walks the built output rather than trusting the config.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const ASSETS = join(DIST, "assets");

if (!existsSync(ASSETS)) {
  console.error("no dist/assets — run `npm run build` first");
  process.exit(2);
}

const html = readFileSync(join(DIST, "index.html"), "utf8");
const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
const read = (f) => readFileSync(join(ASSETS, f), "utf8");

// recharts leaves fingerprints no minifier renames: its own displayNames.
const RECHARTS = /(ResponsiveContainer|CartesianGrid|recharts)/;
const chartChunks = files.filter((f) => RECHARTS.test(read(f)));

// The entry, plus anything the HTML tells the browser to fetch up front.
const entry = (html.match(/<script[^>]+src="\/assets\/([^"]+)"/) || [])[1];
const preloaded = [...html.matchAll(/rel="modulepreload"[^>]*href="\/assets\/([^"]+)"/g)].map((m) => m[1]);

const eager = new Set([entry, ...preloaded].filter(Boolean));
// One hop: whatever the eager chunks import statically.
for (const file of [...eager]) {
  if (!file || !files.includes(file)) continue;
  for (const other of files) {
    if (other !== file && read(file).includes(`from"./${other}"`)) eager.add(other);
  }
}

const findings = [];
for (const chunk of chartChunks) {
  if (eager.has(chunk)) findings.push(`${chunk} carries the charts library and is fetched on first load`);
}

// Only the Analytics page has any business referencing it.
for (const file of files) {
  if (chartChunks.includes(file)) continue;
  for (const chunk of chartChunks) {
    if (read(file).includes(chunk) && !/^AnalyticsPage-|^index-/.test(file)) {
      findings.push(`${file} imports the charts chunk ${chunk}`);
    }
  }
}

const size = (f) => (readFileSync(join(ASSETS, f)).length / 1024).toFixed(0);
console.log("first load fetches:");
for (const f of [...eager].filter(Boolean).sort()) console.log(`  ${f.padEnd(34)} ${size(f).padStart(5)} kB`);
console.log("\ncharts library lives in:");
for (const f of chartChunks) console.log(`  ${f.padEnd(34)} ${size(f).padStart(5)} kB${eager.has(f) ? "   <-- on the critical path" : ""}`);

console.log(findings.length ? "\nfindings:" : "\nfindings:\n  none");
findings.forEach((f) => console.log("  " + f));
process.exit(findings.length ? 1 : 0);
