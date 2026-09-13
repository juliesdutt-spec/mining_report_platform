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

const BASE = process.env.UX_AUDIT_URL || "http://127.0.0.1:5173";
const ROUTES = ["dashboard", "documents", "ask", "analytics", "topics",
                "reports", "explorer", "validation", "settings"];
const MIN_TAP = 24;

const findings = [];
const add = (severity, page, what) => findings.push({ severity, page, what });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

async function signIn(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /sign in as demo/i }).click();
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

await browser.close();

if (consoleErrors.size) {
  console.log("\nuncaught page errors:");
  [...consoleErrors].forEach((e) => console.log("  " + e));
}
console.log("\nfindings:");
if (!findings.length) console.log("  none");
findings.forEach((f) => console.log(`  [${f.severity}] ${f.page.padEnd(11)} ${f.what}`));
process.exitCode = findings.length ? 1 : 0;
