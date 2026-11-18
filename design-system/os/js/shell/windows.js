/* Aether OS — window manager
   Dragging, resizing, focus order, dock state, the window bounds clamp, and
   the split or overlap layout used when apps open. */

import { WINDOW_LAYOUTS, root, saveWindowLayout, state } from "../core/state.js";
import { toast } from "../core/toast.js";
import { prefersReducedMotion } from "../core/utils.js";

const desktop = document.querySelector("#os-desktop");

/* ------------------------------------------------------------ windows */

const windows = Array.from(document.querySelectorAll("[data-window]"));
const activeApp = document.querySelector("[data-active-app]");
let zCounter = 20;

const MIN_WINDOW_WIDTH = 280;
const MIN_WINDOW_HEIGHT = 180;
const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const RESIZE_CURSORS = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

const dockMap = {
  "open-explorer": "explorer",
  "open-settings": "settings",
  "open-terminal": "terminal",
  "open-music": "music",
  "open-about": "about",
  "open-shortcuts": "shortcuts",
};

/* --------------------------------------------------------------- layout
   Split is the default: every open app shares the workspace in a master and
   stack arrangement. Overlap keeps each app at its designed size and
   position, so windows may cover one another. */

const TILE_GAP = 10;
const TILE_MARGIN = 16;
const TILE_RAIL_GAP = 12;
const TILE_DOCK_GAP = 12;
const BOX_PROPS = ["left", "top", "right", "bottom", "width", "height"];

/* Inline geometry saved the moment the desktop enters split mode, so moving
   back to overlap restores each window exactly where the user left it. */
const freeformGeometry = new Map();
let tileOrder = windows.filter(isOpen).map((win) => win.dataset.window);

function isTiling() {
  return state.windowLayout === "split" && window.innerWidth > 820;
}

function rememberFreeform(win, refresh = false) {
  if (!refresh && freeformGeometry.has(win)) return;
  const saved = {};
  for (const prop of BOX_PROPS) saved[prop] = win.style.getPropertyValue(prop);
  freeformGeometry.set(win, saved);
}

function restoreFreeform() {
  windows.forEach((win) => {
    const saved = freeformGeometry.get(win);
    if (!saved) return;
    for (const prop of BOX_PROPS) {
      if (saved[prop]) win.style.setProperty(prop, saved[prop]);
      else win.style.removeProperty(prop);
    }
    freeformGeometry.delete(win);
  });
}

function workspaceRect() {
  const rect = desktop.getBoundingClientRect();
  const rail = document.querySelector(".os-rail");
  const dock = document.querySelector(".os-dock-wrap");
  const railRect = rail && window.getComputedStyle(rail).display !== "none"
    ? rail.getBoundingClientRect()
    : null;
  const dockRect = dock ? dock.getBoundingClientRect() : null;
  const rightInset = railRect && railRect.width
    ? rect.right - railRect.left + TILE_RAIL_GAP
    : TILE_MARGIN;
  const bottomInset = dockRect && dockRect.height
    ? rect.bottom - dockRect.top + TILE_DOCK_GAP
    : TILE_MARGIN;
  return {
    left: TILE_MARGIN,
    top: TILE_MARGIN,
    width: Math.max(0, Math.round(rect.width - TILE_MARGIN - rightInset)),
    height: Math.max(0, Math.round(rect.height - TILE_MARGIN - bottomInset)),
  };
}

