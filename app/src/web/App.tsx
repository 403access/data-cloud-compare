/** Explorer application shell: shared chrome, panes, sidebars and command bar. */

import { useCallback, useEffect, useRef, useState } from "react";
import { getJSON } from "./lib/api";
import {
  DEFAULT_COLUMNS,
  readSizeMode,
  readVisibleColumns,
  saveSizeMode,
  saveVisibleColumns,
} from "./lib/columns";
import { BASE, PROVIDER_STORAGE_KEY, THEME_STORAGE_KEY } from "./lib/config";
import { baseOf, parentOf } from "./lib/format";
import { counterpartTarget } from "./lib/status";
import type {
  Entry,
  Meta,
  ProviderCatalog,
  ProviderInfo,
  Side,
  SizeMode,
  ThemeMode,
} from "./lib/types";
import {
  readWaterSettings,
  saveWaterSettings,
  WATER_DEFAULTS,
  WaterFX,
  type WaterSettings,
} from "./lib/water";
import { usePane, type PaneApi } from "./hooks/usePane";
import { AppBar } from "./components/AppBar";
import { CommandBar } from "./components/CommandBar";
import { Pane } from "./components/Pane";
import { StatusBar } from "./components/StatusBar";
import { ColumnsPanel } from "./panels/ColumnsPanel";
import { ThemePanel } from "./panels/ThemePanel";
import { DetailPanel } from "./panels/DetailPanel";
import { SourcePanel } from "./panels/SourcePanel";
import { AnalyticsPanel } from "./panels/AnalyticsPanel";

const FALLBACK_PROVIDER: ProviderInfo = {
  key: "jottacloud",
  label: "Jottacloud",
  root_label: "Archive",
  subtitle: "archive.json snapshot · virtual read-only view",
  accent: "#5e5ce6",
  archive: "archive.json",
  available: true,
  reason: "",
};

type SidebarMode = "columns" | "detail" | "source" | "analytics" | null;

function readProviderKey(): string {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) || "jottacloud";
  } catch {
    return "jottacloud";
  }
}

