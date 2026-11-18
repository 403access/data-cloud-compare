/* Aether OS — clock
   Keeps every time and date label in the desktop in sync. */

/* -------------------------------------------------------------- clock */

const shortDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
export const clockTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function tickClock() {
  const now = new Date();
  const time = clockTime.format(now);
  document.querySelectorAll("[data-clock-time]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-clock-big]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-clock-date]").forEach((node) => (node.textContent = shortDate.format(now)));
  document.querySelectorAll("[data-clock-long]").forEach((node) => (node.textContent = longDate.format(now)));
  document.querySelectorAll("[data-calendar-time]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-calendar-today-label]").forEach((node) => (node.textContent = longDate.format(now)));
  document.querySelectorAll("[data-calendar-app-time]").forEach((node) => (node.textContent = time));
}

export function startClock() {
  tickClock();
  window.setInterval(tickClock, 20_000);
}
