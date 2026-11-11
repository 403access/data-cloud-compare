/* Data Cloud Compare — site interactions */

const doc = document.documentElement;
doc.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- theme */
const themeToggle = document.querySelector<HTMLElement>("[data-theme-toggle]");

function syncThemeLabel(): void {
  if (!themeToggle) return;
  const dark = doc.dataset.theme !== "light";
  themeToggle.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#070a11" : "#f6f8fc");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = doc.dataset.theme === "light" ? "dark" : "light";
    doc.dataset.theme = next;
    try {
      localStorage.setItem("dcc-theme", next);
    } catch {
      /* ignore */
    }
    syncThemeLabel();
  });
}
syncThemeLabel();

/* ------------------------------------------------------------ mobile nav */
const navToggle = document.querySelector<HTMLElement>(".nav-toggle");
const navLinks = document.getElementById("nav-links");

function closeNav(): void {
  if (!navToggle || !navLinks) return;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open menu");
  navLinks.classList.remove("open");
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    navToggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    navLinks.classList.toggle("open", !open);
  });
  navLinks.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("a")) closeNav();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) closeNav();
  });
}

/* -------------------------------------------------------- scroll reveal */
const revealItems = [...document.querySelectorAll<HTMLElement>(".reveal")];
if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((element) => element.classList.add("in"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  revealItems.forEach((element) => revealObserver.observe(element));
}

/* ------------------------------------------------------ number counters */
function formatNumber(value: number, node: Element): string {
  const decimals = Number.parseInt(node.getAttribute("data-decimals") || "0", 10);
  const format = node.getAttribute("data-format");
  if (format === "compact" && value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  }
  if (format === "comma") {
    return Math.round(value).toLocaleString("en-US");
  }
  return value.toFixed(decimals);
}

function animateCounter(node: HTMLElement): void {
  const target = Number.parseFloat(node.getAttribute("data-count") || "");
  if (!Number.isFinite(target)) return;
  if (reduceMotion) {
    node.textContent = formatNumber(target, node);
    return;
  }
  let start: number | null = null;
  const duration = 1500;
  function frame(now: number): void {
    if (start === null) start = now;
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = formatNumber(target * eased, node);
    if (progress < 1) requestAnimationFrame(frame);
    else node.textContent = formatNumber(target, node);
  }
  requestAnimationFrame(frame);
}

const counters = [...document.querySelectorAll<HTMLElement>("[data-count]")];
if (counters.length) {
  if (!("IntersectionObserver" in window)) {
    counters.forEach(animateCounter);
  } else {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target as HTMLElement);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.45 },
    );
    counters.forEach((element) => counterObserver.observe(element));
  }
}

/* --------------------------------------------------------------- copy */
const copyButton = document.querySelector<HTMLElement>("[data-copy-target]");
if (copyButton) {
  copyButton.addEventListener("click", () => {
    const id = copyButton.getAttribute("data-copy-target");
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const text = (target as HTMLElement).innerText;
    const label = copyButton.querySelector("span");
    const done = (): void => {
      if (!label) return;
      label.textContent = "Copied";
      copyButton.classList.add("copied");
      window.setTimeout(() => {
        label.textContent = "Copy";
        copyButton.classList.remove("copied");
      }, 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    } else {
      fallback(text, done);
    }
  });
}

function fallback(text: string, done: () => void): void {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
    done();
  } catch {
    /* ignore */
  }
  document.body.removeChild(area);
}

/* --------------------------------------------------------------- year */
document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

/* ----------------------------------------------------- header on scroll */
const header = document.querySelector<HTMLElement>(".site-header");
if (header) {
  const onScroll = (): void => {
    header.classList.toggle("scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}
