#!/usr/bin/env node
// Builds the So Subtle Aesthetics site from content/*.json into static HTML.
//
//   node scripts/build.mjs                 preview build -> dist/ (shows 'to confirm' tags, noindex)
//   node scripts/build.mjs --production    live build    -> dist/ (unconfirmed items left out)
//   node scripts/build.mjs --artifact      preview build shaped for the claude.ai private preview
//
// No dependencies are required. If 'sharp' is installed, gallery photos are
// resized to WebP/JPEG; otherwise they are copied as they are.

import { readFile, writeFile, mkdir, cp, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const PROD = args.has("--production");
const ARTIFACT = args.has("--artifact");
const PREVIEW = !PROD;
const OUT = path.resolve(ROOT, args.has("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "dist");

const load = async (f) => JSON.parse(await readFile(path.join(ROOT, "content", f), "utf8"));
const site = await load("site.json");
const menu = await load("treatments.json");
const academy = await load("courses.json");
const { testimonials } = await load("testimonials.json");
const { images } = await load("gallery.json");

const excluded = [];
const shown = (item, label) => {
  if (item && item.confirmed === false && PROD) { excluded.push(label); return false; }
  return Boolean(item);
};

// ---------- helpers ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pending = (label = "To confirm") => (PREVIEW ? ` <span class="pending" title="Shown in the preview only">${esc(label)}</span>` : "");
const pendingIf = (item, label) => (item && item.confirmed === false ? pending(label) : "");
const pendingBlock = (title, body) => (PREVIEW ? `<div class="pending-block" role="note"><strong>${esc(title)}</strong><span>${body}</span></div>` : "");
const ext = (url, label, cls = "btn btn-primary") => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}<span class="arrow" aria-hidden="true">→</span><span class="visually-hidden"> (opens in a new tab)</span></a>`;
const bookBtn = (label = "Book now", cls = "btn btn-primary") => ext(site.bookingUrl, label, cls);

const ICONS = {
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.25-3.05a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.1 23.69v-7.98H6.63v-3.67H9.1v-1.58c0-4.09 1.85-5.98 5.86-5.98.4 0 .95.04 1.47.1.51.06.92.13 1.14.2v3.32a8.6 8.6 0 0 0-.65-.03c-.24-.01-.49-.01-.73-.01-.71 0-1.26.1-1.68.31-.29.15-.52.36-.68.62-.26.42-.37 1-.37 1.75v1.3h3.92l-.39 2.1-.29 1.57h-3.24v8.24C19.4 23.24 24 18.18 24 12.04 24 5.42 18.63.04 12 .04S0 5.42 0 12.04c0 5.63 3.87 10.35 9.1 11.65Z"/></svg>`,
};
const socials = site.social.filter((s) => shown(s, `Social link: ${s.label}`));
const socialList = (cls = "") => `<ul class="social ${cls}">${socials.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener me" aria-label="${esc(`${s.label} ${s.handle} (opens in a new tab)`)}" title="${esc(s.label)}${s.confirmed === false && PREVIEW ? " (to confirm)" : ""}">${ICONS[s.platform] || ""}</a></li>`).join("")}</ul>`;
const instagram = site.social.find((s) => s.platform === "instagram");

const bow = (cls = "bow-rule") => `<svg class="${cls}" viewBox="0 0 120 18" aria-hidden="true" focusable="false"><path d="M2 12C30 12 44 3 54 3c3 0 5 3 6 5 1-2 3-5 6-5 10 0 24 9 52 9"/></svg>`;

const phoneOk = shown(site.phone, "Telephone number");
const addressOk = shown(site.address, "Street address");
const addr = site.address;
const areaLine = `${addr.locality}, ${addr.region}`;
const fullAddress = addressOk ? `${addr.street}, ${addr.locality}, ${addr.region} ${addr.postcode}` : areaLine;

// ---------- treatments & courses ----------
const categories = menu.categories.map((c) => ({ ...c, treatments: c.treatments.filter((t) => shown(t, `Treatment: ${t.name}`)) })).filter((c) => c.treatments.length);
const courses = academy.courses.filter((c) => shown(c, `Course: ${c.title}`));
const featured = courses.find((c) => c.featured) || courses[0];
const interests = [
  ...categories.flatMap((c) => c.treatments.map((t) => ({ id: t.id, label: t.name, group: "Treatments" }))),
  { id: "consultation", label: "General consultation", group: "Treatments" },
  ...courses.map((c) => ({ id: c.id, label: c.title, group: "Academy" })),
  { id: "other", label: "Something else", group: "Other" },
];
const allInterestLabels = [
  ...menu.categories.flatMap((c) => c.treatments.map((t) => t.name)),
  "General consultation", ...academy.courses.map((c) => c.title), "Something else",
];

const priceCell = (t) => {
  if (t.prescriptionOnly) return `<span class="live">Discussed at consultation</span>`;
  if (t.price) return esc(t.price);
  return `<span class="live">Price shown at booking</span>${pending("Price not copied yet")}`;
};

// ---------- gallery ----------
const galleryOk = images.filter((im) => {
  if (!im.file || !im.alt) { excluded.push(`Gallery image missing file or alt text: ${im.file || "(no file)"}`); return false; }
  if (im.category === "results") {
    const t = menu.categories.flatMap((c) => c.treatments).find((x) => x.id === im.treatment);
    if (!im.consent || !im.unedited) { excluded.push(`Before/after without consent or 'unedited' flag: ${im.file}`); return false; }
    if (t?.prescriptionOnly) { excluded.push(`Before/after of a prescription-only treatment (not allowed): ${im.file}`); return false; }
  }
  if (im.identifiable && !im.consent) { excluded.push(`Identifiable client photo without consent: ${im.file}`); return false; }
  return true;
});
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* optional */ }

async function processGallery() {
  const outDir = path.join(OUT, "assets", "gallery");
  await mkdir(outDir, { recursive: true });
  for (const im of galleryOk) {
    const src = path.join(ROOT, "content", im.file);
    if (!existsSync(src)) { excluded.push(`Gallery file not found: ${im.file}`); im._missing = true; continue; }
    const base = path.basename(im.file).replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    if (sharp) {
      const meta = await sharp(src).metadata();
      im._ratio = meta.width && meta.height ? `${meta.width} / ${meta.height}` : "4 / 5";
      im._w = meta.width; im._h = meta.height;
      for (const w of [640, 1280]) {
        await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(outDir, `${base}-${w}.webp`));
      }
      await sharp(src).rotate().resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${base}-1280.jpg`));
      im._srcset = `assets/gallery/${base}-640.webp 640w, assets/gallery/${base}-1280.webp 1280w`;
      im._fallback = `assets/gallery/${base}-1280.jpg`;
    } else {
      const name = path.basename(im.file);
      await cp(src, path.join(outDir, name));
      im._fallback = `assets/gallery/${name}`;
    }
  }
}

