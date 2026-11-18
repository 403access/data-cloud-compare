/* Aether OS — pre-paint theme boot
   Runs as a classic script before the stylesheets so the desktop never
   flashes a different theme, font size, or menu-bar meter finish. */

/* Apply saved preferences before paint. */
(function () {
  try {
    var root = document.documentElement;
    var prefs = JSON.parse(localStorage.getItem("dcc-design-prefs") || "null") || {};
    var water = JSON.parse(localStorage.getItem("explorer-water-settings") || "null") || {};
    var mode = localStorage.getItem("explorer-theme") || "water";
    if (["system", "light", "dark", "water"].indexOf(mode) === -1) mode = "water";
    var light = mode === "light" || (mode === "system" && window.matchMedia && !window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.waterMode = mode;
    root.dataset.theme = light ? "light" : "dark";
    var tone = water.tone || prefs.tone;
    if (["lagoon", "ocean", "deep"].indexOf(tone) !== -1) root.dataset.waterTone = tone;
    var speed = water.speed || prefs.speed;
    if (["calm", "flowing", "rapid"].indexOf(speed) !== -1) root.dataset.waterSpeed = speed;
    var background = water.background || prefs.background;
    if (background === "still" || background === "sea") root.dataset.waterBackground = background;
    var storedFont = localStorage.getItem("explorer-os-font-size");
    var fontSize = storedFont || water.fontSize || prefs.fontSize;
    if (["compact", "comfortable", "large"].indexOf(fontSize) === -1) fontSize = "comfortable";
    root.dataset.fontSize = fontSize;
    var effects = water.effects !== false && (typeof water.effects === "boolean" || prefs.effects !== false);
    root.dataset.waterEffects = effects && mode === "water" ? "on" : "off";
    root.dataset.waterGlass = water.glass === false ? "off" : "on";
    root.dataset.waterRowMotion = water.rowMotion === false ? "off" : "on";
    var windowWave = localStorage.getItem("explorer-os-window-wave") || water.windowWave;
    if (["off", "calm", "tide", "surge"].indexOf(windowWave) === -1) windowWave = "tide";
    root.dataset.waterWindowWave = windowWave;
    var osSettings = {};
    try {
      osSettings = JSON.parse(localStorage.getItem("explorer-os-settings-v1") || "null") || {};
    } catch (e) {
      osSettings = {};
    }
    root.dataset.desktopIcons = osSettings.desktopIcons === true ? "on" : "off";
    root.dataset.desktopWidgets = osSettings.desktopWidgets === true ? "on" : "off";
    root.dataset.dock = osSettings.dockEnabled === true ? "on" : "off";
    root.dataset.dockMagnify = osSettings.dockMagnify === true ? "on" : "off";
    var dockPosition = osSettings.dockPosition;
    if (["bottom", "left", "right"].indexOf(dockPosition) === -1) dockPosition = "bottom";
    root.dataset.dockPosition = dockPosition;
    var dockSize = Number(osSettings.dockSize);
    if (!isFinite(dockSize)) dockSize = 48;
    dockSize = Math.min(72, Math.max(32, dockSize));
    root.style.setProperty("--os-dock-size", dockSize + "px");
    var resourceDisplay = {};
    try {
      resourceDisplay = JSON.parse(localStorage.getItem("explorer-os-resource-display") || "null") || {};
    } catch (e) {
      resourceDisplay = {};
    }
    root.dataset.resourceVisible = resourceDisplay.visible === false ? "off" : "on";
    root.dataset.resourceBorder = resourceDisplay.border === true ? "on" : "off";
    root.dataset.resourceCaptions = resourceDisplay.captions === false ? "off" : "on";
    root.dataset.resourceBars = resourceDisplay.bars === false ? "off" : "on";
    root.dataset.resourceValues = resourceDisplay.values === false ? "off" : "on";
    root.dataset.resourceDividers =
      resourceDisplay.version === 2 && resourceDisplay.dividers === true ? "on" : "off";
  } catch (e) {}
})();
