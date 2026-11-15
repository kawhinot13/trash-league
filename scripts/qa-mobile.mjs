#!/usr/bin/env node
/**
 * Phone-width QA for any running build of the site.
 *
 *   node scripts/qa-mobile.mjs <base-url> <path> [path...] [--out <dir>] [--width 390] [--shots]
 *
 * For each path: loads it at phone size, waits for the network to settle, and reports page errors,
 * console errors, failed requests, horizontal overflow (and which elements cause it), tap targets
 * under 40px, and load time. Prints one compact JSON report (cheap to read) and exits 1 when any
 * page has a problem. --shots also saves a screenshot per page into --out.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// The sandbox ships Playwright globally (found via require, not ESM import); a local install works too.
const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const width = Number(opt("--width", "390"));
const out = opt("--out", "qa-shots");
const shots = flag("--shots");
const [base, ...paths] = args;
if (!base || !paths.length) {
  console.error("usage: node scripts/qa-mobile.mjs <base-url> <path> [path...] [--out dir] [--width 390] [--shots]");
  process.exit(2);
}
if (shots) mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const report = [];
for (const path of paths) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 160)}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    // Cancelled loads (media preloads, prefetches the page dropped) aren't failures.
    if (u.includes("_next/webpack-hmr") || r.failure()?.errorText?.includes("ERR_ABORTED")) return;
    errors.push(`request failed: ${u.slice(0, 120)}`);
  });
  const t0 = Date.now();
  let status = 0;
  try {
    const res = await page.goto(base.replace(/\/$/, "") + path, { waitUntil: "networkidle", timeout: 90_000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(800);
  } catch (e) {
    errors.push(`navigation: ${String(e).slice(0, 160)}`);
  }
  const ms = Date.now() - t0;
  const layout = await page
    .evaluate((w) => {
      const sw = document.documentElement.scrollWidth;
      const wide = [];
      if (sw > w)
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
            const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className && typeof el.className === "string" ? `.${el.className.split(" ").slice(0, 2).join(".")}` : "");
            wide.push(`${name} (right ${Math.round(r.right)}px)`);
            if (wide.length >= 5) break;
          }
        }
      const small = [];
      for (const el of document.querySelectorAll("a, button, select, input, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.height < 40 && r.width < 40)) {
          small.push((el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30));
          if (small.length >= 5) break;
        }
      }
      return { scrollWidth: sw, wide, smallTargets: small, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) ?? null };
    }, width)
    .catch(() => ({ scrollWidth: 0, wide: [], smallTargets: [], h1: null }));
  if (shots) await page.screenshot({ path: join(out, `${path.replace(/[^\w-]+/g, "_") || "root"}.png`) }).catch(() => {});
  if (!layout.h1 && status && status < 400) errors.push("no h1 on the page");
  const ok = status > 0 && status < 400 && !errors.length && layout.scrollWidth <= width;
  report.push({ path, ok, status, ms, h1: layout.h1, overflow: layout.scrollWidth > width ? layout.scrollWidth - width : 0, wide: layout.wide, smallTargets: layout.smallTargets, errors: errors.slice(0, 5) });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ width, pages: report.length, failing: report.filter((r) => !r.ok).length, report }, null, 1));
process.exit(report.some((r) => !r.ok) ? 1 : 0);
