/**
 * Cumulative Layout Shift, measured against the running app.
 *
 *   npm run dev                        # in one shell
 *   node scripts/cls-audit.mjs         # in another
 *   VERBOSE=1 node scripts/cls-audit.mjs
 *
 * Every screen loads its data after first paint, so any placeholder whose
 * height or column widths differ from the real content makes the page jump
 * under the reader. Google treats a CLS above 0.1 as needing improvement.
 *
 * One trap worth naming, because it cost a round of imaginary bugs: the
 * observer is installed ONCE, before the loop. Adding the init script per
 * route stacks a fresh PerformanceObserver on every navigation and, with
 * buffered: true, each one counts the same entries again — the total then
 * grows with the number of routes already visited and invents failures that
 * are not there.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const THRESHOLD = 0.1;
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["dashboard", "documents", "ask", "analytics", "topics",
     "reports", "explorer", "validation", "settings"];

function resolveChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = "/opt/pw-browsers";
  let entries = [];
  try {
    entries = readdirSync(root);
  } catch {
    return undefined;
  }
  for (const dir of entries.filter((d) => d.startsWith("chromium")).sort().reverse()) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const candidate = join(root, dir, rel);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: resolveChromium() });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__cls = 0;
  window.__shifts = [];
  const describe = (node) => {
    try {
      if (!node || !node.tagName) return "?";
      let out = node.tagName.toLowerCase();
      if (node.id) out += "#" + node.id;
      if (node.className && typeof node.className === "string") {
        out += "." + node.className.split(" ").slice(0, 2).join(".");
      }
      const text = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 32);
      return out + (text ? ` "${text}"` : "");
    } catch {
      return "?";
    }
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue; // a shift the reader asked for does not count
      window.__cls += entry.value;
      window.__shifts.push({
        t: Math.round(entry.startTime),
        value: +entry.value.toFixed(4),
        sources: (entry.sources || []).slice(0, 3).map((s) => ({
          node: describe(s.node),
          prev: s.previousRect && [Math.round(s.previousRect.x), Math.round(s.previousRect.y),
                                   Math.round(s.previousRect.width), Math.round(s.previousRect.height)],
          cur: s.currentRect && [Math.round(s.currentRect.x), Math.round(s.currentRect.y),
                                 Math.round(s.currentRect.width), Math.round(s.currentRect.height)],
        })),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /sign in as demo/i }).click();
await page.waitForTimeout(3200);

const verbose = process.env.VERBOSE === "1";
console.log("  route        CLS     worst shift");
const bad = [];
for (const route of ROUTES) {
  // A full document load per route, so each measurement starts from zero.
  await page.goto(`${BASE}/#/${route}`, { waitUntil: "commit" });
  await page.reload({ waitUntil: "commit" });
  await page.waitForTimeout(3500);
  const result = await page.evaluate(() => ({ cls: window.__cls || 0, shifts: window.__shifts || [] }));
  const shifts = result.shifts.sort((a, b) => b.value - a.value);
  const worst = shifts[0];
  const flag = result.cls > THRESHOLD ? `  <-- above ${THRESHOLD}` : "";
  const where = worst ? `${worst.value} ${worst.sources.map((s) => s.node).join(" | ")}` : "-";
  console.log(`  ${route.padEnd(12)} ${result.cls.toFixed(3)}   ${where}${flag}`);
  if (verbose) {
    for (const shift of shifts.slice(0, 5)) {
      console.log(`       ${shift.value} @${shift.t}ms`);
      for (const src of shift.sources) {
        console.log(`         ${src.node}`);
        console.log(`           x,y,w,h ${JSON.stringify(src.prev)} -> ${JSON.stringify(src.cur)}`);
      }
    }
  }
  if (result.cls > THRESHOLD) bad.push(route);
}

console.log(bad.length
  ? `\n  ${bad.length} route(s) above the ${THRESHOLD} threshold: ${bad.join(", ")}`
  : `\n  every route within the ${THRESHOLD} threshold`);
await browser.close();
process.exit(bad.length ? 1 : 0);
