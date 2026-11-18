/* ==========================================================================
   Water design system — wavy placeholders
   --------------------------------------------------------------------------
   The tide effect is an SVG displacement filter. Browsers do not apply CSS
   filters to `::placeholder`, so this dependency-free module mirrors each
   placeholder into a sibling span. The span can be displaced by
   `#ds-input-wave`, and the native placeholder is hidden with transparent
   text. Screen readers still see the real placeholder; the mirror is
   aria-hidden.

   import { initPlaceholderWaves } from "./inputs.js";
   initPlaceholderWaves();

   Fields are upgraded as they appear, so windows and inspectors rendered
   after boot are covered too. Add `data-placeholder-wave="off"` to skip one.
   ========================================================================== */

const INPUT_CLASS = "ds-wave-input";
const OVERLAY_CLASS = "ds-wave-placeholder";
const HOST_CLASS = "ds-wave-host";
const TEXT_TYPES = new Set([
  "email",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

const overlays = new WeakMap();
const fields = new Set();
let frame = 0;

const resizeObserver =
  typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
        entries.forEach((entry) => sync(entry.target));
      })
    : null;

function isTextField(element) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return TEXT_TYPES.has(element.type);
}

function position(input, overlay) {
  const style = getComputedStyle(input);
  overlay.style.left = `${input.offsetLeft}px`;
  overlay.style.top = `${input.offsetTop}px`;
  overlay.style.width = `${input.offsetWidth}px`;
  overlay.style.height = `${input.offsetHeight}px`;
  overlay.style.fontFamily = style.fontFamily;
  overlay.style.fontSize = style.fontSize;
  overlay.style.fontStretch = style.fontStretch;
  overlay.style.fontStyle = style.fontStyle;
  overlay.style.fontVariant = style.fontVariant;
  overlay.style.fontWeight = style.fontWeight;
  overlay.style.letterSpacing = style.letterSpacing;
  overlay.style.lineHeight = style.lineHeight;
  overlay.style.textAlign = style.textAlign;
  overlay.style.textIndent = style.textIndent;
  overlay.style.textTransform = style.textTransform;
  overlay.style.wordSpacing = style.wordSpacing;
  overlay.style.direction = style.direction;
  overlay.style.paddingLeft = style.paddingLeft;
  overlay.style.paddingRight = style.paddingRight;

  if (input instanceof HTMLTextAreaElement) {
    overlay.dataset.multiline = "true";
    overlay.style.paddingTop = style.paddingTop;
    overlay.style.paddingBottom = style.paddingBottom;
  } else {
    delete overlay.dataset.multiline;
    overlay.style.paddingTop = "0";
    overlay.style.paddingBottom = "0";
  }
}

function sync(input) {
  const overlay = overlays.get(input);
  if (!overlay) return;
  const text = input.getAttribute("placeholder") || "";
  overlay.textContent = text;
  overlay.hidden = text.length === 0;
  position(input, overlay);
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    fields.forEach(sync);
  });
}

function enhance(input) {
  if (!(input instanceof Element) || !isTextField(input)) return;
  if (input.dataset.placeholderWave === "off") return;

  const existing = overlays.get(input);
  if (existing) {
    sync(input);
    return;
  }

  const text = input.getAttribute("placeholder");
  if (!text) return;

  const host = input.parentElement;
  if (!host) return;

  host.classList.add(HOST_CLASS);
  input.classList.add(INPUT_CLASS);

  const overlay = document.createElement("span");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("aria-hidden", "true");
  overlay.textContent = text;
  input.insertAdjacentElement("afterend", overlay);

  overlays.set(input, overlay);
  fields.add(input);
  resizeObserver?.observe(input);
  position(input, overlay);
}

function scan(root) {
  if (root instanceof Element && root.matches("input[placeholder], textarea[placeholder]")) {
    enhance(root);
  }
  root.querySelectorAll?.("input[placeholder], textarea[placeholder]").forEach(enhance);
}

export function initPlaceholderWaves(root = document) {
  if (typeof document === "undefined" || !root) return;
  scan(root);

  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "attributes") {
          if (record.target instanceof Element) enhance(record.target);
          return;
        }
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
      });
    });
    const target = root === document ? document.body : root;
    if (target) {
      observer.observe(target, {
        attributeFilter: ["placeholder"],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  }

  window.addEventListener("resize", schedule, { passive: true });
}