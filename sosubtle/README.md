# So Subtle Aesthetics website

Seven-page website for So Subtle Aesthetics and the So Subtle Academy: Home, About Natasha, Treatments & Prices, Academy, Gallery, Reviews, and Contact & Consultations (plus a privacy notice and a 404 page).

**Status: private preview. Not published.** See [docs/REPORT.md](docs/REPORT.md) for the research, design direction, test results and what still needs Natasha's confirmation before launch.

## How it works

- All words, prices, courses, reviews and photos live in `content/*.json`. The pages are generated from them, so nothing is typed twice.
- `node scripts/build.mjs` turns the content into plain HTML in `dist/`. No framework and no runtime dependencies.
- The enquiry form posts to a small server function (`functions/api/enquiry.js`) that checks the details, blocks spam and emails Natasha.
- Two build modes:
  - **Preview** (`npm run build`): shows yellow "to confirm" tags on anything not yet verified, and tells search engines not to index it.
  - **Live** (`npm run build:prod`): leaves out everything marked `"confirmed": false` and prints a list of what it left out.

## Updating the site (for Natasha)

Use **Pages CMS** (free): go to [app.pagescms.org](https://app.pagescms.org), sign in with GitHub, open this repository. You get simple forms for:

| To change | Open |
|---|---|
| Treatment names, descriptions, prices, appointment lengths | Treatments & prices |
| Add or remove a treatment | Treatments & prices, then add/remove a row |
| Academy courses, prices, enrol links | Academy courses |
| Gallery photos | Gallery (upload, add a description, tick consent boxes) |
| Reviews | Testimonials |
| Phone, address, hours, social links, Google review links | Business details |

Each save updates the live site within a minute or two.

Rules built into the site so mistakes cannot slip through:

- A treatment ticked **Prescription-only medicine** never shows a price, product name or offer, only "Discussed at consultation".
- A before-and-after photo is left out unless both **consent** and **unedited** are ticked, and is always left out for prescription-only treatments.
- Leaving a price blank shows "Price shown at booking" and links to the booking page. This is the recommended setting: the booking page stays the single price list, so the website can never show an out-of-date price.

## Running it on a computer (for a developer)

```bash
npm install          # optional: installs sharp for photo resizing, axe-core for tests
npm run dev          # builds and serves http://localhost:8080 ; enquiries are saved to .outbox/, not emailed
npm test             # server-side enquiry tests
npm run test:e2e     # browser tests: all pages, 3 screen sizes, links, accessibility, form
npm run build:prod   # live build into dist/
node scripts/make-og.mjs   # regenerate the social sharing image
```

## Going live (needs Natasha's approval first)

Recommended hosting: **Cloudflare Pages** (free) connected to a private GitHub repository containing this folder.

1. Create a private repository and copy this folder's contents to its root.
2. Cloudflare dashboard > Workers & Pages > Create > Pages > connect the repository.
   Build command `npm run build:prod`, output directory `dist`.
3. Settings > Variables and secrets:
   - `ENQUIRY_TO_EMAIL` Natasha's approved business inbox
   - `ENQUIRY_FROM_EMAIL` e.g. `So Subtle Website <enquiries@your-domain>`
   - `RESEND_API_KEY` from [resend.com](https://resend.com) (free tier: 3,000 emails a month) after verifying the domain there
   - `ALLOWED_ORIGIN` the live address, e.g. `https://www.your-domain`
   - optional `TURNSTILE_SECRET` (and put the site key in `content/site.json` > `enquiry.turnstileSiteKey`)
4. Bindings: add a KV namespace called `ENQUIRY_RL` for rate limiting.
5. Put the live address in `content/site.json` > `siteUrl`. This switches on canonical links, the sitemap and search-engine indexing.
6. Send one real test enquiry and confirm it arrives before announcing the site.

Until step 3 is done the form answers "Online enquiries are not switched on yet" rather than pretending to send.
