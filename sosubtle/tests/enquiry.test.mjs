import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleEnquiry, resetMemoryRateLimiter, formatEmail } from "../functions/_lib/enquiry.js";
import { validateEnquiry } from "../functions/_lib/validate.js";

const NOW = 1_800_000_000_000;
const good = () => ({
  name: "Test Person", email: "test@example.com", phone: "07123 456789",
  interest: "Lip enhancement", message: "I would like to ask about lip enhancement.", privacy: true,
  company: "", ts: String(NOW - 20_000),
});
const req = (body, { headers = {}, method = "POST", raw } = {}) => new Request("http://localhost/api/enquiry", {
  method, headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9", ...headers },
  body: method === "GET" ? undefined : raw ?? JSON.stringify(body),
});
const env = { ENQUIRY_TO_EMAIL: "owner@example.com", ENQUIRY_FROM_EMAIL: "site@example.com", RESEND_API_KEY: "x" };
let sent;
const deps = () => ({ now: () => NOW, sendMail: async (m) => { sent.push(m); } });

beforeEach(() => { sent = []; resetMemoryRateLimiter(); });

test("accepts a valid enquiry and sends one email with reply-to set", async () => {
  const res = await handleEnquiry(req(good()), env, deps());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].replyTo, "test@example.com");
  assert.match(sent[0].subject, /Lip enhancement/);
});

test("rejects invalid fields with field-level errors", async () => {
  const res = await handleEnquiry(req({ ...good(), email: "nope", phone: "12", message: "hi", privacy: false, interest: "Free stuff" }), env, deps());
  assert.equal(res.status, 422);
  const out = await res.json();
  assert.deepEqual(Object.keys(out.errors).sort(), ["email", "interest", "message", "phone", "privacy"]);
  assert.equal(sent.length, 0);
});

test("silently drops honeypot and too-fast submissions", async () => {
  for (const body of [{ ...good(), company: "Spam Ltd" }, { ...good(), ts: String(NOW - 500) }, { ...good(), ts: "" }]) {
    const res = await handleEnquiry(req(body), env, deps());
    assert.equal(res.status, 200);
  }
  assert.equal(sent.length, 0);
});

test("rate limits after 5 enquiries from one address", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await handleEnquiry(req(good()), env, deps())).status, 200);
  const res = await handleEnquiry(req(good()), env, deps());
  assert.equal(res.status, 429);
  assert.equal(sent.length, 5);
});

test("refuses other methods, oversized and unreadable bodies", async () => {
  assert.equal((await handleEnquiry(req(null, { method: "GET" }), env, deps())).status, 405);
  assert.equal((await handleEnquiry(req(null, { raw: JSON.stringify({ ...good(), message: "x".repeat(20_000) }) }), env, deps())).status, 400);
  assert.equal((await handleEnquiry(req(null, { raw: "{not json" }), env, deps())).status, 400);
});

test("enforces ALLOWED_ORIGIN when set", async () => {
  const e = { ...env, ALLOWED_ORIGIN: "https://example.co.uk" };
  assert.equal((await handleEnquiry(req(good(), { headers: { origin: "https://evil.test" } }), e, deps())).status, 403);
  assert.equal((await handleEnquiry(req(good(), { headers: { origin: "https://example.co.uk" } }), e, deps())).status, 200);
});

test("returns 503, not a fake success, when email is not configured", async () => {
  const res = await handleEnquiry(req(good()), {}, { now: () => NOW });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).ok, false);
});

test("returns 502 when the email provider fails", async () => {
  const res = await handleEnquiry(req(good()), env, { now: () => NOW, sendMail: async () => { throw new Error("down"); } });
  assert.equal(res.status, 502);
});

test("requires Turnstile when a secret is configured", async () => {
  const e = { ...env, TURNSTILE_SECRET: "s" };
  const fail = await handleEnquiry(req(good()), e, { ...deps(), verifyTurnstile: async () => false });
  assert.equal(fail.status, 400);
  const pass = await handleEnquiry(req({ ...good(), "cf-turnstile-response": "t" }), e, { ...deps(), verifyTurnstile: async () => true });
  assert.equal(pass.status, 200);
});

test("strips header-injection characters from single-line fields", () => {
  const { data } = validateEnquiry({ ...good(), name: "Ann\r\nBcc: x@y.z" });
  assert.equal(data.name.includes("\n"), false);
  const { subject } = formatEmail(data, { when: "now" });
  assert.equal(subject.includes("\n"), false);
});

test("accepts common UK phone formats", () => {
  for (const phone of ["07123456789", "07123 456 789", "+44 7123 456789", "+44 (0)7123 456789", "01322 123456", "020 7946 0000"]) {
    assert.equal(validateEnquiry({ ...good(), phone }).errors.phone, undefined, phone);
  }
});
