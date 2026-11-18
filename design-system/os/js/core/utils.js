/* Aether OS — shared helpers
   Formatting, escaping, and the two media queries every module asks about. */

export const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export const esc = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

export const gb = (value) => value * 1024 ** 3;
export const mb = (value) => value * 1024 ** 2;
export const kb = (value) => value * 1024;
export const date = (iso) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`),
  );
