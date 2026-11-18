/* Aether OS — Terminal
   A local-only simulated shell. Commands never leave the page. */

import { DATA } from "../core/data.js";
import { toast } from "../core/toast.js";
import { prefersReducedMotion } from "../core/utils.js";
import { closeWindow, openWindow, windowById } from "../shell/windows.js";

/* ------------------------------------------------------------ terminal */

const terminalEl = document.querySelector("[data-terminal]");
const terminalForm = document.querySelector("[data-terminal-form]");
const terminalInput = document.querySelector("[data-terminal-input]");

const TERM_PROMPT = { user: "tide@water", path: "~/tank" };

const TERM_SNAPSHOTS = {
  jottacloud: {
    root: "Archive",
    entries: "1,434,971",
    report: "~/tank/Reports/aurora-2026-11-17.json",
  },
  google_drive: {
    root: "My Drive",
    entries: "1,402,118",
    report: "~/tank/Reports/drive-2026-11-17.json",
  },
};

const TERM_FILES = {
  "README.md": [
    "# Tank ⇄ cloud compare",
    "",
    "A read-only view of what the local index and the cloud snapshot agree on.",
    "Nothing here writes to the remote; the archive is opened rclone read-only.",
  ],
  "CHANGELOG.md": [
    "## 2026-11-17",
    "- Fuzzy matching for renamed folders",
    "- Partial files reported separately from missing ones",
    "",
    "## 2026-10-02",
    "- First snapshot of the read-only comparison",
  ],
  ".projects.json": [
    "{",
    '  "archive": "/mnt/tank",',
    '  "provider": "jottacloud",',
    '  "mode": "read-only",',
    '  "entries": 1434971',
    "}",
  ],
};

let terminalTimers = [];

function terminalStop() {
  terminalTimers.forEach((id) => window.clearTimeout(id));
  terminalTimers = [];
}

function terminalSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;
  if (text != null) span.textContent = text;
  return span;
}

function terminalAppend(node) {
  if (!terminalEl) return node;
  if (terminalForm) terminalEl.insertBefore(node, terminalForm);
  else terminalEl.append(node);
  terminalEl.scrollTop = terminalEl.scrollHeight;
  return node;
}

function terminalLine(className = "") {
  const line = document.createElement("div");
  line.className = className ? `os-term-line ${className}` : "os-term-line";
  return terminalAppend(line);
}

function terminalText(text, className = "") {
  const line = terminalLine(className);
  line.textContent = text === "" ? "\u00a0" : text;
  return line;
}

function terminalEcho(command) {
  const line = terminalLine();
  line.append(
    terminalSpan("os-term-prompt", TERM_PROMPT.user),
    terminalSpan("os-term-path", TERM_PROMPT.path),
    terminalSpan("os-term-cmd", command),
  );
}

function terminalStats(pairs) {
  const line = terminalLine();
  pairs.forEach(([label, value], index) => {
    if (index) line.append(" ");
    line.append(terminalSpan("os-term-key", label), ` ${value} `);
  });
}

function terminalCompare(provider = "jottacloud") {
  if (!terminalEl) return;
  terminalStop();
  const key = /^(gdrive|google|google[-_ ]?drive)$/i.test(provider) ? "google_drive" : provider;
  const snapshot = TERM_SNAPSHOTS[key] ?? TERM_SNAPSHOTS.jottacloud;
  const steps = [
    () => terminalText("Reading local index · 2,431,882 entries", "os-term-muted"),
    () => terminalText(`Reading ${snapshot.root} snapshot · ${snapshot.entries} entries`, "os-term-muted"),
    () => terminalText("✓ Comparison complete in 42.8s", "os-term-ok"),
    () => terminalStats([["same", "1,256,127"], ["moved", "3,204"], ["maybe", "1,873"]]),
    () => terminalStats([["partial", "8,412"], ["missing", "176,971"], ["local", "18,204"]]),
    () => terminalText(`Report written to ${snapshot.report}`, "os-term-muted"),
  ];
  const gap = prefersReducedMotion() ? 0 : 140;
  steps.forEach((step, index) => {
    terminalTimers.push(window.setTimeout(step, gap * index));
  });
}

