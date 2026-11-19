/** Keyboard shortcut catalog, default key map and local persistence. */

export type ShortcutId =
  | "command-palette"
  | "close-window"
  | "new-terminal"
  | "open-instance"
  | "explorer"
  | "narrow-master"
  | "chat"
  | "widen-master"
  | "audio-routes"
  | "move-float"
  | "shortcuts-cheatsheet"
  | "resize-floating"
  | "focus-next-mru"
  | "switch-workspace"
  | "focus-previous-mru"
  | "move-window-workspace"
  | "focus-next"
  | "move-selection"
  | "activate-selection"
  | "maximize-restore"
  | "page-lists"
  | "fullscreen-restore"
  | "cycle-audio-latency"
  | "close-overlay";

export type ShortcutSectionId = "surfaces" | "overlays";
export type ShortcutGroupId = "windows" | "layout" | "workspaces" | "overlays";

export interface ShortcutGroup {
  id: ShortcutGroupId;
  label: string;
  section: ShortcutSectionId;
}

export interface ShortcutDef {
  id: ShortcutId;
  label: string;
  group: ShortcutGroupId;
  /** The "Simple (default)" key map. Empty means unbound. */
  defaults: string[];
  /** Pointer gestures are documented but cannot be captured as a key. */
  pointer?: boolean;
}

export type ShortcutBindings = Record<ShortcutId, string[]>;

export const SHORTCUT_STORAGE_KEY = "explorer-shortcuts";

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { id: "windows", label: "Windows", section: "surfaces" },
  { id: "layout", label: "Layout", section: "surfaces" },
  { id: "workspaces", label: "Workspaces", section: "surfaces" },
  { id: "overlays", label: "Overlays", section: "overlays" },
];

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Windows
  { id: "command-palette", label: "Command palette", group: "windows", defaults: ["Ctrl+Alt+Space"] },
  { id: "close-window", label: "Close window", group: "windows", defaults: ["Ctrl+Alt+Q"] },
  { id: "new-terminal", label: "New terminal", group: "windows", defaults: ["Ctrl+Alt+Return"] },
  {
    id: "open-instance",
    label: "Open another instance",
    group: "windows",
    defaults: ["Middle click", "Shift+click"],
    pointer: true,
  },

  // Layout
  { id: "explorer", label: "Explorer", group: "layout", defaults: ["Ctrl+Alt+E"] },
  { id: "narrow-master", label: "Narrow master", group: "layout", defaults: ["Ctrl+Alt+H"] },
  { id: "chat", label: "Chat", group: "layout", defaults: ["Ctrl+Alt+C"] },
  { id: "widen-master", label: "Widen master", group: "layout", defaults: ["Ctrl+Alt+L"] },
  { id: "audio-routes", label: "Audio routes", group: "layout", defaults: ["Ctrl+Alt+A"] },
  { id: "move-float", label: "Move / float window", group: "layout", defaults: ["Alt+Left drag"], pointer: true },
  { id: "shortcuts-cheatsheet", label: "Shortcut cheat sheet", group: "layout", defaults: ["Ctrl+Alt+/"] },
  { id: "resize-floating", label: "Resize floating window", group: "layout", defaults: ["Alt+Right drag"], pointer: true },

  // Workspaces
  { id: "focus-next-mru", label: "Focus next (MRU)", group: "workspaces", defaults: ["Ctrl+Alt+Tab"] },
  {
    id: "switch-workspace",
    label: "Switch workspace",
    group: "workspaces",
    defaults: ["Ctrl+Alt+1", "Ctrl+Alt+2", "Ctrl+Alt+3"],
  },
  { id: "focus-previous-mru", label: "Focus previous (MRU)", group: "workspaces", defaults: ["Ctrl+Alt+Shift+Tab"] },
  {
    id: "move-window-workspace",
    label: "Move window to workspace",
    group: "workspaces",
    defaults: ["Ctrl+Alt+Shift+1", "Ctrl+Alt+Shift+2", "Ctrl+Alt+Shift+3"],
  },

  // Overlays
  { id: "focus-next", label: "Focus next", group: "overlays", defaults: ["Ctrl+Alt+J"] },
  { id: "move-selection", label: "Move selection", group: "overlays", defaults: ["Ctrl+Alt+K"] },
  { id: "activate-selection", label: "Activate selection", group: "overlays", defaults: ["Enter"] },
  { id: "maximize-restore", label: "Maximize / restore", group: "overlays", defaults: ["Ctrl+Alt+M"] },
  { id: "page-lists", label: "Page lists / chat", group: "overlays", defaults: ["PgUp", "PgDn"] },
  { id: "fullscreen-restore", label: "Fullscreen / restore", group: "overlays", defaults: ["Ctrl+Alt+F"] },
  { id: "cycle-audio-latency", label: "Cycle audio latency preset", group: "overlays", defaults: ["P"] },
  { id: "close-overlay", label: "Close overlay", group: "overlays", defaults: ["Esc"] },
];

