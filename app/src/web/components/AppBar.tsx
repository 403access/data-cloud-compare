/** App bar: brand, provider switch, search trigger, legend, theme controls. */

import type { ProviderInfo, ThemeMode } from "../lib/types";

const BRAND_ICON = `<svg viewBox="0 0 32 32" fill="none">
  <rect x="2" y="7" width="12" height="18" rx="3" fill="var(--brand-a)"/>
  <rect x="18" y="7" width="12" height="18" rx="3" fill="var(--brand-b)"/>
  <path d="M12.5 16h7" stroke="var(--text-2)" stroke-width="1.6" stroke-linecap="round"/>
  <path d="m16.6 13.8 2.2 2.2-2.2 2.2" stroke="var(--text-2)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 15.8v-4.6M10 15.8V7.4M16 15.8V4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.8 15.8h14.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.8" cy="8.8" r="5.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12.9 12.9 3.4 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.1v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="6.4" r="1" fill="currentColor" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg className="theme-picker-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.6S4.4 8.2 4.4 12a5.6 5.6 0 0 0 11.2 0c0-3.8-5.6-9.4-5.6-9.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.6 12.5a2.5 2.5 0 0 0 2.4 2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="theme-picker-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  provider: ProviderInfo;
  providers: ProviderInfo[];
  themeMode: ThemeMode;
  sidebarMode: string | null;
  legendOpen: boolean;
  hidden: boolean;
  themePanelOpen: boolean;
  commandOpen: boolean;
  shortcut: string;
  onProviderSwitch: (key: string) => void;
  onThemeMode: (mode: ThemeMode) => void;
  onAnalytics: () => void;
  onCommandOpen: () => void;
  onLegendToggle: () => void;
  onHiddenChange: (value: boolean) => void;
  onThemePanelToggle: () => void;
}

function Legend({ provider }: { provider: ProviderInfo }) {
  const label = provider.label;
  const rows: React.ReactNode[] = [];
  const pushSection = (title: string) => {
    rows.push(<h4 key={`h-${title}`}>{title}</h4>);
  };
  const pushRow = (cls: string, title: string, desc?: string) => {
    rows.push(
      <div className="legend-row" key={`${cls}-${title}`}>
        <span className={`status-chip ${cls}`}>
          <span className="dot" />
        </span>
        <span>
          <b>{title}</b>
          {desc ? ` — ${desc}` : ""}
        </span>
      </div>,
    );
  };
  pushSection(`${label} side`);
  pushRow("st-exact", "Same", "This path exists in the local index at the same path.");
  pushRow("st-moved", "Moved", "Found in the local index under a different path (same name and size).");
  pushRow("st-possible", "Maybe", "A file with the same name exists locally, but the size differs.");
  pushRow("st-partial", "Partial", "Folder has a mix of present and missing children.");
  pushRow("st-missing", "Missing", "No matching path, name or size was found in the local index.");
  pushSection("Local side");
  pushRow("st-exact", `In ${label}`, `This local item exists at the same path in ${label}.`);
  pushRow("st-moved_match", "Moved match", `This local item is the match for a moved ${label} item.`);
  pushRow("st-local_only", "Local only", `Present in the index but not found anywhere in ${label}.`);
  pushRow("st-unmatched", `Not in ${label}`, `No same-path counterpart in ${label}; it may still have matched another item.`);
  pushRow("st-type_mismatch", "Type differs", "A file/folder with the same name exists on the other side.");
  return <>{rows}</>;
}

export function AppBar({
  provider,
  providers,
  themeMode,
  sidebarMode,
  legendOpen,
  hidden,
  themePanelOpen,
  commandOpen,
  shortcut,
  onProviderSwitch,
  onThemeMode,
  onAnalytics,
  onCommandOpen,
  onLegendToggle,
  onHiddenChange,
  onThemePanelToggle,
}: Props) {
  return (
    <header className="appbar">
      <div className="brand">
        <div className="brand-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BRAND_ICON }} />
        <div className="brand-text">
          <h1>
            Tank <span className="arrow">⇄</span> <span id="brand-provider">{provider.label}</span>
          </h1>
          <p id="brand-sub">Two-pane filesystem explorer</p>
        </div>
      </div>

      <div className="provider-switch" id="provider-switch" role="tablist" aria-label="Remote provider">
        {providers.map((info) => (
          <button
            key={info.key}
            className={
              "provider-choice" +
              (info.key === provider.key ? " active" : "") +
              (!info.available ? " unavailable" : "")
            }
            data-provider={info.key}
            role="tab"
            aria-selected={info.key === provider.key}
            title={!info.available ? info.reason : `Switch the right pane to ${info.label}`}
            onClick={() => onProviderSwitch(info.key)}
          >
            <span className={`provider-dot ${info.key}`} />
            {info.label}
          </button>
        ))}
      </div>

      <div className="appbar-actions">
        <button
          id="analytics-toggle"
          className="btn icon-btn"
          type="button"
          title="Analytics"
          aria-label="Analytics"
          aria-haspopup="dialog"
          aria-controls="analytics-panel"
          aria-expanded={sidebarMode === "analytics"}
          onClick={onAnalytics}
        >
          <AnalyticsIcon />
        </button>

        <button
          id="command-open"
          className="btn command-trigger"
          type="button"
          title={`Search files and folders or run a command (${shortcut})`}
          aria-haspopup="dialog"
          aria-controls="command-overlay"
          aria-expanded={commandOpen}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={onCommandOpen}
        >
          <SearchIcon className="command-trigger-icon" />
          <span className="command-trigger-label">Search</span>
          <kbd className="command-trigger-kbd" data-command-shortcut aria-hidden="true">
            {shortcut}
          </kbd>
        </button>

        <div className="legend-wrap">
          <button
            id="legend-toggle"
            className="btn ghost"
            aria-expanded={legendOpen}
            onClick={(event) => {
              event.stopPropagation();
              onLegendToggle();
            }}
          >
            Legend
          </button>
          <div id="legend" className="legend" hidden={!legendOpen}>
            <Legend provider={provider} />
          </div>
        </div>

        <label className="toggle" title="Show dotfiles">
          <input
            type="checkbox"
            id="hidden-toggle"
            checked={hidden}
            onChange={(event) => onHiddenChange(event.target.checked)}
          />
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          <span>Hidden</span>
        </label>

        <div className="theme-picker">
          <DropIcon />
          <select
            id="theme-select"
            aria-label="Theme"
            value={themeMode}
            onChange={(event) => onThemeMode(event.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="water">Water</option>
          </select>
          <ChevronIcon />
        </div>

        <button
          id="theme-settings-toggle"
          className={`btn icon-btn${themePanelOpen ? " active" : ""}`}
          title="Water theme settings"
          aria-label="Water theme settings"
          aria-expanded={themePanelOpen}
          aria-controls="theme-panel"
          onClick={onThemePanelToggle}
        >
          <GearIcon />
        </button>
      </div>
    </header>
  );
}
