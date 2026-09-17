/**
 * A repeatable UI audit against the running app.
 *
 *   npm run dev                       # in one shell
 *   node scripts/ux-audit.mjs         # in another
 *
 * It checks the things that are cheap to get wrong and invisible in review:
 * table columns that can never fill, placeholder text left on screen, tap
 * targets too small for a finger, controls a screen reader cannot name,
 * horizontal overflow, and text below WCAG AA contrast in either theme.
 *
 * Three of its rules were wrong when first written, and the corrections are
 * the interesting part. A control is not unnamed just because its element has no
 * text — a `<label for>` names it, and checking only textContent reported
 * four perfectly accessible checkboxes as broken. And a 16px checkbox is not
 * unreachable when a 24px label beside it toggles the same state, which is
 * exactly the exemption WCAG 2.5.8 makes. And a skip link is 1x1 until it
 * is focused, which is the whole design — reporting it as an unreachable
 * control flagged the very fix for the problem the audit had just found.
 * An audit that reports those as defects trains people to ignore it.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.UX_AUDIT_URL || "http://127.0.0.1:5173";
const ROUTES = ["dashboard", "documents", "ask", "analytics", "topics",
                "reports", "explorer", "validation", "settings"];
const MIN_TAP = 24;

const findings = [];
const add = (severity, page, what) => findings.push({ severity, page, what });

// The browser Playwright downloads and the one already on the machine are
// pinned to different revisions, so leaving the path to Playwright made the
// audit fail to start rather than report anything.
function resolveChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const roots = ["/opt/pw-browsers"];
  for (const root of roots) {
    let entries = [];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const dir of entries.filter((d) => d.startsWith("chromium")).sort().reverse()) {
      for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
        const candidate = join(root, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined; // let Playwright use its own download
}

const browser = await chromium.launch({ executablePath: resolveChromium() });

async function signIn(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /enter demo workspace|sign in as demo/i }).click();
  await page.waitForTimeout(3000);
}

/** Elements too small to hit, excluding those with a large label that does the same job. */
const SMALL_TARGETS = (min) => {
  const elements = [...document.querySelectorAll("button, a[href], [role='button']")];
  return elements.filter((el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    if (rect.height >= min && rect.width >= min) return false;

    // Visually-hidden controls are keyboard affordances, not touch targets.
    // A skip link is 1x1 until it is focused, at which point it becomes a
    // full-size button — flagging it taught the audit to distrust itself.
    const style = getComputedStyle(el);
    const clipped = style.clip === "rect(0px, 0px, 0px, 0px)" ||
                    style.clipPath === "inset(50%)" ||
                    (rect.width <= 1 && rect.height <= 1);
    if (clipped) return false;

    // WCAG 2.5.8 exempts a control when an equivalent one meets the size.
    // A labelled checkbox is the common case: the box is 16px, the label
    // beside it is not, and clicking the label toggles the box.
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) {
        const lr = label.getBoundingClientRect();
        if (lr.height >= min && lr.width >= min) return false;
      }
    }
    return true;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return `${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30) || "(unnamed)"} ` +
           `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
};

/** Controls with no accessible name, counting label[for] and aria-labelledby. */
const UNNAMED = () =>
  [...document.querySelectorAll("button, a[href], [role='button']")]
    .filter((el) => el.offsetParent !== null)
    .filter((el) => {
      if ((el.getAttribute("aria-label") || "").trim()) return false;
      if ((el.textContent || "").trim()) return false;
      if ((el.getAttribute("title") || "").trim()) return false;
      const by = el.getAttribute("aria-labelledby");
      if (by && by.split(/\s+/).some((id) => document.getElementById(id))) return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
      return true;
    })
    .map((el) => el.outerHTML.slice(0, 90).replace(/\s+/g, " "));


/** WCAG AA contrast for every text node, computed against its effective background. */
const LOW_CONTRAST = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const behind = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.5) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("main *")) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
    // WCAG 1.4.3 exempts text that is part of a logo or brand name. The
    // wordmark declares itself with data-logotype so the exemption is narrow:
    // it covers the mark and nothing else that happens to be the same colour.
    if (el.closest("[data-logotype]")) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join(" ").trim();
    if (text.length < 2) continue;

    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG counts 24px, or 18.66px bold, as large text.
    const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const r = ratio(fg, behind(el));
    if (r >= required) continue;
    const key = `${text.slice(0, 24)}|${Math.round(r * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${r.toFixed(2)}:1 (needs ${required}) ${Math.round(size)}px ${JSON.stringify(text.slice(0, 30))}`);
  }
  return out.slice(0, 6);
};

const desktop = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await desktop.newPage();
const consoleErrors = new Set();
page.on("pageerror", (e) => consoleErrors.add(String(e).slice(0, 140)));

await signIn(page);

for (const route of ROUTES) {
  await page.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);

  for (const html of await page.evaluate(UNNAMED)) {
    add("a11y", route, `control with no accessible name: ${html}`);
  }

  const deadColumns = await page.evaluate(() => {
    const dead = [];
    for (const table of document.querySelectorAll("table")) {
      const heads = [...table.querySelectorAll("thead th")].map((t) => t.textContent.trim());
      const rows = [...table.querySelectorAll("tbody tr")];
      if (rows.length < 2) continue;
      heads.forEach((head, i) => {
        if (!head) return;
        const values = rows.map((r) => (r.children[i]?.textContent || "").trim());
        if (values.every((v) => v === "" || v === "—" || v === "-")) dead.push(head);
      });
    }
    return dead;
  });
  deadColumns.forEach((h) =>
    add("ux", route, `column "${h}" is empty in every row — it cannot fill, or nothing populates it`));

  const placeholders = await page.evaluate(() => {
    const rx = /(·\s*pp\.\s*(?![0-9]))|\bundefined\b|\bNaN\b|\[object Object\]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (text && rx.test(text)) seen.add(text.slice(0, 60));
    }
    return [...seen].slice(0, 5);
  });
  placeholders.forEach((t) => add("ux", route, `placeholder text on screen: ${JSON.stringify(t)}`));

  if (await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
    add("layout", route, "horizontal scroll at 1440px");
  }

  for (const failure of await page.evaluate(LOW_CONTRAST)) {
    add("a11y", route, `text below WCAG AA: ${failure}`);
  }
}

// The same sweep in dark mode: the two themes define their own tokens, so a
// value that passes in one says nothing about the other.
const darkCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const darkPage = await darkCtx.newPage();
await darkPage.addInitScript(() => localStorage.setItem("dataforge-theme", "dark"));
await signIn(darkPage);
for (const route of ROUTES) {
  await darkPage.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
  await darkPage.waitForTimeout(1200);
  for (const failure of await darkPage.evaluate(LOW_CONTRAST)) {
    add("a11y", `${route} (dark)`, `text below WCAG AA: ${failure}`);
  }
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const small = await mobile.newPage();
await signIn(small);
for (const route of ROUTES) {
  await small.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
  await small.waitForTimeout(1100);
  if (await small.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
    add("layout", route, "horizontal scroll at 390px");
  }
  for (const target of await small.evaluate(SMALL_TARGETS, MIN_TAP)) {
    add("a11y", route, `tap target under ${MIN_TAP}px: ${target}`);
  }
}

// The sign-in screen.
//
// Every pass in this file began by signing in, so the one page every visitor
// sees first — and the only one an evaluator sees before deciding whether the
// deployment works — had never been checked at all. Its brand panel is dark in
// both themes and the form is not, so contrast there is worth knowing rather
// than assuming.
{
  for (const [label, viewport] of [
    ["sign-in", { width: 1440, height: 950 }],
    ["sign-in 390px", { width: 390, height: 844 }],
  ]) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport });
      const entry = await ctx.newPage();
      await entry.goto(BASE, { waitUntil: "domcontentloaded" });
      if (theme === "dark") {
        await entry.evaluate(() => localStorage.setItem("dataforge-theme", "dark"));
        await entry.reload({ waitUntil: "networkidle" });
      }
      await entry.waitForTimeout(1800);
      const where = `${label} ${theme}`;

      for (const finding of await entry.evaluate(LOW_CONTRAST)) add("a11y", where, finding);
      for (const target of await entry.evaluate(SMALL_TARGETS, MIN_TAP)) {
        add("a11y", where, `tap target under ${MIN_TAP}px: ${target}`);
      }
      if (await entry.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
        add("layout", where, "horizontal scroll");
      }
      // The demo account is the only way in for someone who was never issued
      // credentials, so its absence is a broken deployment, not a tidy one.
      if (!(await entry.getByRole("button", { name: /enter demo workspace|sign in as demo/i }).count())) {
        add("content", where, "no demo sign-in offered");
      }
      await ctx.close();
    }
  }
}

// Text that spills out of the box drawn around it.
//
// The Validation page put a disputed value in each of two side-by-side panes
// at 30px mono. That is right for `3,50,000 MT` and wrong for a disputed
// filename: `sample_mining_report.pdf` overran its pane and collided with the
// value beside it, leaving the comparison the page exists to make unreadable.
// The page did not scroll sideways, so the existing check never saw it.
const SPILLS = () =>
  [...document.querySelectorAll("#main-content *")]
    .filter((el) => {
      const style = getComputedStyle(el);
      // Content wider than its box only matters where nothing clips or scrolls
      // it — a truncate or an overflow-auto container is doing its job.
      if (style.overflowX !== "visible" || style.position === "absolute") return false;
      if (el.scrollWidth <= el.clientWidth + 1) return false;
      // Leaf text only: a wide child reports up through every ancestor.
      return el.children.length === 0 && (el.textContent || "").trim().length > 0;
    })
    .map((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28);
      return `"${text}" overflows its box by ${el.scrollWidth - el.clientWidth}px`;
    })
    .slice(0, 4);

for (const route of ROUTES) {
  await page.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  for (const spill of await page.evaluate(SPILLS)) add("layout", route, spill);
}

// Paper. The app is a fixed-height shell — h-screen on the frame, a scroll
// container for the page — which is right on a screen and wrong on paper:
// before the print rules, the Data Explorer printed one A4 sheet holding nine
// of sixteen rows, with four of nine columns cut off the right edge and
// nothing on the sheet to say so.
{
  // A4 portrait inside the 14mm @page margin is about 182mm ≈ 688 CSS px.
  const paper = await browser.newContext({ viewport: { width: 688, height: 900 } });
  const sheet = await paper.newPage();
  await signIn(sheet);
  await sheet.emulateMedia({ media: "print" });
  for (const route of ROUTES) {
    await sheet.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
    await sheet.waitForTimeout(1400);
    const found = await sheet.evaluate(() => {
      const problems = [];
      const main = document.getElementById("main-content");
      if (!main) return ["no main region"];
      // A scroll container on paper is content that never prints.
      if (main.scrollHeight > main.clientHeight + 2) {
        problems.push(`main still scrolls on paper (${main.scrollHeight} of ${main.clientHeight} printed)`);
      }
      const gone = (sel) => {
        const el = document.querySelector(sel);
        return !el || getComputedStyle(el).display === "none";
      };
      if (!gone("#app-sidebar")) problems.push("the sidebar prints");
      if (!gone("header")) problems.push("the header prints");
      // Which screen, whose documents, and when.
      const stamp = [...document.querySelectorAll("div")].find((d) =>
        /DataForge · /.test(d.textContent || "") && d.children.length === 0);
      if (!stamp) problems.push("nothing on the sheet says which screen it is");

      const width = document.documentElement.clientWidth;
      for (const el of main.querySelectorAll("table, pre, img")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > width + 2) {
          problems.push(`${el.tagName.toLowerCase()} runs ${Math.round(rect.right - width)}px off the right edge`);
          break;
        }
      }
      return problems;
    });
    for (const problem of found) add("print", route, problem);
  }
  await paper.close();
}

// The navigation drawer covers the page on a phone, so it has to behave like
// a dialog. It is an <aside> with a transform, not a Radix dialog, so none of
// that comes for free: before the trap, Tab walked eleven controls on the page
// behind it.
{
  const describe = () =>
    small.evaluate(() => {
      const active = document.activeElement;
      if (!active) return { label: "none", inSidebar: false };
      return {
        label: active.getAttribute("aria-label") ||
          (active.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24),
        inSidebar: !!active.closest("#app-sidebar"),
      };
    });

  await small.goto(`${BASE}/#/dashboard`, { waitUntil: "networkidle" });
  await small.waitForTimeout(900);
  const toggle = small.getByRole("button", { name: "Toggle sidebar" }).first();
  await toggle.click();
  await small.waitForTimeout(400);

  const modal = await small.evaluate(() => {
    const el = document.getElementById("app-sidebar");
    return el?.getAttribute("role") === "dialog" && el?.getAttribute("aria-modal") === "true";
  });
  if (!modal) add("a11y", "shell", "the open navigation drawer is not announced as a modal dialog");

  if (!(await describe()).inSidebar) {
    add("a11y", "shell", "opening the navigation drawer leaves focus on the page behind it");
  }

  let escaped = 0;
  for (let i = 0; i < 16; i += 1) {
    await small.keyboard.press("Tab");
    if (!(await describe()).inSidebar) escaped += 1;
  }
  if (escaped) {
    add("a11y", "shell", `${escaped} of 16 tab stops left the open drawer for the page it covers`);
  }

  await small.keyboard.press("Escape");
  await small.waitForTimeout(400);
  const after = await describe();
  if (after.label !== "Toggle sidebar") {
    add("a11y", "shell", `closing the drawer put focus on "${after.label}" rather than back on its toggle`);
  }
}

// WCAG 1.4.10 puts the number at 320px: below that a reader has to scroll in
// two directions to read one line, which is what the criterion exists to stop.
// 390px is the phone people actually hold; 320px is the promise.
const narrow = await browser.newContext({ viewport: { width: 320, height: 800 } });
const tiny = await narrow.newPage();
await signIn(tiny);
for (const route of ROUTES) {
  await tiny.goto(`${BASE}/#/${route}`, { waitUntil: "networkidle" });
  await tiny.waitForTimeout(1100);
  if (await tiny.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
    add("layout", route, "horizontal scroll at 320px (WCAG 1.4.10 reflow)");
  }
}

await browser.close();

if (consoleErrors.size) {
  console.log("\nuncaught page errors:");
  [...consoleErrors].forEach((e) => console.log("  " + e));
}
console.log("\nfindings:");
if (!findings.length) console.log("  none");
findings.forEach((f) => console.log(`  [${f.severity}] ${f.page.padEnd(11)} ${f.what}`));
process.exitCode = findings.length ? 1 : 0;
