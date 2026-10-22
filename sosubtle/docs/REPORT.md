# So Subtle Aesthetics: project report

Prepared October 2026. Private preview: https://claude.ai/artifact/VJsBC45Z9thChjwQSKNZjw (only visible to the account owner until shared).

## Important limitation of this build

The build environment's network policy blocked direct access to **that-time.co.uk, shop.beacons.ai, instagram.com, tiktok.com, facebook.com, Companies House, Fresha and asa.org.uk**. Research was therefore done through web search results only. As a result:

- **No prices were extracted** from the booking system. The site sends visitors to the live booking page for prices (see section D).
- **No photographs or logo were copied** from Instagram. The gallery uses labelled placeholders and the logo is an interim wordmark.
- **No Beacons product details** (price, terms, entry requirements) could be read. Course contents come from Natasha's own TikTok profile text.

To finish these, either allow those hosts in the environment's network settings (environment menu > Edit > Network access) and re-run, or send the photos, logo and price list directly.

---

## A. Brand research summary

| Finding | Confidence | Source |
|---|---|---|
| Owner: **Natasha Shisgal** | High | TikTok profile name on @sosubtleaesthetics; Companies House officer record |
| **So Subtle Aesthetics Ltd**, company 08046899, Natasha director since April 2012, registered office in Keston, Kent | High | Companies House officer appointments; pappers.co.uk |
| **So Subtle Aesthetics Academy Ltd**, company 15416981 | High | Companies House company overview |
| Clinic location **Dartford, Kent**; directories give **Oakfield Lane, Dartford DA1 2SY** | Town high, street medium | TikTok location tags; Fresha, Wheree and Yell listings |
| Telephone **07737 508747** | Medium (three directories agree, none run by the business) | Fresha, Wheree, Yell |
| Treatments: lips, microneedling, microneedling with polynucleotides, polynucleotides (fine lines, dark circles) | High | TikTok @sosubtleaesthetics posts |
| "Facial Anti Ageing Specialist", Russian lip technique, "award-winning practitioner 2024" | Medium (page not confirmed as hers) | facebook.com/btlkent page titled "So Subtle Aesthetics", Dartford |
| Level Up Lips Masterclass: for experienced injectors; 3 live models + 1 demo; advanced needle techniques and placement; social media and lighting session; manual, gift bag and certificate; ongoing support; 1-2-1 training and refresher days; "DM LIPS" | High (her own words) | TikTok profile text; Beacons link in brief |
| TikTok: ~9.5k followers, links to beacons.ai/natashashisgal1 | High | TikTok search snippet |
| Natasha is also listed as director of **BTL Advanced Aesthetics** (nurse-led clinic and training academy, 7 years injecting) | Low: the page mixes another clinic's template | secure.insyncconsent.co.uk |
| Reviews: Wheree shows an AI-generated summary praising Natasha's explanations and calm clinic; Fresha shows "5.0" without a clear count | Not usable | Not genuine verbatim reviews, so none were reproduced |

