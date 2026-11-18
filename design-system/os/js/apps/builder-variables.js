/* Aether OS — App Studio system variables
   A live catalog of everything the desktop knows about: system identity,
   appearance tokens, resources, connected hardware, the explorer model, media,
   the terminal, and the studio itself. Values are recomputed on demand, so a
   project bound to a variable stays in sync with the rest of the OS. */

import { DATA } from "../core/data.js";
import {
  PROVIDERS, THEME_LABELS, TONES, WINDOW_WAVES, resolvedTheme, root, state,
} from "../core/state.js";
import { batteryState, batteryTime } from "./battery.js";
import {
  calendarAppSelected, calendarDayFormat, calendarEventsFor,
} from "./calendar.js";
import { NETWORKS, NETWORK_DETAILS, networkState } from "./network.js";
import { devicesState } from "./devices.js";
import { isPlaying, trackArtist, trackTitle } from "./music.js";
import { soundState } from "./sound.js";
import {
  taskProcessCount, taskTotals, topProcess,
} from "./task-manager.js";
import {
  MEMORY_TOTAL_GB, STORAGE_FREE_GB, STORAGE_TOTAL_GB,
} from "./task-processes.js";
import { TERM_PROMPT, TERM_SNAPSHOTS } from "./terminal.js";

const shortDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short", day: "numeric", month: "short",
});
const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const monthName = new Intl.DateTimeFormat(undefined, { month: "long" });
const weekdayName = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const clockTime = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit", minute: "2-digit",
});

const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

function valueLabel(value, kind, digits = 0, unit = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "boolean") return value ? "On" : "Off";
  if (kind === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `${number.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}${unit}`;
  }
  return String(value);
}

function makeVariable(group, id, label, kind, value, extra = {}) {
  const digits = extra.digits ?? 0;
  const unit = extra.unit ?? "";
  return {
    group,
    id,
    label,
    kind,
    value,
    unit,
    display: valueLabel(value, kind, digits, unit),
    ...extra,
  };
}

