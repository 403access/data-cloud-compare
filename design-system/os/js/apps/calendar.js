/* Aether OS — Calendar
   The calendar tray popover and the Calendar app share one event map and one
   locale-aware month grid. */

import { esc } from "../core/utils.js";
import { clockTime, longDate } from "../shell/clock.js";
import { closeTrays, registerTray } from "../shell/popovers.js";
import { openWindow } from "../shell/windows.js";

/* ------------------------------------------------------------ calendar */

const calendarPop = document.querySelector("[data-calendar]");
const calendarGrid = document.querySelector("[data-calendar-grid]");
const calendarWeekdays = document.querySelector("[data-calendar-weekdays]");
const calendarMonth = document.querySelector("[data-calendar-month]");
const calendarSelected = document.querySelector("[data-calendar-selected]");
const calendarFullDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const calendarMonthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
export const calendarDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const calendarWeekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

let calendarView = startOfMonth(new Date());
let calendarSelectedDate = new Date();

function startOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function dayKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStartIndex() {
  try {
    const locale = new Intl.Locale(document.documentElement.lang || navigator.language);
    return (locale.weekInfo?.firstDay ?? 7) % 7;
  } catch {
    return 0;
  }
}

function weekdayHeadersHtml() {
  const firstWeekday = weekStartIndex();
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + ((firstWeekday + index) % 7));
    return `<span>${calendarWeekdayFormat.format(date)}</span>`;
  }).join("");
}

const CALENDAR_EVENTS = new Map();

function addCalendarEvent(offset, time, title, detail) {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  const key = dayKey(day);
  if (!CALENDAR_EVENTS.has(key)) CALENDAR_EVENTS.set(key, []);
  CALENDAR_EVENTS.get(key).push({ time, title, detail });
}

[
  [0, "09:30", "Snapshot verification", "Jottacloud Archive · 45 min"],
  [0, "14:00", "Tide Radio session", "Deep Current · 1 hr"],
  [1, "11:00", "Design review", "Aether OS tray menus · 30 min"],
  [2, "16:30", "Archive sync", "Incremental · 2 hr"],
  [-1, "10:00", "Jottacloud audit", "Read-only check · 1 hr"],
  [4, "08:15", "Backup window", "Nightly · 3 hr"],
].forEach((event) => addCalendarEvent(...event));

CALENDAR_EVENTS.forEach((events) => events.sort((a, b) => a.time.localeCompare(b.time)));

function renderCalendar() {
  if (!calendarPop || !calendarGrid || !calendarWeekdays || !calendarMonth) return;
  const now = new Date();
  document.querySelectorAll("[data-calendar-time]").forEach((node) => (node.textContent = clockTime.format(now)));
  document.querySelectorAll("[data-calendar-today-label]").forEach((node) => (node.textContent = longDate.format(now)));
  const firstWeekday = weekStartIndex();
  const month = calendarView.getMonth();
  const year = calendarView.getFullYear();

  calendarMonth.textContent = calendarMonthFormat.format(calendarView);

  calendarWeekdays.innerHTML = weekdayHeadersHtml();

  const firstOfMonth = new Date(year, month, 1);
  const offset = (firstOfMonth.getDay() - firstWeekday + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  const todayKey = dayKey(now);
  const selectedKey = dayKey(calendarSelectedDate);

  calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date);
    const classes = ["os-calendar__day"];
    if (date.getMonth() !== month) classes.push("is-other-month");
    if (key === todayKey) classes.push("is-today");
    if (key === selectedKey) classes.push("is-selected");
    if (CALENDAR_EVENTS.has(key)) classes.push("has-events");
    return `<button type="button" class="${classes.join(" ")}" data-calendar-day="${key}" aria-label="${calendarDayFormat.format(date)}"${key === todayKey ? ' aria-current="date"' : ""}${key === selectedKey ? ' aria-pressed="true"' : ""}>${date.getDate()}</button>`;
  }).join("");

  if (calendarSelected) {
    const isToday = selectedKey === todayKey;
    calendarSelected.textContent = `${isToday ? "Today · " : ""}${calendarFullDate.format(calendarSelectedDate)}`;
  }
}

registerTray("calendar", {
  open() {
    const now = new Date();
    calendarView = startOfMonth(now);
    calendarSelectedDate = now;
    renderCalendar();
  },
});

calendarGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-day]");
  if (!button) return;
  const [year, month, day] = button.dataset.calendarDay.split("-").map(Number);
  calendarSelectedDate = new Date(year, month - 1, day);
  renderCalendar();
});