function terminalList() {
  if (!terminalEl) return;
  const names = new Set();
  for (const entry of DATA.remote) {
    const parts = entry.path.split("/");
    if (parts.length === 3 && parts[2]) names.add(parts[2]);
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const line = terminalLine();
  line.append(terminalSpan("os-term-key", `${sorted.length} entries`), `  ${sorted.join("   ")}`);
}

function terminalCat(name) {
  if (!name) {
    terminalText("cat: missing file operand", "os-term-error");
    return;
  }
  const file = TERM_FILES[name.replace(/^\.\//, "")];
  if (!file) {
    terminalText(`cat: ${name}: No such file or directory`, "os-term-error");
    return;
  }
  file.forEach((line) => terminalText(line));
}

function terminalOpen(name) {
  const id = name?.toLowerCase();
  const win = id ? windowById(id) : null;
  if (!win) {
    terminalText(`open: no application named “${name || ""}”`, "os-term-error");
    return;
  }
  openWindow(id);
  if (id === "terminal") focusTerminalInput();
}

function terminalHelp() {
  const rows = [
    ["help", "list the available commands"],
    ["tank compare [--provider jottacloud|gdrive]", "diff the local index against a read-only snapshot"],
    ["ls", "list the top level of the snapshot"],
    ["cat README.md", "print a short file from the demo snapshot"],
    ["open <app>", "focus a window, for example explorer or settings"],
    ["clear", "clear the scrollback"],
    ["whoami · pwd · date", "the usual"],
    ["exit", "close the terminal"],
  ];
  terminalText("Simulated shell · nothing is executed and nothing is uploaded.", "os-term-hint");
  rows.forEach(([command, description]) => {
    const line = terminalLine();
    line.append(terminalSpan("os-term-cmd", command), " ", terminalSpan("os-term-muted", description));
  });
}

function terminalRun(raw) {
  const command = raw.trim();
  if (!terminalEl) return;
  terminalEcho(command);
  if (!command) return;
  const [head, ...rest] = command.split(/\s+/);
  const argument = rest.join(" ");
  switch (head.toLowerCase()) {
    case "help":
      terminalHelp();
      break;
    case "ls":
      terminalList();
      break;
    case "cat":
      terminalCat(argument);
      break;
    case "open":
      terminalOpen(argument);
      break;
    case "tank": {
      const [sub, ...flags] = rest;
      if (sub === "compare") {
        const flag = flags.indexOf("--provider");
        const provider = flag >= 0 ? flags[flag + 1] : "jottacloud";
        terminalCompare(provider);
      } else {
        terminalText("usage: tank compare [--provider jottacloud|gdrive]", "os-term-hint");
      }
      break;
    }
    case "clear":
      terminalStop();
      Array.from(terminalEl.children).forEach((child) => {
        if (child !== terminalForm) child.remove();
      });
      break;
    case "whoami":
      terminalText("tide");
      break;
    case "pwd":
      terminalText("/mnt/tank");
      break;
    case "date":
      terminalText(new Date().toString());
      break;
    case "echo":
      terminalText(argument);
      break;
    case "about":
      openWindow("about");
      break;
    case "exit":
      closeWindow(windowById("terminal"));
      break;
    default:
      terminalText(`zsh: command not found: ${head}`, "os-term-error");
  }
}

export function focusTerminalInput() {
  terminalInput?.focus({ preventScroll: true });
}

terminalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = terminalInput?.value ?? "";
  if (terminalInput) terminalInput.value = "";
  terminalRun(value);
});

terminalEl?.addEventListener("click", () => {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return;
  focusTerminalInput();
});

export function rerunTerminal() {
  openWindow("terminal");
  terminalCompare("jottacloud");
  focusTerminalInput();
  toast("Comparison re-run against the read-only snapshot");
}