const galleryFigure = (im) => `<figure data-cat="${esc(im.category)}">
  <button class="zoom" type="button" data-full="${esc(im._fallback)}" data-alt="${esc(im.alt)}" data-caption="${esc(im.caption || "")}" aria-label="View larger: ${esc(im.alt)}">
    <picture>${im._srcset ? `<source type="image/webp" srcset="${im._srcset}" sizes="(max-width: 720px) 50vw, 33vw">` : ""}<img src="${esc(im._fallback)}" alt="${esc(im.alt)}" loading="lazy" decoding="async"${im._w ? ` width="${im._w}" height="${im._h}"` : ""}></picture>
  </button>
  ${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}
</figure>`;
const SLOT_LABELS = { treatments: "Treatment room photo", clinic: "Clinic photo", brand: "Brand photo", academy: "Academy training photo", results: "Approved result photo (with consent)" };
const gallerySlots = (cats) => cats.map((c) => `<figure data-cat="${c}"><div class="slot"><span>${SLOT_LABELS[c]}<br><span class="pending">Awaiting photo</span></span></div></figure>`).join("");

// ---------- layout ----------
const NAV = [
  ["index.html", "Home"], ["about.html", "About Natasha"], ["treatments.html", "Treatments & Prices"],
  ["academy.html", "Academy", "nav-academy"], ["gallery.html", "Gallery"], ["reviews.html", "Reviews"], ["contact.html", "Contact"],
];
const navItems = (current) => NAV.map(([href, label, cls]) => `<li${cls ? ` class="${cls}"` : ""}><a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");

const logo = (extra = "") => `<a class="logo ${extra}" href="index.html" aria-label="So Subtle Aesthetics, home"><span class="logo-mark">So Subtle</span><span class="logo-sub">Aesthetics</span></a>`;

function jsonLd(page) {
  const business = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: site.name,
    legalName: site.company.legalName,
    founder: { "@type": "Person", name: site.owner },
    ...(site.siteUrl ? { url: site.siteUrl, image: `${site.siteUrl}/assets/img/og.png` } : {}),
    ...(phoneOk ? { telephone: site.phone.e164 } : {}),
    address: { "@type": "PostalAddress", ...(addressOk ? { streetAddress: addr.street, postalCode: addr.postcode } : {}), addressLocality: addr.locality, addressRegion: addr.region, addressCountry: addr.country },
    areaServed: shown({ confirmed: site.serviceAreaConfirmed }, "Service area list") ? site.serviceArea : addr.locality,
    sameAs: socials.map((s) => s.url),
    potentialAction: { "@type": "ReserveAction", target: site.bookingUrl, name: "Book an appointment" },
  };
  const blocks = [business];
  if (page === "academy" && featured) {
    blocks.push({
      "@context": "https://schema.org", "@type": "Course", name: featured.title, description: featured.summary,
      provider: { "@type": "Organization", name: site.company.academyLegalName },
      ...(featured.enrolUrl ? { url: featured.enrolUrl } : {}),
    });
  }
  return blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, "\\u003c")}</script>`).join("\n");
}

