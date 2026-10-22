// Cloudflare Pages Function: POST /api/enquiry
// Settings (Cloudflare dashboard > Pages project > Settings > Variables and secrets):
//   ENQUIRY_TO_EMAIL    Natasha's approved business inbox (required)
//   ENQUIRY_FROM_EMAIL  sender on a domain verified with Resend, e.g. "So Subtle Website <enquiries@your-domain>" (required)
//   RESEND_API_KEY      secret from resend.com (required)
//   ALLOWED_ORIGIN      the live site address, e.g. https://www.example.co.uk (recommended)
//   TURNSTILE_SECRET    Cloudflare Turnstile secret key (optional, adds a spam check)
// Bindings: ENQUIRY_RL  a KV namespace for rate limiting (recommended)

import { handleEnquiry } from "../_lib/enquiry.js";

// Non-POST requests get a 405 from handleEnquiry.
export const onRequest = ({ request, env }) => handleEnquiry(request, env);