export function App() {
  const [catalog, setCatalog] = useState<ProviderCatalog>({
    list: [FALLBACK_PROVIDER],
    byKey: { [FALLBACK_PROVIDER.key]: FALLBACK_PROVIDER },
  });
  const [providerKey, setProviderKey] = useState(readProviderKey);
  const [booted, setBooted] = useState(false);
  const [active, setActiveState] = useState<Side>("local");
  const [hidden, setHiddenState] = useState(false);
  const [columns, setColumns] = useState<Set<string>>(readVisibleColumns);
  const [sizeMode, setSizeModeState] = useState<SizeMode>(readSizeMode);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(null);
  const [sourcePanelSide, setSourcePanelSide] = useState<Side>("local");
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState<Side | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () => ((document.documentElement.dataset.theme as ThemeMode) || "system"),
  );
  const [waterSettings, setWaterSettings] = useState<WaterSettings>(readWaterSettings);
  const [metaCache, setMetaCache] = useState<Record<string, Meta>>({});
  const [toastState, setToastState] = useState({ message: "", show: false });
  const [shortcut] = useState(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") ? "⌘K" : "Ctrl K",
  );

  const provider = catalog.byKey[providerKey] || FALLBACK_PROVIDER;
  const providerKeyRef = useRef(providerKey);
  providerKeyRef.current = providerKey;
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const sizeModeRef = useRef(sizeMode);
  sizeModeRef.current = sizeMode;

  const panesRef = useRef<{ local?: PaneApi; remote?: PaneApi }>({});
  const revealRef = useRef<(entry: Entry, side: Side) => void>(() => {});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterFX = useRef<WaterFX | null>(null);
  const waterRef = useRef(waterSettings);
  waterRef.current = waterSettings;

  const toast = useCallback((message: string) => {
    setToastState({ message, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, show: false }));
    }, 3200);
  }, []);

  const setActive = useCallback((side: Side) => setActiveState(side), []);

  const paneContext = {
    getProvider: () => providerRef.current,
    getProviderKey: () => providerKeyRef.current,
    isHidden: () => hiddenRef.current,
    getSizeMode: () => sizeModeRef.current,
    toast,
    setActive,
    closeDetail: () => setSidebarMode((prev) => (prev === "detail" ? null : prev)),
    revealCounterpart: (entry: Entry, side: Side) => revealRef.current(entry, side),
    getOther: (side: Side) =>
      (side === "local" ? panesRef.current.remote : panesRef.current.local)!,
  };

  const localPane = usePane("local", paneContext);
  const remotePane = usePane("remote", paneContext);
  panesRef.current = { local: localPane, remote: remotePane };

  const activePane = active === "local" ? localPane : remotePane;
  const activeEntry = activePane.selectedEntry();
  const currentProvider = provider;

  const revealCounterpart = useCallback(
    async (entry: Entry, side: Side) => {
      const target = counterpartTarget(entry, side);
      if (!target) {
        toast(
          side === "remote"
            ? "This item has no match on the local side."
            : `This item has no counterpart in ${providerRef.current.label}.`,
        );
        return;
      }
      const destination = side === "remote" ? panesRef.current.local : panesRef.current.remote;
      if (!destination) return;
      const parent = parentOf(target);
      const name = baseOf(target);
      const data = await destination.navigate(parent, { push: true, select: target });
      if (data && !data.exists) {
        toast(`Counterpart folder not found: ${parent || "/"}`);
        return;
      }
      setActive(destination.side);
      document.querySelector<HTMLElement>(`#pane-${destination.side} .vlist`)?.focus();
      if (name) destination.select(target);
    },
    [setActive, toast],
  );
  revealRef.current = revealCounterpart;

  const refreshPane = useCallback((pane: PaneApi) => {
    if (pane.searchMode && pane.query) void pane.runSearch(pane.query);
    else void pane.fetchList();
  }, []);

  // Boot: load the provider catalogue, then choose the saved/available provider.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJSON<{ default: string; providers: ProviderInfo[] }>(
          "/api/providers",
        );
        if (cancelled) return;
        const byKey: Record<string, ProviderInfo> = {};
        for (const info of data.providers || []) byKey[info.key] = info;
        const list = data.providers || [];
        setCatalog({ list, byKey });
        let wanted = readProviderKey();
        if (!byKey[wanted]) wanted = data.default || "jottacloud";
        if (byKey[wanted] && !byKey[wanted].available) {
          const first = list.find((info) => info.available);
          if (first) wanted = first.key;
        }
        setProviderKey(wanted);
        setBooted(true);
      } catch (error) {
        if (cancelled) return;
        toast(`Could not load provider list: ${(error as Error).message}`);
        setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const bootRan = useRef(false);
  useEffect(() => {
    if (!booted || bootRan.current) return;
    bootRan.current = true;
    void panesRef.current.local?.navigate("", { push: false });
    void panesRef.current.remote?.navigate("", { push: false });
  }, [booted]);

  // Load the provider metadata used by the source/analytics sidebars.
  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    getJSON<Meta>(`/api/meta?provider=${encodeURIComponent(providerKey)}`)
      .then((data) => {
        if (cancelled) return;
        setMetaCache((prev) => ({ ...prev, [providerKey]: data }));
      })
      .catch(() => {
        /* the sidebars keep their loading state */
      });
    return () => {
      cancelled = true;
    };
  }, [providerKey, booted]);

  useEffect(() => {
    document.title = `Tank ⇄ ${currentProvider.label}`;
  }, [currentProvider.label]);

  // Theme and water effects.
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "system") delete root.dataset.theme;
    else root.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    waterFX.current = new WaterFX(canvasRef.current);
    return () => {
      waterFX.current?.destroy();
      waterFX.current = null;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.waterTone = waterSettings.tone;
    root.dataset.waterSpeed = waterSettings.speed;
    root.dataset.waterIntensity = waterSettings.intensity;
    root.dataset.waterGlass = waterSettings.glass ? "on" : "off";
    root.dataset.waterEffects = waterSettings.effects ? "on" : "off";
    root.dataset.waterCaustics = waterSettings.caustics ? "on" : "off";
    root.dataset.waterRowMotion = waterSettings.rowMotion ? "on" : "off";
    waterFX.current?.configure(
      waterSettings,
      themeMode === "water" && waterSettings.effects,
    );
  }, [waterSettings, themeMode]);

  const applyThemeMode = useCallback(
    (mode: ThemeMode, opts: { persist?: boolean; openPanel?: boolean } = {}) => {
      const { persist = true, openPanel = false } = opts;
      setThemeModeState(mode);
      if (persist) {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch {
          /* ignore */
        }
      }
      if (openPanel && mode === "water") setThemePanelOpen(true);
    },
    [],
  );

  const updateWaterSettings = useCallback((patch: Partial<WaterSettings>) => {
    const next = { ...waterRef.current, ...patch };
    waterRef.current = next;
    setWaterSettings(next);
    saveWaterSettings(next);
  }, []);

  const resetWaterSettings = useCallback(() => {
    const next = { ...WATER_DEFAULTS };
    waterRef.current = next;
    setWaterSettings(next);
    saveWaterSettings(next);
    toast("Water settings reset.");
  }, [toast]);

  // Close the details sidebar when the active selection disappears.
  useEffect(() => {
    if (sidebarMode === "detail" && !activeEntry) setSidebarMode(null);
  }, [sidebarMode, active, activeEntry]);

  // Click-away handling for the legend and filter menus.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        legendOpen &&
        !target.closest("#legend") &&
        !target.closest("#legend-toggle")
      ) {
        setLegendOpen(false);
      }
      if (filterMenu && !target.closest(".filter-menu") && !target.closest(".filter-btn")) {
        setFilterMenu(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [legendOpen, filterMenu]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (commandOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setCommandOpen(false);
        }
        return;
      }
      if (event.key === "Escape") {
        if (themePanelOpen) {
          event.preventDefault();
          setThemePanelOpen(false);
          return;
        }
        if (sidebarMode) {
          event.preventDefault();
          setSidebarMode(null);
          return;
        }
        if (legendOpen) {
          event.preventDefault();
          setLegendOpen(false);
          return;
        }
        if (filterMenu) {
          event.preventDefault();
          setFilterMenu(null);
          return;
        }
      }
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          `#pane-${active} [data-role="search"]`,
        );
        input?.focus();
        input?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, commandOpen, themePanelOpen, sidebarMode, legendOpen, filterMenu]);

  function setHidden(value: boolean) {
    hiddenRef.current = Boolean(value);
    setHiddenState(Boolean(value));
    refreshPane(panesRef.current.local!);
    refreshPane(panesRef.current.remote!);
  }

  function setSizeMode(mode: SizeMode) {
    if (mode === sizeModeRef.current) return;
    sizeModeRef.current = mode;
    setSizeModeState(mode);
    saveSizeMode(mode);
    panesRef.current.local?.refreshSizeDisplay();
    panesRef.current.remote?.refreshSizeDisplay();
  }

  function setColumnVisibility(id: string, visible: boolean) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      saveVisibleColumns(next);
      return next;
    });
  }

  function resetColumns() {
    const next = new Set(DEFAULT_COLUMNS);
    setColumns(next);
    saveVisibleColumns(next);
  }

  async function switchProvider(key: string) {
    if (key === providerKeyRef.current) return;
    const info = catalog.byKey[key];
    if (!info) return;
    if (!info.available) {
      toast(info.reason || `${info.label} is not available.`);
      return;
    }
    providerKeyRef.current = key;
    setProviderKey(key);
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
    const remote = panesRef.current.remote;
    if (!remote) return;
    const wanted = remote.path;
    const data = await remote.resetTo(wanted);
    if (data && !data.exists) await remote.resetTo("");
    const local = panesRef.current.local;
    if (local) {
      if (local.searchMode && local.query) await local.runSearch(local.query);
      else await local.fetchList();
    }
  }

  function openDetail(side: Side, entry: Entry) {
    setActive(side);
    setSidebarMode("detail");
    if (entry && side === "local" && localPane.selected !== entry.path) {
      localPane.select(entry.path);
    } else if (entry && side === "remote" && remotePane.selected !== entry.path) {
      remotePane.select(entry.path);
    }
  }

  function openSource(side: Side) {
    setSourcePanelSide(side);
    setSidebarMode("source");
  }

  function toggleAnalytics() {
    setSidebarMode((prev) => (prev === "analytics" ? null : "analytics"));
  }

  function toggleThemePanel() {
    setThemePanelOpen((open) => !open);
  }

  const meta = metaCache[providerKey] || null;
  const activeSide = activePane.side;

  return (
    <>
      <canvas id="water-fx" aria-hidden="true" ref={canvasRef} />

      <AppBar
        provider={currentProvider}
        providers={catalog.list}
        themeMode={themeMode}
        sidebarMode={sidebarMode}
        legendOpen={legendOpen}
        hidden={hidden}
        themePanelOpen={themePanelOpen}
        commandOpen={commandOpen}
        shortcut={shortcut}
        onProviderSwitch={(key) => void switchProvider(key)}
        onThemeMode={(mode) => applyThemeMode(mode, { openPanel: mode === "water" })}
        onAnalytics={toggleAnalytics}
        onCommandOpen={() => setCommandOpen(true)}
        onLegendToggle={() => setLegendOpen((open) => !open)}
        onHiddenChange={setHidden}
        onThemePanelToggle={toggleThemePanel}
      />

      <main
        className={`panes${sidebarMode ? " sidebar-open" : ""}${
          themePanelOpen ? " left-open" : ""
        }`}
        id="panes"
      >
        <Pane
          pane={localPane}
          provider={currentProvider}
          active={active === "local"}
          hidden={hidden}
          columns={columns}
          sizeMode={sizeMode}
          filterOpen={filterMenu === "local"}
          sidebarMode={sidebarMode}
          sourcePanelSide={sourcePanelSide}
          onActivate={setActive}
          onFilterToggle={(side) =>
            setFilterMenu((prev) => (prev === side ? null : side))
          }
          onFilterClose={() => setFilterMenu(null)}
          onOpenDetail={openDetail}
          onOpenSource={openSource}
          onOpenColumns={() => setSidebarMode("columns")}
        />

        <Pane
          pane={remotePane}
          provider={currentProvider}
          active={active === "remote"}
          hidden={hidden}
          columns={columns}
          sizeMode={sizeMode}
          filterOpen={filterMenu === "remote"}
          sidebarMode={sidebarMode}
          sourcePanelSide={sourcePanelSide}
          onActivate={setActive}
          onFilterToggle={(side) =>
            setFilterMenu((prev) => (prev === side ? null : side))
          }
          onFilterClose={() => setFilterMenu(null)}
          onOpenDetail={openDetail}
          onOpenSource={openSource}
          onOpenColumns={() => setSidebarMode("columns")}
        />

        <ThemePanel
          open={themePanelOpen}
          settings={waterSettings}
          themeMode={themeMode}
          onClose={() => setThemePanelOpen(false)}
          onReset={resetWaterSettings}
          onChange={updateWaterSettings}
          onActivateWater={() => applyThemeMode("water", { openPanel: true })}
        />

        <ColumnsPanel
          open={sidebarMode === "columns"}
          columns={columns}
          sizeMode={sizeMode}
          onToggleColumn={setColumnVisibility}
          onReset={resetColumns}
          onSizeMode={setSizeMode}
          onClose={() => setSidebarMode(null)}
        />

        <DetailPanel
          open={sidebarMode === "detail"}
          side={activeSide}
          entry={activeEntry}
          provider={currentProvider}
          onClose={() => setSidebarMode(null)}
          onOpenFolder={(entry) => {
            setSidebarMode(null);
            activePane.activate(entry);
          }}
          onReveal={(entry, side) => void revealCounterpart(entry, side)}
        />

        <SourcePanel
          open={sidebarMode === "source"}
          side={sourcePanelSide}
          meta={meta}
          provider={currentProvider}
          base={BASE}
          onClose={() => setSidebarMode(null)}
        />

        <AnalyticsPanel
          open={sidebarMode === "analytics"}
          meta={meta}
          provider={currentProvider}
          onClose={() => setSidebarMode(null)}
        />
      </main>

      <StatusBar
        side={activeSide}
        entry={activeEntry}
        provider={currentProvider}
        sizeMode={sizeMode}
        onReveal={(entry, side) => void revealCounterpart(entry, side)}
      />

      <CommandBar
        open={commandOpen}
        panes={{ local: localPane, remote: remotePane }}
        active={activeSide}
        provider={currentProvider}
        providers={catalog.list}
        hidden={hidden}
        legendOpen={legendOpen}
        sidebarMode={sidebarMode}
        themeMode={themeMode}
        themePanelOpen={themePanelOpen}
        waterEffects={waterSettings.effects}
        columns={columns}
        shortcut={shortcut}
        onClose={() => setCommandOpen(false)}
        onSetActive={setActive}
        onSetHidden={setHidden}
        onSetLegend={setLegendOpen}
        onOpenColumns={() => setSidebarMode("columns")}
        onCloseColumns={() => setSidebarMode(null)}
        onOpenAnalytics={() => setSidebarMode("analytics")}
        onCloseAnalytics={() => setSidebarMode(null)}
        onOpenDetail={openDetail}
        onReveal={(entry, side) => void revealCounterpart(entry, side)}
        onToggleColumn={setColumnVisibility}
        onResetColumns={resetColumns}
        onThemeMode={(mode) => applyThemeMode(mode)}
        onThemePanel={(open) => setThemePanelOpen(open)}
        onToggleWaterEffects={() =>
          updateWaterSettings({ effects: !waterRef.current.effects })
        }
        onProviderSwitch={(key) => void switchProvider(key)}
        onToast={toast}
      />

      <div
        id="toast"
        className={`toast${toastState.show ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastState.message}
      </div>
    </>
  );
}