function tileRects(count, area) {
  if (count === 1) {
    return [{ left: area.left, top: area.top, width: area.width, height: area.height }];
  }

  /* Two apps sit side by side; three follow the classic master and stack
     arrangement. Beyond that a balanced grid keeps every app readable. */
  if (count <= 3) {
    const masterWidth = Math.round((area.width - TILE_GAP) / 2);
    const stackWidth = area.width - masterWidth - TILE_GAP;
    const stackCount = count - 1;
    const stackHeight = Math.floor(
      (area.height - TILE_GAP * (stackCount - 1)) / stackCount,
    );
    const rects = [{ left: area.left, top: area.top, width: masterWidth, height: area.height }];
    for (let index = 0; index < stackCount; index += 1) {
      rects.push({
        left: area.left + masterWidth + TILE_GAP,
        top: area.top + index * (stackHeight + TILE_GAP),
        width: stackWidth,
        height: stackHeight,
      });
    }
    return rects;
  }

  const aspect = area.width / Math.max(1, area.height);
  const columns = Math.max(
    2,
    Math.min(count, Math.round(Math.sqrt(count * aspect))),
  );
  const rows = Math.ceil(count / columns);
  const rowHeight = Math.floor((area.height - TILE_GAP * (rows - 1)) / rows);
  const rects = [];
  let placed = 0;
  for (let row = 0; row < rows; row += 1) {
    /* Distribute the remaining windows evenly so the last row never holds a
       single stretched app. */
    const inRow = Math.ceil((count - placed) / (rows - row));
    const cellWidth = Math.floor((area.width - TILE_GAP * (inRow - 1)) / inRow);
    for (let column = 0; column < inRow; column += 1) {
      rects.push({
        left: area.left + column * (cellWidth + TILE_GAP),
        top: area.top + row * (rowHeight + TILE_GAP),
        width: cellWidth,
        height: rowHeight,
      });
      placed += 1;
    }
  }
  return rects;
}

function tileWindows() {
  const open = windows
    .filter(isOpen)
    .sort((a, b) => {
      const left = tileOrder.indexOf(a.dataset.window);
      const right = tileOrder.indexOf(b.dataset.window);
      return (left === -1 ? Infinity : left) - (right === -1 ? Infinity : right);
    });
  if (!open.length) return;

  const rects = tileRects(open.length, workspaceRect());
  open.forEach((win, index) => {
    const rect = rects[index];
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.right = "auto";
    win.style.bottom = "auto";
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
  });
}

export function applyWindowLayout() {
  root.dataset.windowLayout = state.windowLayout;
  const tiled = isTiling();
  windows.forEach((win) => win.classList.toggle("is-tiled", tiled && isOpen(win)));
  if (!tiled) return;
  windows.forEach((win) => rememberFreeform(win));
  tileWindows();
}

function syncLayoutControls() {
  document.querySelectorAll("[data-layout-setting]").forEach((select) => {
    select.value = state.windowLayout;
  });
}

export function setWindowLayout(layout) {
  if (!WINDOW_LAYOUTS.includes(layout)) return;
  if (layout === state.windowLayout) {
    syncLayoutControls();
    return;
  }
  if (state.windowLayout === "split") restoreFreeform();
  state.windowLayout = layout;
  saveWindowLayout();
  syncLayoutControls();
  applyWindowLayout();
  toast(layout === "split" ? "Split layout" : "Overlap layout");
}

export function windowById(id) {
  return windows.find((win) => win.dataset.window === id) || null;
}

export function isOpen(win) {
  return Boolean(win) && !win.hidden && !win.classList.contains("is-minimized");
}

export function syncDock() {
  document.querySelectorAll(".os-dock__item[data-cmd]").forEach((button) => {
    const id = dockMap[button.dataset.cmd];
    if (!id) return;
    const open = isOpen(windowById(id));
    button.classList.toggle("is-open", open);
    button.classList.toggle("is-running", open);
    button.setAttribute("aria-pressed", String(open));
  });
}

export function focusedWindow() {
  return windows.find((win) => win.classList.contains("is-focused") && isOpen(win)) || null;
}

export function focusWindow(win) {
  if (!win) return;
  windows.forEach((other) => other.classList.toggle("is-focused", other === win));
  win.style.zIndex = String(++zCounter);
  if (activeApp) activeApp.textContent = win.dataset.title || "Desktop";
  syncDock();
}

function topmostWindow() {
  return windows
    .filter(isOpen)
    .sort((a, b) => (parseInt(b.style.zIndex || "0", 10) || 0) - (parseInt(a.style.zIndex || "0", 10) || 0))[0];
}

