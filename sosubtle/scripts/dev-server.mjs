#!/usr/bin/env node
// Local preview server: serves dist/ and runs the real enquiry handler at /api/enquiry.
// Emails are NOT sent. They are written to .outbox/ so the form can be tested safely.
//   PORT=8080 node scripts/dev-server.mjs

import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleEnquiry } from "../functions/_lib/enquiry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUTBOX = path.join(ROOT, ".outbox");
const PORT = Number(process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml" };

const outboxSender = async ({ subject, text }) => {
  await mkdir(OUTBOX, { recursive: true });
  await writeFile(path.join(OUTBOX, `${Date.now()}.txt`), `Subject: ${subject}\n\n${text}\n`);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/api/enquiry") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: { ...req.headers, "cf-connecting-ip": req.socket.remoteAddress }, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await handleEnquiry(request, { ...process.env }, { sendMail: process.env.RESEND_API_KEY ? undefined : outboxSender });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    return;
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    res.end(await readFile(path.join(DIST, "404.html")).catch(() => "Not found"));
  }
});

server.listen(PORT, () => console.log(`So Subtle preview on http://localhost:${PORT} (enquiries go to .outbox/, nothing is emailed)`));
