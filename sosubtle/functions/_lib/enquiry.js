// Server-side enquiry handling. Runs as a Cloudflare Pages Function in
// production (functions/api/enquiry.js) and inside scripts/dev-server.mjs locally.
// Nothing here logs the visitor's personal details.

import { validateEnquiry } from "./validate.js";
import { INTERESTS } from "./interests.generated.js";

const MAX_BODY_BYTES = 10_000;
const MIN_FILL_MS = 3_000; // humans take longer than this to fill the form
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT = { max: 5, windowSeconds: 600 };

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

// Fallback limiter for local use or when no KV namespace is bound.
// Per-isolate only, so production should bind ENQUIRY_RL (KV) as well.
const memoryHits = new Map();
export function memoryRateLimiter() {
  return async (key, now) => {
    const windowMs = RATE_LIMIT.windowSeconds * 1000;
    const hits = (memoryHits.get(key) || []).filter((t) => now - t < windowMs);
    hits.push(now);
    memoryHits.set(key, hits);
    return hits.length <= RATE_LIMIT.max;
  };
}
export function resetMemoryRateLimiter() { memoryHits.clear(); }

export function kvRateLimiter(kv) {
  return async (key, now) => {
    const bucket = Math.floor(now / (RATE_LIMIT.windowSeconds * 1000));
    const k = `rl:${key}:${bucket}`;
    const count = parseInt((await kv.get(k)) || "0", 10) + 1;
    await kv.put(k, String(count), { expirationTtl: RATE_LIMIT.windowSeconds * 2 });
    return count <= RATE_LIMIT.max;
  };
}

export function resendSender(env) {
  return async ({ subject, text, replyTo }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.ENQUIRY_FROM_EMAIL,
        to: env.ENQUIRY_TO_EMAIL.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: replyTo,
        subject,
        text,
      }),
    });
    if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
  };
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

async function readBody(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) return JSON.parse(raw);
    if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  } catch { return null; }
  return null;
}

export function formatEmail(d, meta) {
  const subject = `Website enquiry: ${d.interest} - ${d.name}`;
  const text = [
    `New enquiry from the So Subtle Aesthetics website`,
    ``,
    `Name: ${d.name}`,
    `Email: ${d.email}`,
    `Telephone: ${d.phone}`,
    `Interested in: ${d.interest}`,
    ``,
    `Message:`,
    d.message,
    ``,
    `---`,
    `Sent ${meta.when}. The visitor confirmed they had read the privacy notice.`,
    `Reply to this email to answer them directly.`,
  ].join("\n");
  return { subject, text };
}

export async function handleEnquiry(request, env = {}, deps = {}) {
  const now = deps.now ? deps.now() : Date.now();

  if (request.method !== "POST") return json(405, { ok: false, message: "Use the form on the contact page." }, { allow: "POST" });

  if (env.ALLOWED_ORIGIN) {
    const origin = request.headers.get("origin");
    const allowed = env.ALLOWED_ORIGIN.split(",").map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json(403, { ok: false, message: "This form can only be sent from the So Subtle Aesthetics website." });
  }

  const body = await readBody(request);
  if (!body || typeof body !== "object") return json(400, { ok: false, message: "We could not read the form. Please refresh the page and try again." });

  // Honeypot and timing checks. Bots get a normal-looking success so they do not retry.
  const started = Number(body.ts);
  const tooFast = !Number.isFinite(started) || now - started < MIN_FILL_MS || now - started > MAX_FORM_AGE_MS;
  if ((body.company && String(body.company).trim() !== "") || tooFast) {
    return json(200, { ok: true, message: "Thank you. Your enquiry has been sent." });
  }

  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = deps.rateLimit || (env.ENQUIRY_RL ? kvRateLimiter(env.ENQUIRY_RL) : memoryRateLimiter());
  if (!(await limiter(ip, now))) {
    return json(429, { ok: false, message: "You have sent several enquiries in a short time. Please wait ten minutes and try again." }, { "retry-after": String(RATE_LIMIT.windowSeconds) });
  }

  if (env.TURNSTILE_SECRET) {
    const passed = await (deps.verifyTurnstile || verifyTurnstile)(env.TURNSTILE_SECRET, body["cf-turnstile-response"], ip);
    if (!passed) return json(400, { ok: false, message: "Please complete the security check and send the form again." });
  }

  const { ok, data, errors } = validateEnquiry(body, INTERESTS);
  if (!ok) return json(422, { ok: false, message: "Please check the highlighted fields.", errors });

  const sendMail = deps.sendMail || ((env.RESEND_API_KEY && env.ENQUIRY_TO_EMAIL && env.ENQUIRY_FROM_EMAIL) ? resendSender(env) : null);
  if (!sendMail) {
    return json(503, { ok: false, message: "Online enquiries are not switched on yet. Please message us on Instagram or book through the booking page." });
  }

  try {
    const { subject, text } = formatEmail(data, { when: new Date(now).toISOString() });
    await sendMail({ subject, text, replyTo: data.email, data });
  } catch {
    return json(502, { ok: false, message: "Your enquiry could not be sent just now. Please try again shortly, or message us on Instagram." });
  }

  return json(200, { ok: true, message: "Thank you. Your enquiry has been sent and Natasha will reply as soon as she can." });
}
