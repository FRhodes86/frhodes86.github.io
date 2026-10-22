#!/usr/bin/env node
// Renders src/assets/img/og.png (1200x630 social sharing card). Needs Playwright.
import path from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const font = (f) => `url("file://${ROOT}/src/assets/fonts/${f}")`;
const html = `<style>
@font-face{font-family:B;src:${font("bodoni-moda-normal.woff2")}}@font-face{font-family:B;font-style:italic;src:${font("bodoni-moda-italic.woff2")}}@font-face{font-family:H;src:${font("hanken-grotesk-normal.woff2")}}
body{margin:0;width:1200px;height:630px;background:#f7f3f2;display:grid;grid-template-columns:1fr 430px;font-family:H}
.l{padding:80px;display:grid;align-content:center;gap:28px}.e{font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:#7a3e51}
h1{font:400 84px/1.02 B;margin:0;color:#2b1f25}h1 em{color:#7a3e51}.s{font-size:26px;color:#66585e}
.r{background:linear-gradient(170deg,#e6cfd1,#efe6e5 70%);position:relative}svg{position:absolute;inset:0;width:100%;height:100%}path{fill:none;stroke:#7a3e51;stroke-width:1.6}</style>
<div class="l"><div class="e">Dartford, Kent</div><h1><em>So Subtle</em><br>Aesthetics</h1><div class="s">Lip &amp; skin treatments · So Subtle Academy</div></div>
<div class="r"><svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"><path d="M60 250C105 236 140 206 170 204c14-1 24 10 30 18 6-8 16-19 30-18 30 2 65 32 110 46"/><path d="M60 250c60 12 100 6 140 10 40-4 80 2 140-10"/><path d="M60 250c50 50 100 62 140 62s90-12 140-62"/></svg></div>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
const tmp = path.join(ROOT, "src/assets/fonts/_og.html");
await writeFile(tmp, html.replaceAll(`file://${ROOT}/src/assets/fonts/`, ""));
await p.goto(`file://${tmp}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await rm(tmp);
await p.screenshot({ path: path.join(ROOT, "src/assets/img/og.png") });
await b.close();
console.log("Wrote src/assets/img/og.png");