Sources: [TikTok](https://www.tiktok.com/@sosubtleaesthetics), [Companies House officer record](https://find-and-update.company-information.service.gov.uk/officers/ADPAPKzu55q7cKo83nxrR0MdRUI/appointments), [Academy company](https://find-and-update.company-information.service.gov.uk/company/15416981), [Fresha listing](https://www.fresha.com/lvp/so-subtle-aesthetics-ltd-oakfield-lane-vvb4oY), [Wheree listing](https://so-subtle-aesthetics-ltd.wheree.com/), [Facebook candidate](https://www.facebook.com/btlkent/), [pappers.co.uk](https://www.pappers.co.uk/company/so-subtle-aesthetics-ltd-08046899).

**Not verified, so not used:** qualifications or professional registration (nurse, prescriber or otherwise), insurance, the award's name and organiser, any practitioner other than Natasha (a Fresha snippet mentions "Kerri"), opening hours (directories disagree), email address.

**Brand assessment.** Everything public points to a small, owner-led clinic whose identity is the name itself: subtle, natural-looking work, with lips as the signature and a growing teaching side. The right direction is **understated, editorial elegance**: confident typography and space rather than gold, glitter or stock faces. The Academy should feel like the same house, slightly more structured.

## B. Design direction

- **Colour.** A cool porcelain ground (#F7F3F2), soft veil and petal pinks (#EFE6E5, #E6CFD1) taken from natural lip tones, a deep berry accent (#7A3E51) for actions, and plum-ink text (#2B1F25). Deliberately no gold. Plum-ink bands mark the Academy and the footer. All text meets WCAG AA contrast (checked with axe).
- **Typography.** Bodoni Moda (high-contrast fashion serif, italic for emphasis words) for headings; Hanken Grotesk for body text and labels. Both self-hosted, so no visitor data goes to Google.
- **Motif.** A single fine-line Cupid's bow drawing, used in the hero, the divider rule, the favicon and the social card. It draws itself once on load (off for anyone who prefers reduced motion).
- **Layout.** Asymmetric two-column sections that read like a printed treatment menu; one column on phones. Book Now is in the header on every page and every size.
- **Photography approach (for Natasha's photos).** Natural daylight, real skin texture, no filters; close crops of hands, tools and the treatment room; Academy photos of training in progress. No AI faces, no stock "models". Before-and-after only with written consent, unedited, same lighting and angle, and never for prescription-only treatments (the build enforces this).
- **Logo.** I could not access the existing logo, so the header uses an interim "So Subtle / Aesthetics" wordmark. Replace with the real logo (SVG preferred).

## C. Working website

Pages: `index`, `about`, `treatments`, `academy`, `gallery`, `reviews`, `contact`, plus `privacy` and `404`. Static HTML generated from `content/*.json` by `scripts/build.mjs` (no framework, no runtime dependencies). Preview: link above. Local: `npm run dev`.

## D. Treatments catalogue

| Treatment | Category | Live build | Notes |
|---|---|---|---|
| Lip enhancement (dermal filler) | Lips | Shown | |
| Russian lip technique | Lips | Hidden until confirmed | Only source is the unconfirmed Facebook page |
| Microneedling | Skin | Shown | |
| Microneedling with polynucleotides | Skin | Shown | |
| Polynucleotides | Skin | Shown | Mentions normal post-injection bumps, as Natasha's own posts do |
| Skin boosters | Skin | Hidden until confirmed | Directory data only |
| Facial dermal filler | Face | Hidden until confirmed | Fresha category data only |
| Consultation for lines and wrinkles | Face | Hidden until confirmed | **Compliance-sensitive**: stands in for anti-wrinkle injections (prescription-only). No product name, price, offer or before-and-after; never on the home page |

**Prices:** none copied (booking page unreachable). Each item shows "Price shown at booking" and links to the booking page. **Recommendation:** keep it this way, so the booking system is the single source of truth and the website can never be out of date. If Natasha prefers prices on the site, type them into Pages CMS. Durations and deposits: not yet known. All booking links go to https://that-time.co.uk/SoSubtleAesthetics; per-treatment deep links can be added in the `bookingUrl` field if That Time provides them.

## E. Academy

The Academy page features the **Level Up Lips Masterclass** with its verified contents, audience (experienced injectors) and format (in-person, live models). **View masterclass & enrol** goes to the supplied Beacons product; no second payment system was built. 1-2-1 training and refresher days are listed "by enquiry". To confirm: price, dates and venue, entry requirements, certificate wording and any accreditation (no CPD or accreditation claim is made), refund and cancellation terms, and what students receive after enrolling. New courses are added by copying a block in `content/courses.json` (or in Pages CMS).

## F. Reviews and social links

| Destination | Status |
|---|---|
| Instagram https://www.instagram.com/sosubtleaesthetics | Linked (from the brief) |
| TikTok https://www.tiktok.com/@sosubtleaesthetics | Linked (owner name, location and Beacons link match) |
| Facebook https://www.facebook.com/btlkent/ | **Unresolved**: titled "So Subtle Aesthetics", Dartford, but not confirmed. Shown in preview, hidden on live site |
| Google Business Profile | **Unresolved**: not found in search. Buttons switch on when the review link and "write a review" link are added |
| Google Maps | Interim search link for "So Subtle Aesthetics Dartford DA1 2SY", tagged to confirm |

No testimonials or ratings were reproduced, because none could be verified verbatim. Placeholder cards show where they go. A rating only appears when entered with the date it was checked, so it is never presented as live data.

## G. Testing evidence

Automated, all passing on the final build:

- `npm test`: **11/11** server tests. Valid enquiry sends one email with reply-to; invalid fields rejected with field messages; honeypot and too-fast submissions silently dropped; rate limit after 5 per 10 minutes; wrong method, oversized and malformed bodies refused; origin check; returns an honest "not switched on" error when email is not configured; provider failure reported; Turnstile enforced when configured; line-break injection stripped; UK phone formats.
- `npm run test:e2e`: **685/685** browser checks with Chromium at phone (390px), tablet (820px) and desktop (1440px). Every page returns 200 with exactly one h1, a title and meta description of sensible length, og:image and valid JSON-LD. No horizontal scrolling, no console errors, brand fonts load, Book Now visible in the header at every size. Every internal link and anchor resolves. Every external link opens in a new tab with `noopener`. All booking links go to the verified That Time page and all enrol links to the verified Beacons product. axe-core WCAG 2.1 A/AA: zero violations. Mobile menu opens, closes with Escape and navigates. Gallery filter works. Contact form: empty submit flags fields; a valid submission posted to the real handler and produced exactly one email in the local outbox; a honeypot post was accepted silently and not emailed.
- Gallery image pipeline tested with a sample photo: WebP at 640/1280px plus JPEG fallback, lazy-loaded, with `srcset`. A before-and-after without consent and one for a prescription-only treatment were both correctly excluded.
- Production build checked: no "to confirm" tags, no Facebook link, unconfirmed treatments removed, indexing blocked until a site address is set.

Issues found and fixed during testing: footer social icons stacked vertically; low-contrast italic accents and small print on dark bands; price label wrapping too narrowly; phone link not distinguishable without colour (axe); 404 description too short; production output path bug; social card fonts not loading; a consultation description that indirectly referred to prescription treatment.

**Not tested (cannot be from here):** that the external pages (That Time, Beacons, Instagram, TikTok, Facebook) load. Their hosts are blocked from this environment, so the links were checked for exact URLs only. Real email delivery was **not** tested: there is no approved destination address or email account yet, and no live enquiry was sent.

## H. Maintenance and running costs

**Updating:** Pages CMS (free) gives Natasha simple forms for treatments, prices, courses, photos, reviews and business details; each save rebuilds the site. Full steps are in the README. One caveat: check on first use that saving Business details keeps the fields not shown on the form.

| Item | Cost |
|---|---|
| Hosting (Cloudflare Pages, including the enquiry function) | £0 |
| Enquiry email delivery (Resend free tier, 3,000/month) | £0 |
| Content editing (Pages CMS) and private repository (GitHub) | £0 |
| Spam check (Cloudflare Turnstile, optional) | £0 |
| Domain name (e.g. a .co.uk) | about £10 to £15 a year |
| **Total** | **about £10 to £15 a year** |

The ICO data protection fee (currently £52 a year for most small businesses) applies to the business regardless of the website, and is probably already paid. No subscriptions, plugins or paid integrations are needed.

## I. Publication readiness: decisions and approvals needed

1. **Approve publication**, hosting (Cloudflare Pages) and a **domain name** (purchase needs Natasha's approval).
2. **Business email address** for enquiries, then a Resend account and domain verification. After that, send one real test enquiry.
3. **Confirm the public details**: phone number, whether the Oakfield Lane address should be public, opening hours, and service areas.
4. **Facebook page**: is facebook.com/btlkent hers?
5. **Google Business Profile**: share the profile's review link and "Ask for reviews" link.
6. **Logo** (SVG or high-resolution PNG), **portrait** and **gallery photos**, with written client consent for any identifiable or before-and-after images.
7. **Prices**: confirm "price shown at booking" is acceptable, or supply a price list; confirm the deposit policy.
8. **Treatments to confirm**: Russian lip technique, skin boosters, facial dermal filler, and the lines and wrinkles consultation.
9. **Academy details**: price, dates, venue, entry requirements, certificate wording and any accreditation, refund terms, and what happens after enrolling.
10. **Natasha's qualifications, registration and insurance**, plus the 2024 award's title and organiser, if she wants them shown.
11. **Genuine testimonials** she has permission to reproduce.
12. **Copy approval**: the "Three things you can expect" promises and the FAQ answers describe how the clinic works and must be accurate.
13. **Professional review** of the compliance notes below and of the draft privacy notice.

### Compliance notes for professional review

- **Prescription-only medicines (botulinum toxin).** Under the Human Medicines Regulations 2012 and CAP Code rule 12.12, POMs must not be advertised to the public. The ASA has upheld complaints about homepage mentions and indirect promotion (Dermaskin, HB Health, Therapie Clinic). The site therefore promotes only a consultation, never names a product, shows no price or offer, and keeps this item off the home page and out of the live build until confirmed. **Needs review:** whether the phrase "lines and wrinkles" is acceptable in this context; the ASA's current Botox dos-and-don'ts page could not be read from here.
- **Under-18s.** Botulinum toxin and filler procedures for under-18s are banned in England (Botulinum Toxin and Cosmetic Fillers (Children) Act 2021), and CAP rules prohibit targeting cosmetic-intervention ads at under-18s. The site states 18+ throughout, and the imagery direction avoids youthful styling.
- **Claims.** No results, safety, duration-of-results or "best/leading" claims are made. "Results vary from person to person" appears in the footer.
- **Before-and-after.** Genuine, unedited and consented images only; never for POMs. Both rules are enforced by the build.
- **Testimonials and awards** must be genuine and documented (CAP 3.45 and 3.7). None are shown until supplied.
- **Training.** No accreditation, CPD or qualification claim is made for the Academy until confirmed.
- **Upcoming licensing.** The government plans a licensing scheme for non-surgical cosmetic procedures in England, with restrictions on who can perform higher-risk procedures. Check the current position before launch and display any licence once required.
- **Data protection.** The form collects no medical information and says so. The privacy notice is a draft and needs review.