document.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("[data-calendar-today-btn]")?.addEventListener("click", () => {
  const now = new Date();
  calendarView = startOfMonth(now);
  calendarSelectedDate = now;
  renderCalendar();
});

/* --------------------------------------------------------- calendar app */

const calendarAppMonth = document.querySelector("[data-calendar-app-month]");
const calendarAppWeekdays = document.querySelector("[data-calendar-app-weekdays]");
const calendarAppGrid = document.querySelector("[data-calendar-app-grid]");
const calendarAppSelectedLabel = document.querySelector("[data-calendar-app-selected]");
const calendarAppEvents = document.querySelector("[data-calendar-app-events]");
const calendarAppBadgeText = document.querySelector("[data-calendar-app-badge-text]");

let calendarAppView = startOfMonth(new Date());
export let calendarAppSelected = new Date();

function calendarEventHtml(event) {
  return `<article class="os-agenda__event">
    <span class="os-agenda__event-time">${esc(event.time)}</span>
    <span class="os-agenda__event-body"><b>${esc(event.title)}</b><small>${esc(event.detail)}</small></span>
  </article>`;
}

function renderCalendarApp() {
  if (!calendarAppGrid || !calendarAppMonth || !calendarAppWeekdays) return;
  const now = new Date();
  const firstWeekday = weekStartIndex();
  const month = calendarAppView.getMonth();
  const year = calendarAppView.getFullYear();
  const todayKey = dayKey(now);
  const selectedKey = dayKey(calendarAppSelected);

  calendarAppMonth.textContent = calendarMonthFormat.format(calendarAppView);
  calendarAppWeekdays.innerHTML = weekdayHeadersHtml();
  document.querySelectorAll("[data-calendar-app-time]").forEach((node) => (node.textContent = clockTime.format(now)));

  const firstOfMonth = new Date(year, month, 1);
  const offset = (firstOfMonth.getDay() - firstWeekday + 7) % 7;
  const start = new Date(year, month, 1 - offset);

  calendarAppGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date);
    const classes = ["os-calendar-app__day"];
    if (date.getMonth() !== month) classes.push("is-other-month");
    if (key === todayKey) classes.push("is-today");
    if (key === selectedKey) classes.push("is-selected");
    if (CALENDAR_EVENTS.has(key)) classes.push("has-events");
    return `<button type="button" class="${classes.join(" ")}" data-calendar-app-day="${key}" aria-label="${calendarDayFormat.format(date)}"${key === todayKey ? ' aria-current="date"' : ""}${key === selectedKey ? ' aria-pressed="true"' : ""}>${date.getDate()}</button>`;
  }).join("");

  if (calendarAppSelectedLabel) calendarAppSelectedLabel.textContent = longDate.format(calendarAppSelected);

  const events = CALENDAR_EVENTS.get(selectedKey) || [];
  if (calendarAppEvents) {
    calendarAppEvents.innerHTML = events.length
      ? events.map(calendarEventHtml).join("")
      : '<p class="os-agenda__empty">Nothing scheduled.<br><span>Open water, open time.</span></p>';
  }
  if (calendarAppBadgeText) {
    calendarAppBadgeText.textContent = events.length ? `${events.length} ${events.length === 1 ? "event" : "events"}` : "No events";
  }
}

export function openCalendarApp(date) {
  const target = date instanceof Date ? date : calendarAppSelected;
  calendarAppSelected = new Date(target);
  calendarAppView = startOfMonth(target);
  openWindow("calendar");
  renderCalendarApp();
}

document.querySelector("[data-calendar-open-app]")?.addEventListener("click", () => {
  openCalendarApp(calendarSelectedDate);
  closeTrays();
});

calendarAppGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-app-day]");
  if (!button) return;
  const [year, month, day] = button.dataset.calendarAppDay.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  calendarAppSelected = selected;
  if (selected.getMonth() !== calendarAppView.getMonth()) calendarAppView = startOfMonth(selected);
  renderCalendarApp();
});

document.querySelector("[data-calendar-app-prev]")?.addEventListener("click", () => {
  calendarAppView = new Date(calendarAppView.getFullYear(), calendarAppView.getMonth() - 1, 1);
  renderCalendarApp();
});

document.querySelector("[data-calendar-app-next]")?.addEventListener("click", () => {
  calendarAppView = new Date(calendarAppView.getFullYear(), calendarAppView.getMonth() + 1, 1);
  renderCalendarApp();
});

document.querySelector("[data-calendar-app-today]")?.addEventListener("click", () => {
  const now = new Date();
  calendarAppView = startOfMonth(now);
  calendarAppSelected = now;
  renderCalendarApp();
});