export function openWindow(id) {
  const win = windowById(id);
  if (!win) return;
  if (!tileOrder.includes(id)) tileOrder.push(id);
  win.hidden = false;
  win.classList.remove("is-minimized");
  win.classList.add("is-open");
  if (isTiling()) rememberFreeform(win);
  focusWindow(win);
  win.focus({ preventScroll: true });
  applyWindowLayout();
  if (window.innerWidth <= 820) {
    win.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
  syncDock();
}

export function closeWindow(win) {
  if (!win) return;
  const wasFocused = win.classList.contains("is-focused");
  const wasMaximized = win.classList.contains("is-maximized");
  restoreMaximized(win);
  if (wasMaximized && isTiling()) rememberFreeform(win, true);
  win.hidden = true;
  win.classList.remove("is-open", "is-focused", "is-minimized", "is-dragging", "is-resizing");
  tileOrder = tileOrder.filter((id) => id !== win.dataset.window);
  document.body.classList.remove("is-resizing-window");
  root.style.removeProperty("--os-resize-cursor");
  if (wasFocused) {
    const next = topmostWindow();
    if (next) focusWindow(next);
    else {
      if (activeApp) activeApp.textContent = "Desktop";
      windows.forEach((other) => other.classList.remove("is-focused"));
    }
  }
  applyWindowLayout();
  syncDock();
}

function minimizeWindow(win) {
  if (!win) return;
  const wasFocused = win.classList.contains("is-focused");
  win.classList.add("is-minimized");
  win.classList.remove("is-focused");
  if (wasFocused) {
    const next = topmostWindow();
    if (next) focusWindow(next);
    else if (activeApp) activeApp.textContent = "Desktop";
  }
  applyWindowLayout();
  syncDock();
}

function restoreMaximized(win) {
  if (!win.classList.contains("is-maximized")) return;
  const previous = win.dataset.restore;
  if (previous) {
    try {
      const saved = JSON.parse(previous);
      for (const [prop, value] of Object.entries(saved)) {
        if (value == null || value === "") win.style.removeProperty(prop);
        else win.style.setProperty(prop, value);
      }
    } catch {
      /* ignore */
    }
  }
  delete win.dataset.restore;
  win.classList.remove("is-maximized");
}

function maximizeWindow(win) {
  if (!win) return;
  if (isTiling()) return;
  if (win.classList.contains("is-maximized")) {
    restoreMaximized(win);
    focusWindow(win);
    return;
  }
  const saved = {};
  for (const prop of ["left", "top", "right", "bottom", "width", "height"]) {
    saved[prop] = win.style.getPropertyValue(prop) || "";
  }
  win.dataset.restore = JSON.stringify(saved);
  win.classList.add("is-maximized");
  win.style.left = "8px";
  win.style.top = "8px";
  win.style.right = "8px";
  win.style.bottom = "8px";
  win.style.width = "auto";
  win.style.height = "auto";
  focusWindow(win);
}

function startDrag(event, win) {
  if (window.innerWidth <= 820 || isTiling()) return;
  if (event.button !== 0 || win.classList.contains("is-maximized")) return;
  if (event.target.closest("button, a, input, select, .os-eq")) return;
  focusWindow(win);

  const desktopRect = desktop.getBoundingClientRect();
  const rect = win.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const width = rect.width;
  const height = rect.height;

  win.style.left = `${rect.left - desktopRect.left}px`;
  win.style.top = `${rect.top - desktopRect.top}px`;
  win.style.right = "auto";
  win.style.bottom = "auto";
  win.style.width = `${width}px`;
  win.style.height = `${height}px`;
  win.classList.add("is-dragging");

  function move(moveEvent) {
    const rawLeft = moveEvent.clientX - desktopRect.left - offsetX;
    const rawTop = moveEvent.clientY - desktopRect.top - offsetY;
    const left = Math.max(160 - width, Math.min(desktopRect.width - 140, rawLeft));
    const top = Math.max(0, Math.min(desktopRect.height - 42, rawTop));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  function end() {
    win.classList.remove("is-dragging");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    syncDock();
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  event.preventDefault();
}

function addResizeHandles(win) {
  RESIZE_DIRECTIONS.forEach((direction) => {
    const handle = document.createElement("div");
    handle.className = `os-resize-handle os-resize-handle--${direction}`;
    handle.dataset.resize = direction;
    handle.setAttribute("aria-hidden", "true");
    if (direction === "se") {
      handle.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#i-resize"/></svg>';
    }
    handle.addEventListener("pointerdown", (event) => startResize(event, win, direction));
    win.appendChild(handle);
  });
}

function startResize(event, win, direction) {
  if (window.innerWidth <= 820 || isTiling()) return;
  if (event.button !== 0 || win.classList.contains("is-maximized")) return;

  focusWindow(win);

  const desktopRect = desktop.getBoundingClientRect();
  const rect = win.getBoundingClientRect();
  const start = {
    left: rect.left - desktopRect.left,
    top: rect.top - desktopRect.top,
    width: rect.width,
    height: rect.height,
  };
  const startRight = start.left + start.width;
  const startBottom = start.top + start.height;
  const east = direction.includes("e");
  const west = direction.includes("w");
  const south = direction.includes("s");
  const north = direction.includes("n");

  win.style.left = `${start.left}px`;
  win.style.top = `${start.top}px`;
  win.style.right = "auto";
  win.style.bottom = "auto";
  win.style.width = `${start.width}px`;
  win.style.height = `${start.height}px`;
  win.classList.add("is-resizing");
  root.style.setProperty("--os-resize-cursor", RESIZE_CURSORS[direction]);
  document.body.classList.add("is-resizing-window");

  function move(moveEvent) {
    const dx = moveEvent.clientX - event.clientX;
    const dy = moveEvent.clientY - event.clientY;
    let { left, top, width, height } = start;

    if (east) {
      const maxWidth = Math.max(MIN_WINDOW_WIDTH, desktopRect.width - start.left);
      width = Math.min(Math.max(MIN_WINDOW_WIDTH, start.width + dx), maxWidth);
    } else if (west) {
      left = Math.max(0, Math.min(start.left + dx, startRight - MIN_WINDOW_WIDTH));
      width = startRight - left;
    }

    if (south) {
      const maxHeight = Math.max(MIN_WINDOW_HEIGHT, desktopRect.height - start.top);
      height = Math.min(Math.max(MIN_WINDOW_HEIGHT, start.height + dy), maxHeight);
    } else if (north) {
      top = Math.max(0, Math.min(start.top + dy, startBottom - MIN_WINDOW_HEIGHT));
      height = startBottom - top;
    }

    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
  }

  function end() {
    win.classList.remove("is-resizing");
    root.style.removeProperty("--os-resize-cursor");
    document.body.classList.remove("is-resizing-window");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  event.preventDefault();
}

windows.forEach((win) => {
  win.addEventListener("pointerdown", () => focusWindow(win), true);
  addResizeHandles(win);

  win.querySelectorAll("[data-drag-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => startDrag(event, win));
    handle.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, a, input")) return;
      maximizeWindow(win);
    });
  });

  win.querySelectorAll("[data-window-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.windowAction;
      if (action === "close") closeWindow(win);
      else if (action === "minimize") minimizeWindow(win);
      else if (action === "maximize") maximizeWindow(win);
    });
  });
});

window.addEventListener("resize", () => {
  if (state.windowLayout === "split") {
    applyWindowLayout();
    return;
  }
  if (window.innerWidth <= 820) return;
  const rect = desktop.getBoundingClientRect();
  windows.forEach((win) => {
    if (!isOpen(win) || win.classList.contains("is-maximized")) return;
    const bounds = win.getBoundingClientRect();
    if (!bounds.width) return;
    const left = bounds.left - rect.left;
    const top = bounds.top - rect.top;
    if (left > rect.width - 140) win.style.left = `${Math.max(0, rect.width - 140)}px`;
    if (top > rect.height - 42) win.style.top = `${Math.max(0, rect.height - 42)}px`;
  });
});

/* ---------------------------------------------------------- layout controls */

syncLayoutControls();
document.querySelectorAll("[data-layout-setting]").forEach((select) => {
  select.addEventListener("change", () => setWindowLayout(select.value));
});