function layout({ file, title, description, body, page }) {
  const canonical = site.siteUrl ? `${site.siteUrl}/${file === "index.html" ? "" : file}` : "";
  const ogImage = site.siteUrl ? `${site.siteUrl}/assets/img/og.png` : "assets/img/og.png";
  const head = `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${PREVIEW ? '<meta name="robots" content="noindex, nofollow">' : ""}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta name="theme-color" content="#f7f3f2">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/bodoni-moda-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/hanken-grotesk-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/site.css">
${jsonLd(page)}`;

  const previewBar = PREVIEW ? `<div class="preview-bar" role="note"><strong>Private preview.</strong> Not published. Tags marked “to confirm” show details that still need Natasha’s confirmation and are left out of the live site.</div>` : "";

  const content = `${previewBar}
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    ${logo()}
    <nav class="site-nav" aria-label="Main"><ul class="nav-list">${navItems(file)}</ul></nav>
    <div class="header-actions">
      ${bookBtn("Book now")}
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
</header>
<div class="mobile-nav" id="mobile-nav" hidden role="dialog" aria-modal="true" aria-label="Menu">
  <div class="mobile-nav-top">${logo()}<button class="menu-toggle menu-close" type="button" aria-label="Close menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></button></div>
  <nav aria-label="Mobile"><ul>${navItems(file)}</ul></nav>
  <div class="stack">${bookBtn("Book a treatment")}<a class="btn btn-ghost" href="contact.html#enquire">Make an enquiry</a></div>
</div>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="stack">
        ${logo()}
        <p>Lip and skin treatments in ${esc(areaLine)}, and training for practitioners through the So Subtle Academy.</p>
        ${socialList()}
      </div>
      <div><h2>Visit</h2><ul>
        <li>${esc(fullAddress)}${pendingIf(site.address, "Address to confirm")}</li>
        <li>${esc(site.hours)}</li>
        ${phoneOk ? `<li><a href="tel:${esc(site.phone.e164)}">${esc(site.phone.display)}</a>${pendingIf(site.phone, "Number to confirm")}</li>` : ""}
      </ul></div>
      <div><h2>Explore</h2><ul>${NAV.slice(1).map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
      <div><h2>Book</h2><ul>
        <li><a href="${esc(site.bookingUrl)}" target="_blank" rel="noopener">Book a treatment</a></li>
        ${featured?.enrolUrl ? `<li><a href="${esc(featured.enrolUrl)}" target="_blank" rel="noopener">Enrol on the masterclass</a></li>` : ""}
        <li><a href="contact.html#enquire">Make an enquiry</a></li>
        <li><a href="privacy.html">Privacy notice</a></li>
      </ul></div>
    </div>
    <div class="footer-base">
      <p>© ${new Date().getFullYear()} ${esc(site.company.legalName)}. Registered in England and Wales, company no. ${esc(site.company.number)}.</p>
      <p>Treatments are for clients aged 18 and over. Results vary from person to person.</p>
    </div>
  </div>
</footer>
<script type="module" src="assets/js/site.js"></script>`;

  if (ARTIFACT && file === "index.html") {
    // The private preview names the artifact after the business rather than the SEO title
    return `${head.replace(`<title>${esc(title)}</title>`, `<meta name="claude:viewport-fit-sides" content="cover">\n<title>${esc(site.name)}</title>`)}\n${content}\n`;
  }
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${content}
</body>
</html>
`;
}

// ---------- shared blocks ----------
const pageHero = (eyebrow, h1, lede, extra = "") => `<section class="page-hero"><div class="wrap"><div class="stack">
  <p class="eyebrow">${eyebrow}</p><h1>${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}${extra}
</div></div></section>`;

const ctaBand = (h2, p) => `<section class="section band-veil" data-reveal><div class="wrap cta-band">
  <div class="stack">${bow()}<h2>${h2}</h2><p class="muted">${p}</p></div>
  <div class="btn-row">${bookBtn()}<a class="btn btn-ghost" href="contact.html#enquire">Ask a question</a></div>
</div></section>`;

const quoteCards = (list) => list.map((t) => `<figure class="quote"><blockquote><p>“${esc(t.quote)}”</p></blockquote><figcaption>${esc(t.author)}${t.treatment ? ` · ${esc(t.treatment)}` : ""}${t.source ? ` · ${esc(t.source)}` : ""}</figcaption></figure>`).join("");
const quotePlaceholders = (n) => PREVIEW ? Array.from({ length: n }, () => `<figure class="quote placeholder"><blockquote><p>A genuine client review goes here, word for word, once the client has agreed to it being shared.</p></blockquote><figcaption><span class="pending">Awaiting approved review</span></figcaption></figure>`).join("") : "";

const googleRating = () => {
  const g = site.google;
  if (!g.rating || !g.reviewCount || !g.ratingCheckedOn || (PROD && g.confirmed === false)) return "";
  return `<p class="muted small">Rated ${esc(g.rating)} out of 5 from ${esc(g.reviewCount)} Google reviews, as checked on ${esc(g.ratingCheckedOn)}.</p>`;
};
const googleButtons = () => {
  const g = site.google;
  const btns = [];
  if (g.reviewsUrl && shown(g, "Google review links")) btns.push(ext(g.reviewsUrl, "Read our Google reviews"));
  if (g.writeReviewUrl && shown(g, "Google review links")) btns.push(ext(g.writeReviewUrl, "Leave a Google review", "btn btn-ghost"));
  return btns.join("");
};

// ---------- pages ----------
const homeQuotes = testimonials.filter((t) => t.showOnHome).slice(0, 3);
const homeImages = galleryOk.filter((im) => im.showOnHome && im.category !== "results").slice(0, 3);

const pages = {};

pages["index.html"] = () => layout({
  file: "index.html", page: "home",
  title: "So Subtle Aesthetics | Lip & Skin Treatments in Dartford, Kent",
  description: "Natasha Shisgal's aesthetics clinic in Dartford, Kent. Consultation-led lip and skin treatments, plus the So Subtle Academy for practitioners. Book online.",
  body: `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">
    <p class="eyebrow">Aesthetics clinic · ${esc(areaLine)}</p>
    <h1>Subtle by name. <em>Subtle</em> by nature.</h1>
    <p class="lede">So Subtle Aesthetics is Natasha Shisgal’s clinic for lip and skin treatments planned around your own features. Every appointment starts with an honest conversation about what suits you.</p>
    <div class="btn-row">${bookBtn()}<a class="btn btn-ghost" href="treatments.html">Treatments &amp; prices</a></div>
    <p class="hero-meta"><span>Consultation-led</span><span>Clients aged 18 and over</span><span>Training for practitioners</span></p>
  </div>
  <figure class="hero-art" aria-hidden="true">
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
      <path class="bow draw" d="M60 250C105 236 140 206 170 204c14-1 24 10 30 18 6-8 16-19 30-18 30 2 65 32 110 46"/>
      <path class="bow draw" d="M60 250c60 12 100 6 140 10 40-4 80 2 140-10"/>
      <path class="bow draw" d="M60 250c50 50 100 62 140 62s90-12 140-62"/>
    </svg>
    <figcaption>Lips · Skin · Academy</figcaption>
  </figure>
</div></section>

<section class="section band-veil" data-reveal><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">Meet Natasha</p>
    <h2>A clinic built on <em>conversation</em></h2>
  </div>
  <div class="stack">
    <p class="lede">So Subtle Aesthetics is led by Natasha Shisgal in ${esc(addr.locality)}. Her work centres on lips and on skin treatments such as microneedling and polynucleotides.</p>
    <p class="muted">Natasha also trains other practitioners through the So Subtle Academy, so the techniques she teaches come straight from her own treatment room.</p>
    <p><a class="text-link" href="about.html">More about Natasha →</a></p>
  </div>
</div></section>

<section class="section" data-reveal><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">Treatments</p>
    <h2>Start with what <em>matters</em> to you</h2>
    <p class="muted">Live prices and appointment times are always on the booking page.</p>
    <div class="btn-row">${bookBtn("See prices & book", "btn btn-ghost")}</div>
  </div>
  <ul class="cat-list">
    ${categories.map((c) => `<li><a href="treatments.html#${c.id}"><h3>${esc(c.name)}</h3><p>${esc(c.treatments.map((t) => t.name).join(" · "))}</p><span class="go">View</span></a></li>`).join("")}
  </ul>
</div></section>

<section class="section band-veil" data-reveal><div class="wrap stack-lg">
  <div class="stack"><p class="eyebrow">How Natasha works</p><h2>Three things you can <em>expect</em></h2></div>
  <div class="principles">
    <div><h3>A consultation first</h3><p class="muted">You talk through what you would like, your medical history and your options before any treatment goes ahead.</p></div>
    <div><h3>Your features, in proportion</h3><p class="muted">Plans are built around the face you already have. If a treatment is not right for you, Natasha will say so.</p></div>
    <div><h3>Time to decide</h3><p class="muted">There is no pressure to book on the day. Go away, think it over and come back when you are ready.</p></div>
  </div>
  ${pendingBlock("Copy for Natasha's approval", "These three promises describe how the clinic works. Please check each one is accurate before the site goes live.")}
</div></section>

${featured ? `<section class="section band-ink" data-reveal><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">So Subtle Academy</p>
    <h2>${esc(featured.title.replace(/ Masterclass$/, ""))} <em>Masterclass</em></h2>
    <p class="muted">${esc(featured.summary)}</p>
    <div class="btn-row"><a class="btn btn-primary" href="academy.html">Explore the Academy<span class="arrow" aria-hidden="true">→</span></a>${featured.enrolUrl ? ext(featured.enrolUrl, "Enrol", "btn btn-ghost") : ""}</div>
  </div>
  <ul class="includes" aria-label="Included in the masterclass">${featured.includes.slice(0, 6).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
</div></section>` : ""}

<section class="section" data-reveal><div class="wrap stack-lg">
  <div class="cta-band"><div class="stack"><p class="eyebrow">Gallery</p><h2>Recent <em>work</em></h2></div><a class="text-link" href="gallery.html">View the gallery →</a></div>
  ${homeImages.length ? `<div class="gallery-grid" data-gallery>${homeImages.map(galleryFigure).join("")}</div>` : PREVIEW ? `<div class="gallery-grid">${gallerySlots(["treatments", "clinic", "academy"])}</div>` : `<p class="muted">See Natasha’s latest work on <a href="${esc(instagram.url)}" target="_blank" rel="noopener">Instagram ${esc(instagram.handle)}</a>.</p>`}
</div></section>

${homeQuotes.length || PREVIEW || site.google.reviewsUrl ? `<section class="section band-veil" data-reveal><div class="wrap stack-lg">
  <div class="cta-band"><div class="stack"><p class="eyebrow">Reviews</p><h2>In clients’ <em>own words</em></h2>${googleRating()}</div><a class="text-link" href="reviews.html">All reviews →</a></div>
  <div class="quotes">${homeQuotes.length ? quoteCards(homeQuotes) : quotePlaceholders(3)}</div>
</div></section>` : ""}

<section class="section" data-reveal><div class="wrap split">
  <div class="stack">
    <p class="eyebrow">Visit</p>
    <h2>Find <em>us</em></h2>
    <ul class="contact-list">
      <li><span class="k">Location</span><span class="v">${esc(fullAddress)}${pendingIf(site.address, "Address to confirm")}</span></li>
      <li><span class="k">Opening</span><span class="v">${esc(site.hours)}</span></li>
      ${phoneOk ? `<li><span class="k">Telephone</span><span class="v"><a href="tel:${esc(site.phone.e164)}">${esc(site.phone.display)}</a>${pendingIf(site.phone, "Number to confirm")}</span></li>` : ""}
    </ul>
  </div>
  <div class="stack">
    <p class="lede">Follow along for recent work and Academy news.</p>
    ${socialList("social-light")}
    <p><a class="text-link" href="${esc(instagram.url)}" target="_blank" rel="noopener">${esc(instagram.handle)} on Instagram →</a></p>
    <div class="btn-row">${bookBtn()}<a class="btn btn-ghost" href="contact.html">Contact &amp; consultations</a></div>
  </div>
</div></section>`,
});

pages["about.html"] = () => layout({
  file: "about.html", page: "about",
  title: "About Natasha Shisgal | So Subtle Aesthetics, Dartford",
  description: "Meet Natasha Shisgal, founder of So Subtle Aesthetics in Dartford and the So Subtle Academy for aesthetics practitioners.",
  body: `
${pageHero("About Natasha", "Natasha <em>Shisgal</em>", `Founder of So Subtle Aesthetics and the So Subtle Academy, based in ${esc(areaLine)}.`)}
<section class="section"><div class="wrap split">
  ${site.portrait?.file ? `<img src="${esc(site.portrait.file)}" alt="${esc(site.portrait.alt || "Natasha Shisgal")}" width="960" height="1200" loading="eager">` : PREVIEW ? `<div class="slot"><span>Portrait of Natasha<br><span class="pending">Awaiting photo</span></span></div>` : `<figure class="hero-art" aria-hidden="true"><svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"><path class="bow" d="M60 250C105 236 140 206 170 204c14-1 24 10 30 18 6-8 16-19 30-18 30 2 65 32 110 46"/><path class="bow" d="M60 250c60 12 100 6 140 10 40-4 80 2 140-10"/><path class="bow" d="M60 250c50 50 100 62 140 62s90-12 140-62"/></svg></figure>`}
  <div class="stack-lg">
    <div class="stack">
      <p class="lede">Natasha leads So Subtle Aesthetics, a lip and skin clinic in ${esc(addr.locality)}. Her work centres on lips, microneedling and polynucleotide skin treatments, and on keeping every result in proportion with the face it belongs to.</p>
      <p>She also teaches. Through the So Subtle Academy she runs the Level Up Lips Masterclass and one-to-one training days for practitioners who already inject and want to refine their lip work.</p>
      <p>The clinic’s name sums up the approach: treatments should suit you, and nobody should be able to tell exactly what you have had done.</p>
    </div>
    ${pendingBlock("Qualifications, registration and insurance", "Add Natasha’s professional background, training, any professional registration and insurance details here. Nothing is shown about qualifications until Natasha supplies them.")}
    ${site.award.text && shown(site.award, "Award") ? `<p class="eyebrow">${esc(site.award.text)}</p>` : pendingBlock("Award", "Her Facebook page mentions a 2024 practitioner award. Add the award’s exact title and organiser to show it.")}
    <dl class="facts">
      <div><dt>Director</dt><dd>${esc(site.company.legalName)}, since 2012</dd></div>
      <div><dt>Clinic</dt><dd>${esc(areaLine)}</dd></div>
      <div><dt>Teaching</dt><dd>So Subtle Academy</dd></div>
      <div><dt>Focus</dt><dd>Lips and skin</dd></div>
    </dl>
    <p class="small muted">Company details from the Companies House register.</p>
  </div>
</div></section>
${ctaBand("Book a consultation with <em>Natasha</em>", "Talk through what you would like and what is realistic for you, with no pressure to go ahead.")}`,
});

pages["treatments.html"] = () => layout({
  file: "treatments.html", page: "treatments",
  title: "Treatments & Prices | So Subtle Aesthetics, Dartford",
  description: "Lip enhancement, microneedling, polynucleotides and consultation-led facial treatments in Dartford, Kent. See current prices and book online.",
  body: `
${pageHero("Treatments &amp; prices", "The treatment <em>menu</em>", "Every treatment begins with a consultation. Prices, appointment lengths and availability are kept up to date on our booking page, so you always see the current price before you pay.", `<div class="btn-row">${bookBtn("See live prices & book")}</div>`)}
<section class="section section-tight"><div class="wrap stack-lg">
  <div class="cta-band is-centred">
    <nav class="menu-nav" aria-label="Treatment categories">${categories.map((c) => `<a class="chip-link" href="#${c.id}">${esc(c.name)}</a>`).join("")}</nav>
    <div class="notice"><p><strong>Clients must be 18 or over.</strong> ${menu.depositPolicy && shown({ confirmed: menu.depositPolicyConfirmed }, "Deposit policy") ? esc(menu.depositPolicy) : `Deposit and cancellation terms are shown when you book.${pending("Deposit policy to confirm")}`}</p></div>
  </div>
  <div>
  ${categories.map((c) => `<section class="menu-category" id="${c.id}" aria-labelledby="${c.id}-h">
    <header><p class="eyebrow">${esc(c.name)}</p><h2 id="${c.id}-h">${esc(c.name)}</h2><p class="muted">${esc(c.intro)}</p></header>
    <ul class="menu-items">
      ${c.treatments.map((t) => `<li class="menu-item${t.prescriptionOnly ? " is-consult" : ""}" id="${t.id}">
        <h3>${esc(t.name)}${pendingIf(t, "Treatment to confirm")}</h3>
        <div class="price">${priceCell(t)}</div>
        <p class="desc">${esc(t.summary)}</p>
        <p class="meta">${t.consultation ? `<span>${esc(t.consultation)}</span>` : ""}${t.duration ? `<span>${esc(t.duration)}</span>` : ""}</p>
        <div class="act">${t.prescriptionOnly ? `<a href="contact.html?interest=${t.id}#enquire">Ask about a consultation</a>` : `<a href="${esc(t.bookingUrl || site.bookingUrl)}" target="_blank" rel="noopener">Book<span class="visually-hidden"> ${esc(t.name)} (opens in a new tab)</span></a>`}</div>
      </li>`).join("")}
    </ul>
  </section>`).join("")}
  </div>
  ${pendingBlock("Prices", "The booking page could not be read from this build environment, so no prices have been copied. Either type prices into content/treatments.json, or keep the booking page as the single price list (recommended, so the two never disagree).")}
</div></section>

<section class="section band-veil" data-reveal><div class="wrap split">
  <div class="stack"><p class="eyebrow">Questions</p><h2>Before you <em>book</em></h2></div>
  <div class="faq">
    <details><summary>What happens at a consultation?</summary><div><p>You talk through what you would like to change, your medical history and any medication, and the options that could suit you, including their risks and alternatives. Nothing is done until you are happy to go ahead.</p></div></details>
    <details><summary>Can I change my mind after the consultation?</summary><div><p>Yes. A consultation does not commit you to treatment. You are welcome to take time to think it over.</p></div></details>
    <details><summary>Are there treatments Natasha will not offer me?</summary><div><p>Yes. If a treatment is not suitable for you, for medical reasons or because it would not give the result you are hoping for, Natasha will tell you and explain why.</p></div></details>
    <details><summary>Who can have treatment?</summary><div><p>Treatments are only available to clients aged 18 and over. You may be asked for photo ID.</p></div></details>
    <details><summary>How do I book?</summary><div><p>Choose your treatment on the <a href="${esc(site.bookingUrl)}" target="_blank" rel="noopener">booking page</a>, where you will see the current price, available times and any deposit. If you are not sure which treatment to choose, <a href="contact.html#enquire">send an enquiry</a> first.</p></div></details>
  </div>
</div></section>
${ctaBand("Not sure where to <em>start</em>?", "Book a consultation or send a question, and Natasha will help you choose.")}`,
});

pages["academy.html"] = () => layout({
  file: "academy.html", page: "academy",
  title: "So Subtle Academy | Level Up Lips Masterclass for Injectors",
  description: "The So Subtle Academy: Natasha Shisgal's Level Up Lips Masterclass for experienced injectors, with live models, plus 1-2-1 training and refresher days.",
  body: `
${pageHero("So Subtle Academy", "Training for practitioners who want to <em>refine</em>", "Hands-on lip training with Natasha Shisgal, for injectors who already have the foundations and want to take their technique, placement and presentation further.", `<div class="btn-row">${featured?.enrolUrl ? ext(featured.enrolUrl, "View masterclass &amp; enrol") : ""}<a class="btn btn-ghost" href="contact.html?interest=${featured?.id || "other"}#enquire">Ask about training</a></div>`)}

<section class="section" data-reveal><div class="wrap split">
  <div class="stack"><p class="eyebrow">Your educator</p><h2>Taught from a working <em>clinic</em></h2></div>
  <div class="stack">
    <p class="lede">Natasha runs So Subtle Aesthetics in ${esc(addr.locality)}, where lips are at the heart of her work. The Academy is where she passes that experience on.</p>
    <p class="muted">Training is built around live models, so you practise on real lips with Natasha beside you.</p>
    ${pendingBlock("Educator credentials", "Add Natasha’s teaching background and any accreditation for the Academy here. No accreditation or CPD claims are shown until confirmed.")}
  </div>
</div></section>

${featured ? `<section class="section band-veil" id="${featured.id}" data-reveal><div class="wrap stack-lg">
  <div class="stack"><p class="eyebrow">Featured ${esc(featured.kicker.toLowerCase())}</p><h2>${esc(featured.title)}</h2></div>
  <article class="course" aria-labelledby="course-h">
    <div class="course-main">
      <h3 id="course-h" class="visually-hidden">${esc(featured.title)}: course overview</h3>
      <p class="lede">${esc(featured.summary)}</p>
      <div class="stack"><p class="eyebrow">What’s included</p>
        <ul class="includes">${featured.includes.map((i) => `<li>${esc(i)}${i === "Certificate" && !featured.certificateNote ? pending("Confirm wording / accreditation") : ""}</li>`).join("")}</ul>
        ${featured.certificateNote ? `<p class="small muted">${esc(featured.certificateNote)}</p>` : ""}
      </div>
      <div class="stack"><p class="eyebrow">Who it suits</p>
        <p>${esc(featured.audience)} who want to develop their lip work with live-model practice and personal feedback.</p>
        ${featured.entryRequirements ? `<p class="muted">Entry requirements: ${esc(featured.entryRequirements)}</p>` : pendingBlock("Entry requirements", "Add what students must hold before booking (for example existing qualifications and insurance).")}
      </div>
    </div>
    <aside class="course-side" aria-label="Course details">
      <p class="eyebrow">At a glance</p>
      <dl>
        <div><dt>Format</dt><dd>${esc(featured.format)}</dd></div>
        <div><dt>For</dt><dd>${esc(featured.audience)}</dd></div>
        <div><dt>Price</dt><dd>${featured.price ? esc(featured.price) : `Shown at checkout${pending("Price to confirm")}`}</dd></div>
        <div><dt>Dates &amp; venue</dt><dd>${featured.dates || featured.location ? esc([featured.dates, featured.location].filter(Boolean).join(" · ")) : `On request${pending("Dates to confirm")}`}</dd></div>
      </dl>
      ${featured.enrolUrl ? ext(featured.enrolUrl, "View masterclass &amp; enrol") : ""}
      <a class="btn btn-ghost" href="contact.html?interest=${featured.id}#enquire">Ask a question</a>
      <p class="small muted">Payment is taken securely by Beacons, our checkout partner. ${featured.terms ? esc(featured.terms) : "Please read the booking and cancellation terms before you pay."}${featured.terms ? "" : pending("Refund terms to confirm")}</p>
    </aside>
  </article>
</div></section>` : ""}

<section class="section" data-reveal><div class="wrap stack-lg">
  <div class="stack"><p class="eyebrow">Enrolling</p><h2>How to book your <em>place</em></h2></div>
  <ol class="steps">
    <li><h3>Check the details</h3><p class="muted">Read the course page, including dates, entry requirements and terms.</p></li>
    <li><h3>Enrol online</h3><p class="muted">Pay securely through the Beacons checkout.</p></li>
    <li><h3>Prepare for the day</h3><p class="muted">Natasha will be in touch with everything you need before your training.</p></li>
  </ol>
  ${pendingBlock("Step 3", "Please confirm what students receive after enrolling (confirmation email, joining instructions, model arrangements).")}
</div></section>

${courses.filter((c) => c !== featured).length ? `<section class="section band-veil" data-reveal><div class="wrap split">
  <div class="stack"><p class="eyebrow">More training</p><h2>One-to-one <em>options</em></h2></div>
  <div class="stack-lg">${courses.filter((c) => c !== featured).map((c) => `<div class="course-mini" id="${c.id}">
    <h3>${esc(c.title)}</h3><p class="muted">${esc(c.summary)}</p>
    <p class="small">${esc(c.format)}${c.price ? ` · ${esc(c.price)}` : ""}</p>
    <div class="btn-row">${c.enrolUrl ? ext(c.enrolUrl, "Book", "btn btn-ghost") : `<a class="btn btn-ghost" href="contact.html?interest=${c.id}#enquire">Enquire<span class="arrow" aria-hidden="true">→</span></a>`}</div>
  </div>`).join("")}</div>
</div></section>` : ""}

<section class="section band-ink" data-reveal><div class="wrap cta-band">
  <div class="stack"><h2>Questions about <em>training</em>?</h2><p class="muted">Ask about dates, entry requirements or one-to-one sessions and Natasha will get back to you.</p></div>
  <div class="btn-row">${featured?.enrolUrl ? ext(featured.enrolUrl, "Enrol") : ""}<a class="btn btn-ghost" href="contact.html?interest=${featured?.id || "other"}#enquire">Academy enquiry</a></div>
</div></section>`,
});

pages["gallery.html"] = () => {
  const cats = ["treatments", "clinic", "brand", "academy", "results"];
  const usedCats = galleryOk.length ? cats.filter((c) => galleryOk.some((im) => im.category === c)) : cats;
  const labels = { treatments: "Treatments", clinic: "Clinic", brand: "Brand", academy: "Academy", results: "Results" };
  return layout({
    file: "gallery.html", page: "gallery",
    title: "Gallery | So Subtle Aesthetics, Dartford",
    description: "Photographs from So Subtle Aesthetics in Dartford: the clinic, treatments and So Subtle Academy training days.",
    body: `
${pageHero("Gallery", "Inside <em>So Subtle</em>", "The clinic, the treatment room and Academy training days.")}
<section class="section section-tight"><div class="wrap stack-lg">
  ${galleryOk.length || PREVIEW ? `<div class="filters" role="group" aria-label="Filter photos">
    <button type="button" data-filter="all" aria-pressed="true">All</button>
    ${usedCats.map((c) => `<button type="button" data-filter="${c}" aria-pressed="false">${labels[c]}</button>`).join("")}
  </div>
  <div class="gallery-grid" data-gallery>${galleryOk.length ? galleryOk.filter((im) => !im._missing).map(galleryFigure).join("") : gallerySlots(["treatments", "clinic", "brand", "academy", "results", "treatments"])}</div>` : ""}
  ${galleryOk.some((im) => im.category === "results") ? `<p class="small muted">Result photos are shared with each client’s written permission and have not been edited. Everyone’s results are different.</p>` : ""}
  ${pendingBlock("Photos", "Instagram could not be reached from this build environment, so no photos have been copied. Send Natasha’s chosen photos (and written client consent for any identifiable or before-and-after images) and add them to content/gallery.json.")}
  <p class="muted">See more recent work on <a href="${esc(instagram.url)}" target="_blank" rel="noopener">Instagram ${esc(instagram.handle)}</a>.</p>
</div></section>
<dialog class="lightbox" id="lightbox" aria-label="Photo viewer"><button class="close" type="button" aria-label="Close photo">×</button><img alt=""><p></p></dialog>
${ctaBand("Like what you <em>see</em>?", "Book a consultation to talk through what would suit you.")}`,
  });
};

pages["reviews.html"] = () => layout({
  file: "reviews.html", page: "reviews",
  title: "Reviews | So Subtle Aesthetics, Dartford",
  description: "Read genuine client reviews of So Subtle Aesthetics in Dartford, Kent, and leave your own review on Google.",
  body: `
${pageHero("Reviews", "Kind <em>words</em>", "Reviews from real clients. If you have visited, we would love to hear how it went.", `${googleRating()}<div class="btn-row">${googleButtons()}${bookBtn("Book now", googleButtons() ? "btn btn-ghost" : "btn btn-primary")}</div>`)}
<section class="section"><div class="wrap stack-lg">
  ${pendingBlock("Google reviews", "The official Google Business Profile has not been verified yet. Once Natasha shares the profile link and its ‘Ask for reviews’ link, the ‘Read our Google reviews’ and ‘Leave a Google review’ buttons switch on automatically. A star rating is only shown if it is entered with the date it was checked.")}
  <div class="quotes">${testimonials.length ? quoteCards(testimonials) : quotePlaceholders(6)}</div>
  ${!testimonials.length && PROD ? `<p class="muted">Client reviews will appear here soon. In the meantime, see recent work on <a href="${esc(instagram.url)}" target="_blank" rel="noopener">Instagram</a>.</p>` : ""}
</div></section>
${ctaBand("Ready when <em>you</em> are", "Book a treatment or a consultation online, or send Natasha a question first.")}`,
});

pages["contact.html"] = () => layout({
  file: "contact.html", page: "contact",
  title: "Contact & Consultations | So Subtle Aesthetics, Dartford",
  description: "Book a treatment online or send an enquiry to So Subtle Aesthetics in Dartford, Kent. Ask about treatments, consultations or Academy training.",
  body: `
${pageHero("Contact &amp; consultations", "Book or <em>enquire</em>", "Know what you would like? Book online. Have a question first? Send an enquiry and Natasha will reply.")}
<section class="section section-tight"><div class="wrap journeys">
  <div class="journey dark"><p class="eyebrow">Book a treatment</p><h2>Book online</h2><p class="muted">Choose a treatment, see the current price and pick a time that suits you.</p><div class="btn-row">${bookBtn("Go to booking")}</div></div>
  <div class="journey"><p class="eyebrow">Make an enquiry</p><h2>Ask a question</h2><p class="muted">Not sure which treatment is right, or asking about Academy training? Send a message below.</p><div class="btn-row"><a class="btn btn-ghost" href="#enquire">Write an enquiry<span class="arrow" aria-hidden="true">↓</span></a></div></div>
</div></section>

<section class="section band-veil" id="enquire"><div class="wrap split">
  <div class="stack-lg">
    <div class="stack"><p class="eyebrow">Enquiries</p><h2>Send Natasha a <em>message</em></h2>
    <p class="muted">Please do not include medical details here. Natasha will go through your medical history with you privately at consultation.</p></div>
    <ul class="contact-list">
      <li><span class="k">Location</span><span class="v">${esc(fullAddress)}${pendingIf(site.address, "Address to confirm")}</span></li>
      <li><span class="k">Opening</span><span class="v">${esc(site.hours)}</span></li>
      ${phoneOk ? `<li><span class="k">Telephone</span><span class="v"><a href="tel:${esc(site.phone.e164)}">${esc(site.phone.display)}</a>${pendingIf(site.phone, "Number to confirm")}</span></li>` : ""}
      <li><span class="k">Directions</span><span class="v"><a href="${esc(site.google.mapsUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>${pending("Map listing to confirm")}</span></li>
    </ul>
    <div class="stack"><span class="label">Social</span>${socialList("social-light")}</div>
  </div>
  <form class="form" id="enquiry-form" novalidate data-endpoint="${ARTIFACT ? "" : esc(site.enquiry.endpoint)}" aria-describedby="form-intro">
    <p id="form-intro" class="small muted">All fields are required.</p>
    <div class="form-row">
      <div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" type="text" autocomplete="name" maxlength="100" required aria-describedby="name-error"><span class="err" id="name-error" aria-live="polite"></span></div>
      <div class="field"><label for="f-email">Email address</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="254" required aria-describedby="email-error"><span class="err" id="email-error" aria-live="polite"></span></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="f-phone">Telephone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required aria-describedby="phone-error"><span class="err" id="phone-error" aria-live="polite"></span></div>
      <div class="field"><label for="f-interest">Treatment or course</label><select id="f-interest" name="interest" required aria-describedby="interest-error">
        <option value="">Please choose</option>
        ${["Treatments", "Academy", "Other"].map((g) => `<optgroup label="${g}">${interests.filter((i) => i.group === g).map((i) => `<option value="${esc(i.label)}" data-id="${esc(i.id)}">${esc(i.label)}</option>`).join("")}</optgroup>`).join("")}
      </select><span class="err" id="interest-error" aria-live="polite"></span></div>
    </div>
    <div class="field"><label for="f-message">Your message</label><textarea id="f-message" name="message" maxlength="2000" required aria-describedby="message-hint message-error"></textarea><span class="hint" id="message-hint">Tell us what you would like to know. Please leave out medical details.</span><span class="err" id="message-error" aria-live="polite"></span></div>
    <div class="hp" aria-hidden="true"><label for="f-company">Company (leave blank)</label><input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>
    <input type="hidden" name="ts" value="">
    ${site.enquiry.turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(site.enquiry.turnstileSiteKey)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ""}
    <div class="field"><div class="check"><input id="f-privacy" name="privacy" type="checkbox" required aria-describedby="privacy-error"><label for="f-privacy">I have read the <a href="privacy.html">privacy notice</a> and agree to So Subtle Aesthetics using these details to reply to my enquiry.</label></div><span class="err" id="privacy-error" aria-live="polite"></span></div>
    <div class="btn-row"><button class="btn btn-primary" type="submit">Send enquiry</button></div>
    <div id="form-status" class="form-status" role="status" tabindex="-1" hidden></div>
    ${ARTIFACT ? pendingBlock("Preview", "Sending is switched off in this preview. The live site sends enquiries to Natasha’s inbox once her email address and the email service are set up.") : ""}
  </form>
</div></section>`,
});

pages["privacy.html"] = () => layout({
  file: "privacy.html", page: "privacy",
  title: "Privacy Notice | So Subtle Aesthetics",
  description: "How So Subtle Aesthetics Ltd uses the details you send through the website enquiry form.",
  body: `
${pageHero("Privacy", "Privacy <em>notice</em>", "How we use the details you send us through this website.")}
<section class="section"><div class="wrap stack-lg prose">
  ${pendingBlock("Draft for review", "This notice is a starting draft. Please have it checked, and confirm the contact email and ICO registration, before the site goes live.")}
  <div class="stack">
    <h2>Who we are</h2>
    <p>${esc(site.company.legalName)} (company no. ${esc(site.company.number)}) runs this website and is responsible for the personal information you send through it. Academy training is provided by ${esc(site.company.academyLegalName)} (company no. ${esc(site.company.academyNumber)}).</p>
    <h2>What we collect</h2>
    <p>When you send an enquiry we receive your name, email address, telephone number, the treatment or course you are interested in and your message. Please do not include medical information in the form.</p>
    <h2>Why we use it</h2>
    <p>We use these details only to reply to your enquiry and, if you choose to go ahead, to arrange your appointment or training. Our lawful basis is taking steps at your request before entering into a contract, and our legitimate interest in answering enquiries.</p>
    <h2>Who sees it</h2>
    <p>Your enquiry is sent to Natasha by email. The website is hosted by Cloudflare and enquiry emails are delivered by Resend, who process the details on our behalf. Bookings and course purchases are handled by That Time and Beacons under their own privacy policies. We never sell your information.</p>
    <h2>How long we keep it</h2>
    <p>We keep enquiry emails for up to 12 months unless you become a client, in which case your records are kept as required for treatment records.</p>
    <h2>Your rights</h2>
    <p>You can ask to see, correct or delete the information we hold about you, or object to how we use it. Contact us using the details on the <a href="contact.html">contact page</a>. If you are unhappy with how we handle your information you can complain to the Information Commissioner’s Office at ico.org.uk.</p>
    <h2>Cookies</h2>
    <p>This website does not use advertising or analytics cookies.</p>
    <p class="small muted">Last updated: ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.</p>
  </div>
</div></section>`,
});

pages["404.html"] = () => layout({
  file: "404.html", page: "404",
  title: "Page not found | So Subtle Aesthetics",
  description: "This page could not be found. Visit the So Subtle Aesthetics home page or the treatment menu to find what you need.",
  body: `${pageHero("Page not found", "This page has <em>moved</em>", "The page you were looking for is not here. Try the treatment menu, or go back to the home page.", `<div class="btn-row"><a class="btn btn-primary" href="index.html">Home</a><a class="btn btn-ghost" href="treatments.html">Treatments</a></div>`)}`,
});

// ---------- write ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, "assets", "js"), { recursive: true });
await cp(path.join(ROOT, "src", "assets"), path.join(OUT, "assets"), { recursive: true });
await cp(path.join(ROOT, "functions", "_lib", "validate.js"), path.join(OUT, "assets", "js", "validate.js"));
await processGallery();

for (const [file, render] of Object.entries(pages)) {
  await writeFile(path.join(OUT, file), render());
}

await writeFile(path.join(ROOT, "functions", "_lib", "interests.generated.js"),
  `// Generated by scripts/build.mjs from content/*.json. Do not edit by hand.\nexport const INTERESTS = ${JSON.stringify([...new Set(allInterestLabels)], null, 2)};\n`);

const pageFiles = Object.keys(pages).filter((f) => !["404.html"].includes(f));
await writeFile(path.join(OUT, "robots.txt"), PROD && site.siteUrl
  ? `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap.xml\n`
  : `User-agent: *\nDisallow: /\n`);
if (site.siteUrl) {
  await writeFile(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pageFiles.map((f) => `  <url><loc>${site.siteUrl}/${f === "index.html" ? "" : f}</loc></url>`).join("\n")}\n</urlset>\n`);
}
await writeFile(path.join(OUT, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; font-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'
${PREVIEW ? "  X-Robots-Tag: noindex, nofollow\n" : ""}/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=3600
`);

const count = (await readdir(OUT)).length;
console.log(`Built ${Object.keys(pages).length} pages (${PROD ? "production" : ARTIFACT ? "artifact preview" : "preview"}) into ${path.relative(ROOT, OUT)}/ [${count} entries]${sharp ? "" : " (sharp not installed: images copied unresized)"}`);
if (PROD && excluded.length) {
  const unique = [...new Set(excluded)];
  console.log(`\nLeft out of the live build until confirmed (${unique.length}):`);
  for (const e of unique) console.log(`  - ${e}`);
}