export const DEFAULT_SHORTCUTS: ShortcutBindings = Object.fromEntries(
  SHORTCUT_DEFS.map((def) => [def.id, [...def.defaults]]),
) as ShortcutBindings;

export function cloneShortcutBindings(source: ShortcutBindings = DEFAULT_SHORTCUTS): ShortcutBindings {
  const next = {} as ShortcutBindings;
  for (const def of SHORTCUT_DEFS) next[def.id] = [...source[def.id]];
  return next;
}

export function shortcutsForGroup(group: ShortcutGroupId): ShortcutDef[] {
  return SHORTCUT_DEFS.filter((def) => def.group === group);
}

export function shortcutDef(id: ShortcutId): ShortcutDef {
  return SHORTCUT_DEFS.find((def) => def.id === id)!;
}

/** The first definition that already owns one of these combos, if any. */
export function conflictingShortcut(
  bindings: ShortcutBindings,
  id: ShortcutId,
  combos: string[],
): ShortcutDef | null {
  const wanted = new Set(combos);
  for (const def of SHORTCUT_DEFS) {
    if (def.id === id) continue;
    if (bindings[def.id].some((combo) => wanted.has(combo))) return def;
  }
  return null;
}

export function shortcutLabel(combos: string[]): string {
  return combos.length ? combos.join(" / ") : "Unassigned";
}

export function readShortcutBindings(): ShortcutBindings {
  const next = cloneShortcutBindings();
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const def of SHORTCUT_DEFS) {
      const value = parsed?.[def.id];
      if (!Array.isArray(value)) continue;
      const combos = value
        .filter((combo): combo is string => typeof combo === "string")
        .map((combo) => combo.trim())
        .filter(Boolean)
        .slice(0, 4);
      next[def.id] = combos;
    }
  } catch {
    /* localStorage can be unavailable or hold stale JSON */
  }
  return next;
}

export function saveShortcutBindings(bindings: ShortcutBindings): void {
  try {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore quota and private-mode failures */
  }
}

const SPECIAL_KEYS: Record<string, string> = {
  " ": "Space",
  "\u00a0": "Space",
  Escape: "Esc",
  Enter: "Return",
  Tab: "Tab",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Backspace: "Backspace",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  Insert: "Insert",
};

const MODIFIER_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "AltGraph",
  "CapsLock",
  "Fn",
  "OS",
]);

const CODE_KEYS: Record<string, string> = {
  Space: "Space",
  Slash: "/",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Backquote: "`",
  Enter: "Return",
  Escape: "Esc",
  Tab: "Tab",
};

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return CODE_KEYS[code] ?? null;
}

/** Normalise a keyboard event to the key names used in the key map. */
export function keyFromEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const codeKey = keyFromCode(event.code);
  let key = SPECIAL_KEYS[event.key] ?? event.key;

  // Option/Alt on macOS can turn letters and punctuation into accented glyphs.
  if (event.altKey && key.length === 1 && key.charCodeAt(0) > 126) {
    key = codeKey ?? key;
  }
  // Shift turns digits and punctuation into their symbols; the map names the
  // physical key so "Ctrl+Alt+Shift+1" stays readable.
  if (event.shiftKey && codeKey && /^[0-9]$/.test(codeKey)) key = codeKey;
  if (event.shiftKey && codeKey && Object.values(CODE_KEYS).includes(codeKey)) key = codeKey;
  if (key.length === 1 && /[a-z]/.test(key)) key = key.toUpperCase();
  return key;
}

function modifierParts(event: KeyboardEvent): string[] {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  return parts;
}

/** Build a stored combo such as "Ctrl+Alt+Space" from a keydown event. */
export function comboFromEvent(event: KeyboardEvent): string | null {
  const key = keyFromEvent(event);
  if (!key) return null;
  return [...modifierParts(event), key].join("+");
}

/** Human-readable modifier preview while the user is still holding keys. */
export function modifierPreview(event: KeyboardEvent): string | null {
  const parts = modifierParts(event);
  return parts.length ? `${parts.join("+")}+…` : null;
}

function parseCombo(combo: string): { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; key: string } {
  const parts = combo.split("+");
  const key = parts.pop() ?? "";
  return {
    ctrl: parts.includes("Ctrl"),
    alt: parts.includes("Alt"),
    shift: parts.includes("Shift"),
    meta: parts.includes("Super") || parts.includes("Meta"),
    key,
  };
}

/** Does a keydown event match one of the combos? */
export function shortcutMatches(event: KeyboardEvent, combos: string[] | string): boolean {
  if (event.repeat) return false;
  const list = typeof combos === "string" ? [combos] : combos;
  if (!list.length) return false;
  const key = keyFromEvent(event);
  if (!key) return false;
  return list.some((combo) => {
    const parsed = parseCombo(combo);
    return (
      parsed.key === key &&
      parsed.ctrl === event.ctrlKey &&
      parsed.alt === event.altKey &&
      parsed.shift === event.shiftKey &&
      parsed.meta === event.metaKey
    );
  });
}