function selectedDayKey(value) {
  const date = value instanceof Date ? value : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function breakpointName(width) {
  if (width <= 560) return "Phone";
  if (width <= 820) return "Tablet";
  if (width <= 1100) return "Compact desktop";
  if (width <= 1400) return "Desktop";
  return "Wide desktop";
}

function windowSummary() {
  const windows = Array.from(document.querySelectorAll("[data-window]"));
  const open = windows.filter((win) => !win.hidden && !win.classList.contains("is-minimized"));
  const focused = windows.find((win) => win.classList.contains("is-focused") && !win.hidden);
  return {
    total: windows.length,
    open: open.length,
    focused: focused?.dataset.title || "Desktop",
  };
}

function explorerStats() {
  const count = (side, status) => DATA[side].filter((entry) => entry.status === status).length;
  const dirs = (side) => DATA[side].filter((entry) => entry.isDir).length;
  const files = (side) => DATA[side].filter((entry) => !entry.isDir).length;
  return {
    localDirs: dirs("local"),
    remoteDirs: dirs("remote"),
    localFiles: files("local"),
    remoteFiles: files("remote"),
    exact: count("remote", "exact"),
    moved: count("remote", "moved"),
    possible: count("remote", "possible"),
    partial: count("remote", "partial"),
    missing: count("remote", "missing"),
    localOnly: count("local", "local_only"),
    typeMismatch: count("local", "type_mismatch") + count("remote", "type_mismatch"),
  };
}

/**
 * Build the full variable catalog.
 * @param {{projects?: number, custom?: number, selected?: string, nodes?: number}} studio
 */
export function systemVariables(studio = null) {
  const variables = [];
  const group = (name) => (id, label, kind, value, extra = {}) => {
    variables.push(makeVariable(name, id, label, kind, value, extra));
  };

  const now = new Date();
  const totals = taskTotals();
  const bestTask = topProcess();
  const explorer = explorerStats();
  const currentNetwork = networkState.wifi
    ? NETWORKS.find((network) => network.name === networkState.connected) || null
    : null;
  const currentDevice = (id) => devicesState.devices.find((device) => device.id === id) || null;
  const artistText = trackArtist?.textContent || "Tide Ensemble · 04:32";
  const [mediaArtist, mediaDuration] = artistText.split(" · ");
  const selectedEvents = calendarEventsFor(calendarAppSelected);
  const todayEvents = calendarEventsFor(now);
  const windows = windowSummary();
  const rail = document.querySelector(".os-rail");
  const commandOverlay = document.querySelector("[data-command-overlay]");
  const terminalUser = TERM_PROMPT.user.split("@")[0];
  const terminalHost = TERM_PROMPT.user.split("@")[1] || "water";

  /* ------------------------------------------------------------- system */
  const sys = group("System");
  sys("system.os_name", "OS name", "string", "Aether OS");
  sys("system.os_version", "OS version", "string", "1.0");
  sys("system.os_build", "OS build", "string", "26A341");
  sys("system.kernel", "Kernel", "string", "aether 1.0 · xnu hybrid");
  sys("system.user", "User", "string", "tide");
  sys("system.hostname", "Hostname", "string", "water");
  sys("system.shell", "Login shell", "string", "/bin/zsh");
  sys("system.uptime", "Uptime", "string", "12d 3h");
  sys("system.cores", "CPU cores", "number", 8);
  sys("system.arch", "Architecture", "string", navigator.platform || "MacIntel");
  sys("system.locale", "Locale", "string", navigator.language || "en");
  sys("system.timezone", "Time zone", "string", Intl.DateTimeFormat().resolvedOptions().timeZone || "Local");
  sys("system.mode", "Storage mode", "string", "Local-first · read-only");
  sys("system.demo", "Concept build", "boolean", true);

  /* ------------------------------------------------------- display + look */
  const display = group("Display & appearance");
  display("display.width", "Viewport width", "number", window.innerWidth, { unit: " px" });
  display("display.height", "Viewport height", "number", window.innerHeight, { unit: " px" });
  display("display.dpr", "Pixel ratio", "number", window.devicePixelRatio || 1, { digits: 1 });
  display("display.breakpoint", "Layout breakpoint", "string", breakpointName(window.innerWidth));
  display("appearance.theme_mode", "Theme mode", "string", THEME_LABELS[state.themeMode] || state.themeMode);
  display("appearance.resolved_theme", "Resolved theme", "string", resolvedTheme());
  display("appearance.tone", "Water tone", "string", TONES[state.water.tone] || state.water.tone);
  display("appearance.background", "Background", "string", state.water.background === "sea" ? "Sea and waves" : "Still gradient");
  display("appearance.font_size", "Font size", "string", state.water.fontSize);
  display("appearance.effects", "Water effects", "boolean", state.water.effects);
  display("appearance.drips", "Cursor drips", "boolean", state.water.drips);
  display("appearance.ripples", "Click ripples", "boolean", state.water.clickRipples);
  display("appearance.caustics", "Caustic shimmer", "boolean", state.water.caustics);
  display("appearance.row_motion", "Row motion", "boolean", state.water.rowMotion);
  display("appearance.glass", "Glass surfaces", "boolean", state.water.glass);
  display("appearance.window_wave", "Window waves", "string", WINDOW_WAVES.includes(state.water.windowWave) ? state.water.windowWave : "tide");
  display("appearance.speed", "Flow speed", "string", state.water.speed);
  display("appearance.intensity", "Drip energy", "string", state.water.intensity);
  display("appearance.rail_visible", "Desktop widgets", "boolean", rail ? getComputedStyle(rail).display !== "none" : false);

  /* ------------------------------------------------------------ desktop */
  const desktop = group("Desktop shell");
  desktop("desktop.windows", "Window count", "number", windows.total);
  desktop("desktop.open_windows", "Open windows", "number", windows.open);
  desktop("desktop.focused_window", "Focused window", "string", windows.focused);
  desktop("desktop.window_layout", "Window layout", "string", state.windowLayout === "split" ? "Split" : "Overlap");
  desktop("desktop.menu_app", "Menu bar app", "string", document.querySelector("[data-active-app]")?.textContent || "Desktop");
  desktop("desktop.dock_items", "Dock items", "number", document.querySelectorAll(".os-dock__item").length);
  desktop("desktop.command_open", "Command bar open", "boolean", commandOverlay ? !commandOverlay.hidden : false);
  desktop("desktop.menu_meters", "Menu bar meters", "boolean", root.dataset.resourceVisible !== "off");
  desktop("desktop.page_hidden", "Page hidden", "boolean", document.hidden);

  /* ---------------------------------------------------------- resources */
  const resources = group("Resources");
  resources("resource.cpu", "CPU usage", "number", totals.cpu, { unit: "%" });
  resources("resource.memory", "Memory usage", "number", totals.memory, { unit: "%" });
  resources("resource.memory_used", "Memory used", "number", totals.memoryGb, { unit: " GB", digits: 1 });
  resources("resource.memory_total", "Memory installed", "number", MEMORY_TOTAL_GB, { unit: " GB" });
  resources("resource.memory_free", "Memory free", "number", Math.max(0, MEMORY_TOTAL_GB - totals.memoryGb), { unit: " GB", digits: 1 });
  resources("resource.storage_free", "Storage free", "number", STORAGE_FREE_GB, { unit: " GB" });
  resources("resource.storage_free_pct", "Storage free", "number", (STORAGE_FREE_GB / STORAGE_TOTAL_GB) * 100, { unit: "%", digits: 1 });
  resources("resource.storage_total", "Storage capacity", "number", STORAGE_TOTAL_GB, { unit: " GB" });
  resources("resource.storage_used", "Storage used", "number", Math.max(0, STORAGE_TOTAL_GB - STORAGE_FREE_GB), { unit: " GB" });
  resources("resource.storage_used_pct", "Storage used", "number", ((STORAGE_TOTAL_GB - STORAGE_FREE_GB) / STORAGE_TOTAL_GB) * 100, { unit: "%", digits: 1 });
  resources("resource.process_count", "Process count", "number", taskProcessCount());
  resources("resource.top_process", "Top process", "string", bestTask?.name || "—");
  resources("resource.top_process_cpu", "Top process CPU", "number", bestTask?.cpu || 0, { unit: "%", digits: 1 });

  /* ------------------------------------------------------------ battery */
  const battery = group("Battery & power");
  battery("battery.level", "Charge level", "number", batteryState.level, { unit: "%" });
  battery("battery.state", "Power state", "string", batteryState.charging ? "Charging" : "On battery");
  battery("battery.time", "Time remaining", "string", batteryTime());
  battery("battery.mode", "Energy mode", "string", { low: "Low power", balanced: "Balanced", high: "High performance" }[batteryState.mode] || batteryState.mode);
  battery("battery.low_power", "Low power mode", "boolean", batteryState.lowPower);
  battery("battery.optimized", "Optimised charging", "boolean", batteryState.optimized);
  battery("battery.health", "Battery health", "number", 96, { unit: "%" });
  battery("battery.cycles", "Cycle count", "number", 214);
  battery("battery.temperature", "Temperature", "number", 31, { unit: " °C" });
  battery("battery.charging", "Charging", "boolean", batteryState.charging);

  /* ------------------------------------------------------------ network */
  const network = group("Network");
  network("network.wifi", "Wi-Fi", "boolean", networkState.wifi);
  network("network.state", "Connection state", "string", networkState.wifi ? "Connected" : "Off");
  network("network.ssid", "Network name", "string", networkState.wifi ? networkState.connected : "Wi-Fi off");
  network("network.band", "Band", "string", currentNetwork?.band || "—");
  network("network.security", "Security", "string", currentNetwork?.security || "—");
  network("network.signal", "Signal", "number", currentNetwork?.strength || 0, { unit: " / 4" });
  network("network.vpn", "VPN", "boolean", networkState.vpn);
  network("network.vpn_state", "VPN state", "string", networkState.vpn ? "Connected" : "Off");
  network("network.ip", "IP address", "string", NETWORK_DETAILS.ip);
  network("network.router", "Router", "string", NETWORK_DETAILS.router);
  network("network.dns", "DNS", "string", NETWORK_DETAILS.dns);
  network("network.mac", "MAC address", "string", NETWORK_DETAILS.mac);
  network("network.available", "Nearby networks", "number", NETWORKS.length);
  network("network.known", "Known networks", "number", NETWORKS.filter((item) => item.known).length);

  /* ------------------------------------------------------------ devices */
  const devices = group("Devices");
  const accessory = (key, label) => {
    const device = currentDevice(key);
    devices(`device.${key.replace(/-/g, "_")}.battery`, `${label} battery`, "number", device?.battery ?? 0, { unit: "%" });
    devices(`device.${key.replace(/-/g, "_")}.connected`, `${label} connected`, "boolean", Boolean(device?.connected));
  };
  devices("devices.bluetooth", "Bluetooth", "boolean", devicesState.bluetooth);
  devices("devices.discoverable", "Discoverable", "boolean", devicesState.discoverable);
  devices("devices.paired", "Paired accessories", "number", devicesState.devices.length);
  devices("devices.connected", "Connected accessories", "number", devicesState.devices.filter((device) => device.connected).length);
  devices("devices.summary", "Accessory summary", "string", devicesState.bluetooth ? `On · ${devicesState.devices.filter((device) => device.connected).length} accessories connected` : "Bluetooth is off");
  accessory("tide-mouse", "Tide Mouse");
  accessory("harbour-keyboard", "Harbour Keyboard");
  accessory("drift-earbuds", "Drift Earbuds");

  /* ------------------------------------------------------ clock + dates */
  const time = group("Time & calendar");
  time("clock.time", "Clock time", "string", clockTime.format(now));
  time("clock.date", "Date", "string", shortDate.format(now));
  time("clock.long_date", "Long date", "string", longDate.format(now));
  time("clock.weekday", "Weekday", "string", weekdayName.format(now));
  time("clock.month", "Month", "string", monthName.format(calendarAppSelected));
  time("clock.year", "Year", "number", calendarAppSelected.getFullYear());
  time("calendar.selected", "Selected day", "string", calendarDayFormat.format(calendarAppSelected));
  time("calendar.selected_key", "Selected day key", "string", selectedDayKey(calendarAppSelected));
  time("calendar.events", "Events on selected day", "number", selectedEvents.length);
  time("calendar.event_titles", "Selected day agenda", "string", selectedEvents.map((event) => `${event.time} ${event.title}`).join(" · ") || "Nothing scheduled");
  time("calendar.today_events", "Events today", "number", todayEvents.length);

  /* ----------------------------------------------------------- explorer */
  const exp = group("Explorer model");
  exp("explorer.provider", "Provider key", "string", state.provider);
  exp("explorer.provider_label", "Provider", "string", PROVIDERS[state.provider]?.label || state.provider);
  exp("explorer.remote_root", "Remote root", "string", PROVIDERS[state.provider]?.root || "Archive");
  exp("explorer.local_root", "Local root", "string", "/mnt/tank");
  exp("explorer.side", "Active pane", "string", state.activeSide === "local" ? "Local index" : PROVIDERS[state.provider]?.label || "Remote");
  exp("explorer.local_items", "Local items", "number", DATA.local.length);
  exp("explorer.remote_items", "Remote items", "number", DATA.remote.length);
  exp("explorer.local_dirs", "Local folders", "number", explorer.localDirs);
  exp("explorer.remote_dirs", "Remote folders", "number", explorer.remoteDirs);
  exp("explorer.local_files", "Local files", "number", explorer.localFiles);
  exp("explorer.remote_files", "Remote files", "number", explorer.remoteFiles);
  exp("explorer.local_size", "Local size", "string", "6.41 TB");
  exp("explorer.remote_size", "Remote size", "string", "6.50 TB");
  exp("explorer.exact", "Same paths", "number", explorer.exact);
  exp("explorer.moved", "Moved items", "number", explorer.moved);
  exp("explorer.possible", "Possible matches", "number", explorer.possible);
  exp("explorer.partial", "Partial folders", "number", explorer.partial);
  exp("explorer.missing", "Missing items", "number", explorer.missing);
  exp("explorer.local_only", "Local only", "number", explorer.localOnly);
  exp("explorer.type_mismatch", "Type differs", "number", explorer.typeMismatch);
  exp("explorer.selected", "Selected item", "string", state.selected ? `${state.selected.side === "local" ? "Local" : "Remote"} · ${state.selected.name}` : "None");
  exp("explorer.columns", "Visible columns", "number", state.columns.size);
  exp("explorer.columns_list", "Column list", "string", [...state.columns].join(", "));
  exp("explorer.sort", "Sort", "string", `${state.sort[state.activeSide]?.id || "name"} ${state.sort[state.activeSide]?.dir || "asc"}`);
  exp("explorer.filters", "Active filters", "number", state.filters.local.size + state.filters.remote.size);
  exp("explorer.hidden", "Show dotfiles", "boolean", state.hidden);
  exp("explorer.search", "Search query", "string", state.search[state.activeSide] || "—");
  exp("explorer.size_mode", "Size mode", "string", state.sizeMode);
  exp("explorer.side_panel", "Side panel", "string", state.sidePanel ? state.sidePanel[0].toUpperCase() + state.sidePanel.slice(1) : "Closed");

  /* -------------------------------------------------------------- media */
  const media = group("Tide Radio & sound");
  media("media.track", "Track title", "string", trackTitle?.textContent || "Deep Current");
  media("media.artist", "Track artist", "string", mediaArtist || "Tide Ensemble");
  media("media.duration", "Track duration", "string", mediaDuration || "04:32");
  media("media.album", "Album", "string", "Aether OS Sessions");
  media("media.playing", "Playing", "boolean", isPlaying());
  media("media.progress", "Playback progress", "string", document.querySelector("[data-track-fill]")?.style.width || "38%");
  media("sound.volume", "Volume", "number", soundState.volume, { unit: "%" });
  media("sound.muted", "Muted", "boolean", soundState.muted);
  media("sound.output", "Output device", "string", soundState.output);

  /* ----------------------------------------------------------- terminal */
  const terminal = group("Terminal");
  terminal("terminal.user", "Shell user", "string", terminalUser);
  terminal("terminal.host", "Shell host", "string", terminalHost);
  terminal("terminal.cwd", "Working directory", "string", TERM_PROMPT.path);
  terminal("terminal.prompt", "Prompt", "string", `${TERM_PROMPT.user} ${TERM_PROMPT.path}`);
  terminal("terminal.snapshot_entries", "Snapshot entries", "string", TERM_SNAPSHOTS.jottacloud.entries);
  terminal("terminal.report", "Last report", "string", TERM_SNAPSHOTS.jottacloud.report);

  /* ------------------------------------------------------ design tokens */
  const tokens = group("Design tokens");
  const token = (id, label, name) => tokens(id, label, "color", cssVar(name) || "—", { swatch: true });
  token("token.accent", "Accent", "--ds-accent");
  token("token.accent_strong", "Accent strong", "--ds-accent-strong");
  token("token.text", "Text", "--ds-text");
  token("token.text_2", "Text secondary", "--ds-text-2");
  token("token.text_3", "Text tertiary", "--ds-text-3");
  token("token.surface", "Surface", "--ds-surface");
  token("token.surface_solid", "Surface solid", "--ds-surface-solid");
  token("token.line", "Line", "--ds-line");
  token("token.green", "Green", "--ds-green");
  token("token.blue", "Blue", "--ds-blue");
  token("token.amber", "Amber", "--ds-amber");
  token("token.red", "Red", "--ds-red");
  token("token.violet", "Violet", "--ds-violet");
  tokens("token.radius_md", "Radius medium", "string", cssVar("--ds-radius-md") || "10px");
  tokens("token.shadow", "Shadow", "string", cssVar("--ds-shadow") || "Soft elevation");
  tokens("token.font", "Font family", "string", cssVar("--ds-font") || "System sans");

  /* ----------------------------------------------------------- studio */
  if (studio) {
    const appStudio = group("App Studio");
    appStudio("builder.projects", "Projects", "number", studio.projects ?? 0);
    appStudio("builder.custom", "Custom apps", "number", studio.custom ?? 0);
    appStudio("builder.selected", "Selected app", "string", studio.selected || "—");
    appStudio("builder.nodes", "Components", "number", studio.nodes ?? 0);
    appStudio("builder.variables", "Variables", "number", variables.length + 5);
  }

  return variables;
}