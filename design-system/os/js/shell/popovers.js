/* Aether OS — menu bar popovers
   Menu menus and tray panels share one dismissal model: only one of them is
   ever open at a time. */

/* ------------------------------------------------------------ tray menus */

const trayPanels = Array.from(document.querySelectorAll("[data-tray]"));
const trayToggles = new Map();
const trayHooks = new Map();
let openTrayName = null;

trayPanels.forEach((panel) => {
  const toggle = document.querySelector(`[data-tray-toggle="${panel.dataset.tray}"]`);
  if (toggle) trayToggles.set(panel.dataset.tray, toggle);
});

export function registerTray(name, hooks = {}) {
  trayHooks.set(name, hooks);
}

function setTrayOpen(name, open) {
  const panel = trayPanels.find((item) => item.dataset.tray === name);
  if (!panel) return;
  const toggle = trayToggles.get(name);
  if (open) {
    trayPanels.forEach((other) => {
      if (other === panel || other.hidden) return;
      other.hidden = true;
      trayToggles.get(other.dataset.tray)?.setAttribute("aria-expanded", "false");
      trayHooks.get(other.dataset.tray)?.close?.();
    });
    panel.hidden = false;
    toggle?.setAttribute("aria-expanded", "true");
    openTrayName = name;
    trayHooks.get(name)?.open?.();
    panel.focus({ preventScroll: true });
  } else {
    panel.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
    if (openTrayName === name) openTrayName = null;
    trayHooks.get(name)?.close?.();
  }
}

export function closeTrays() {
  if (openTrayName) setTrayOpen(openTrayName, false);
}

trayPanels.forEach((panel) => {
  const name = panel.dataset.tray;
  const toggle = trayToggles.get(name);
  toggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenus();
    setTrayOpen(name, panel.hidden);
  });
});

document.addEventListener("click", (event) => {
  if (!openTrayName) return;
  // Rendered tray rows replace their own nodes during the click, so the event
  // target can already be detached by the time this bubble listener runs.
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  if (path.some((node) => node instanceof Element && node.classList.contains("os-tray-wrap"))) return;
  if (event.target.closest?.(".os-tray-wrap")) return;
  closeTrays();
});

/* -------------------------------------------------------------- menus */

const menuWraps = Array.from(document.querySelectorAll(".os-menu-wrap"));

export function closeMenus(except = null) {
  menuWraps.forEach((wrap) => {
    if (wrap === except) return;
    wrap.querySelector(".os-menu")?.setAttribute("aria-expanded", "false");
    const pop = wrap.querySelector(".os-menu__pop");
    if (pop) pop.hidden = true;
  });
}

function toggleMenu(wrap) {
  const button = wrap.querySelector(".os-menu");
  const pop = wrap.querySelector(".os-menu__pop");
  if (!button || !pop) return;
  closeTrays();
  if (pop.hidden) {
    closeMenus(wrap);
    pop.hidden = false;
    button.setAttribute("aria-expanded", "true");
  } else {
    pop.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
}

function openMenu(wrap) {
  const button = wrap.querySelector(".os-menu");
  const pop = wrap.querySelector(".os-menu__pop");
  if (!button || !pop || !pop.hidden) return;
  closeTrays();
  closeMenus(wrap);
  pop.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

menuWraps.forEach((wrap) => {
  const button = wrap.querySelector(".os-menu");
  button?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(wrap);
  });
  wrap.addEventListener("mouseenter", () => {
    if (!menuWraps.some((other) => other.querySelector(".os-menu__pop")?.hidden === false)) return;
    openMenu(wrap);
  });
});

/* Clicking outside a menu closes it. Trays manage their own outside clicks so
   rendered rows can be replaced mid-event without closing the panel. */
document.addEventListener("click", (event) => {
  if (!event.target.closest(".os-menu-wrap")) closeMenus();
});
