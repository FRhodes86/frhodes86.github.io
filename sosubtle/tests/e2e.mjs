#!/usr/bin/env node
// Browser checks against the local preview server (scripts/dev-server.mjs).
// Run: npm run test:e2e   (needs Playwright with Chromium available)

import { spawn } from "node:child_process";
import { readdir, rm, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const site = JSON.parse(await readFile(path.join(ROOT, "content/site.json"), "utf8"));
const courses = JSON.parse(await readFile(path.join(ROOT, "content/courses.json"), "utf8"));

const PORT = 8765;
const BASE = `http://localhost:${PORT}`;
const PAGES = ["index", "about", "treatments", "academy", "gallery", "reviews", "contact", "privacy", "404"];
const VIEWPORTS = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 900 } };

let failures = 0, passes = 0;
const check = (cond, msg) => { if (cond) passes++; else { failures++; console.log(`  FAIL ${msg}`); } };

await rm(path.join(ROOT, ".outbox"), { recursive: true, force: true });
const server = spawn(process.execPath, ["scripts/dev-server.mjs"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), RESEND_API_KEY: "" }, stdio: "pipe" });
await new Promise((r) => server.stdout.once("data", r));

const browser = await chromium.launch();
const external = new Map();
try {
  // 1. Every page, every viewport
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
    for (const p of PAGES) {
      const res = await page.goto(`${BASE}/${p}.html`, { waitUntil: "networkidle" });
      check(res.status() === 200, `${p} (${vpName}) returns 200`);
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll("h1").length,
        title: document.title,
        desc: document.querySelector('meta[name="description"]')?.content || "",
        og: Boolean(document.querySelector('meta[property="og:image"]')),
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } }),
        imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
        fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
        bookNowVisible: [...document.querySelectorAll(".header-actions .btn")].some((b) => b.offsetParent !== null),
      }));
      check(info.overflow <= 0, `${p} (${vpName}) has no horizontal scroll (${info.overflow}px)`);
      check(info.h1 === 1, `${p} has exactly one h1`);
      check(info.title.length > 10 && info.title.length <= 70, `${p} title length ok (${info.title.length})`);
      check(info.desc.length >= 50 && info.desc.length <= 170, `${p} meta description length ok (${info.desc.length})`);
      check(info.og, `${p} has og:image`);
      check(info.ld.length > 0 && info.ld.every(Boolean), `${p} has valid JSON-LD`);
      check(info.imgsNoAlt === 0, `${p} images all have alt`);
      check(info.bookNowVisible, `${p} (${vpName}) shows Book now in header`);
      if (vpName === "desktop") check(info.fonts.some((f) => f.includes("Bodoni")) && info.fonts.some((f) => f.includes("Hanken")), `${p} brand fonts loaded`);

      if (vpName === "desktop") {
        // Links
        const links = await page.$$eval("a[href]", (as) => as.map((a) => ({ href: a.href, raw: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.textContent.trim() || a.getAttribute("aria-label") })));
        for (const l of links) {
          if (l.href.startsWith(BASE)) {
            const u = new URL(l.href);
            const r = await ctx.request.get(`${BASE}${u.pathname}`);
            check(r.status() === 200, `${p}: internal link ${l.raw} resolves`);
            if (u.hash && u.pathname.endsWith(".html") && u.hash.length > 1) {
              const html = await r.text();
              check(html.includes(`id="${u.hash.slice(1)}"`), `${p}: anchor ${l.raw} exists`);
            }
          } else if (l.href.startsWith("http")) {
            check(l.target === "_blank" && l.rel.includes("noopener"), `${p}: external ${l.href} opens safely in new tab`);
            external.set(l.href, (external.get(l.href) || 0) + 1);
          }
        }
        // Accessibility (axe, WCAG 2.1 A/AA)
        await page.evaluate(() => document.querySelectorAll(".reveal-ready").forEach((e) => e.classList.add("is-in")));
        await page.waitForTimeout(1000); // let reveal transitions finish so contrast is measured at rest
        await page.addScriptTag({ content: axeSource });
        const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`));
        check(axe.length === 0, `${p}: axe WCAG A/AA violations: ${axe.join("; ")}`);
      }
    }
    check(errors.length === 0, `no console/page errors at ${vpName}: ${errors.join(" | ")}`);
    await ctx.close();
  }

  // 2. Booking + academy destinations
  const bookingHrefs = [...external.keys()].filter((u) => u.includes("that-time.co.uk"));
  check(bookingHrefs.length > 0 && bookingHrefs.every((u) => u === site.bookingUrl), `all booking links go to ${site.bookingUrl}`);
  const beacons = [...external.keys()].filter((u) => u.includes("beacons.ai"));
  check(beacons.length > 0 && beacons.every((u) => u === courses.courses[0].enrolUrl), "all Academy enrol links go to the verified Beacons product");

  // 3. Mobile menu
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`);
    await page.click(".header-actions .menu-toggle");
    check(await page.isVisible("#mobile-nav"), "mobile menu opens");
    check((await page.getAttribute(".header-actions .menu-toggle", "aria-expanded")) === "true", "menu toggle reports expanded");
    await page.keyboard.press("Escape");
    check(await page.isHidden("#mobile-nav"), "mobile menu closes with Escape");
    await page.click(".header-actions .menu-toggle");
    await page.click("#mobile-nav a[href='academy.html']");
    await page.waitForURL(/academy\.html/);
    check(true, "mobile menu navigates to Academy");
    await ctx.close();
  }

  // 4. Gallery filter
  {
    const page = await browser.newPage();
    await page.goto(`${BASE}/gallery.html`);
    await page.click("[data-filter=academy]");
    const visible = await page.$$eval("[data-gallery] [data-cat]", (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.cat));
    check(visible.length > 0 && visible.every((c) => c === "academy"), "gallery filter shows only the chosen category");
    await page.close();
  }

  // 5. Enquiry form: validation, then a real POST to the local handler (email written to .outbox, not sent)
  {
    const page = await browser.newPage();
    await page.goto(`${BASE}/contact.html?interest=level-up-lips`);
    check((await page.inputValue("#f-interest")) === "Level Up Lips Masterclass", "?interest= pre-selects the course");
    await page.click("button[type=submit]");
    const invalid = await page.$$eval("[aria-invalid=true]", (els) => els.map((e) => e.name));
    check(invalid.length >= 4, `empty submit flags fields (${invalid.join(",")})`);
    check((await page.textContent("#form-status")).includes("check"), "empty submit shows an error summary");
    await page.fill("#f-name", "Playwright Test");
    await page.fill("#f-email", "test@example.com");
    await page.fill("#f-phone", "07123 456789");
    await page.fill("#f-message", "This is an automated test enquiry from the preview build.");
    await page.check("#f-privacy");
    await page.waitForTimeout(3200); // the server ignores forms filled in under 3 seconds
    await page.click("button[type=submit]");
    await page.waitForSelector(".form-status.ok, .form-status.bad", { timeout: 5000 });
    check(await page.isVisible(".form-status.ok"), `valid submit succeeds: ${await page.textContent("#form-status")}`);
    const outbox = await readdir(path.join(ROOT, ".outbox")).catch(() => []);
    check(outbox.length === 1, "exactly one email written to the local outbox");
    // honeypot via direct POST
    const r = await page.request.post(`${BASE}/api/enquiry`, { data: { company: "bot", ts: "1" } });
    check(r.status() === 200 && (await readdir(path.join(ROOT, ".outbox"))).length === 1, "honeypot submission accepted silently and not emailed");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log(`\nExternal destinations linked (${external.size}):`);
for (const [u, n] of external) console.log(`  ${n}x ${u}`);
console.log(`\n${passes} checks passed, ${failures} failed.`);
process.exit(failures ? 1 : 0);
