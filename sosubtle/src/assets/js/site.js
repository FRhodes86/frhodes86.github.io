import { validateEnquiry } from "./validate.js";

document.documentElement.classList.add("js");

// Header border once the page scrolls
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Mobile menu
const toggle = document.querySelector(".menu-toggle");
const sheet = document.getElementById("mobile-nav");
if (toggle && sheet) {
  const closeBtn = sheet.querySelector(".menu-close");
  const open = () => {
    sheet.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    (sheet.querySelector("a") || closeBtn).focus();
  };
  const close = () => {
    sheet.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    toggle.focus();
  };
  toggle.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const items = [...sheet.querySelectorAll("a, button")];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches && !sheet.hidden) close(); });
}

// Gentle reveal for sections below the fold only; anything already on screen stays put
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("reveal-ready"); io.observe(el); }
  });
}

// Gallery filters and lightbox
const grid = document.querySelector("[data-gallery]");
if (grid) {
  const buttons = document.querySelectorAll("[data-filter]");
  buttons.forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.filter;
    buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    grid.querySelectorAll("[data-cat]").forEach((fig) => { fig.hidden = f !== "all" && fig.dataset.cat !== f; });
  }));
  const box = document.getElementById("lightbox");
  if (box && typeof box.showModal === "function") {
    const img = box.querySelector("img"), cap = box.querySelector("p");
    grid.addEventListener("click", (e) => {
      const z = e.target.closest("button.zoom");
      if (!z) return;
      img.src = z.dataset.full; img.alt = z.dataset.alt || ""; cap.textContent = z.dataset.caption || "";
      box.showModal();
    });
    box.querySelector(".close").addEventListener("click", () => box.close());
    box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
  }
}

// Enquiry form
const form = document.getElementById("enquiry-form");
if (form) {
  const status = document.getElementById("form-status");
  const submit = form.querySelector("button[type=submit]");
  const endpoint = form.dataset.endpoint;
  form.querySelector("[name=ts]").value = String(Date.now());

  // Pre-select an interest from ?interest= or #enquire-<id>
  const wanted = new URLSearchParams(location.search).get("interest") || (location.hash.startsWith("#enquire-") ? location.hash.slice(9) : "");
  if (wanted) {
    const opt = [...form.interest.options].find((o) => o.dataset.id === wanted);
    if (opt) form.interest.value = opt.value;
  }

  const fields = ["name", "email", "phone", "interest", "message", "privacy"];
  const showErrors = (errors) => {
    for (const f of fields) {
      const el = form.elements[f];
      const msg = document.getElementById(`${f}-error`);
      const has = Boolean(errors[f]);
      el.setAttribute("aria-invalid", String(has));
      if (msg) msg.textContent = errors[f] || "";
    }
  };
  const setStatus = (kind, text) => {
    status.hidden = false; status.className = `form-status ${kind}`; status.textContent = text; status.focus();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(form));
    raw.privacy = form.privacy.checked;
    const { ok, errors } = validateEnquiry(raw);
    showErrors(errors);
    if (!ok) {
      setStatus("bad", "Please check the highlighted fields.");
      form.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    if (!endpoint) {
      setStatus("info", "Preview: your details passed every check. Sending is switched off in this preview, so nothing was sent.");
      return;
    }
    submit.disabled = true; submit.textContent = "Sending…";
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raw) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        form.reset(); form.querySelector("[name=ts]").value = String(Date.now());
        setStatus("ok", out.message || "Thank you. Your enquiry has been sent.");
      } else {
        if (out.errors) showErrors(out.errors);
        setStatus("bad", out.message || "Your enquiry could not be sent. Please try again.");
      }
    } catch {
      setStatus("bad", "Your enquiry could not be sent because the connection failed. Please check your internet connection and try again.");
    } finally {
      submit.disabled = false; submit.textContent = "Send enquiry";
    }
  });
}
