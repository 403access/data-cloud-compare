/** Explorer application shell: shared chrome, panes, sidebars and command bar. */

import { useCallback, useEffect, useRef, useState } from "react";
import { BASE } from "./lib/config";
import { saveProviderKey } from "./lib/provider";
import type { Entry, Side, SidebarMode } from "./lib/types";
import type { PaneApi } from "./hooks/usePane";
import { useColumnPreferences } from "./hooks/useColumnPreferences";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { usePaneWorkspace } from "./hooks/usePaneWorkspace";
import { useProviderCatalog } from "./hooks/useProviderCatalog";
import { useThemeMode } from "./hooks/useThemeMode";
import { useToast } from "./hooks/useToast";
import { useWaterSettings } from "./hooks/useWaterSettings";
import { AppBar } from "./components/AppBar";
import { CommandBar } from "./components/CommandBar";
import { Pane } from "./components/Pane";
import { StatusBar } from "./components/StatusBar";
import { Toast } from "./components/Toast";
import { WaterBackdrop } from "./components/WaterBackdrop";
import { ColumnsPanel } from "./panels/ColumnsPanel";
import { ThemePanel } from "./panels/ThemePanel";
import { DetailPanel } from "./panels/DetailPanel";
import { SourcePanel } from "./panels/SourcePanel";
import { AnalyticsPanel } from "./panels/AnalyticsPanel";

export function App() {
  const { toast, toastState } = useToast();
  const { catalog, providerKey, setProviderKey, booted, provider, meta } =
    useProviderCatalog(toast);

  const [active, setActiveState] = useState<Side>("local");
  const [hidden, setHiddenState] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(null);
  const [sourcePanelSide, setSourcePanelSide] = useState<Side>("local");
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState<Side | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcut] = useState(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") ? "⌘K" : "Ctrl K",
  );

  const { themeMode, applyThemeMode } = useThemeMode({
    onWaterPanel: () => setThemePanelOpen(true),
  });
  const { waterSettings, waterRef, updateWaterSettings, resetWaterSettings } =
    useWaterSettings(toast);

  const providerRef = useRef(provider);
  providerRef.current = provider;
  const providerKeyRef = useRef(providerKey);
  providerKeyRef.current = providerKey;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const panesRef = useRef<{ local?: PaneApi; remote?: PaneApi }>({});

  const setActive = useCallback((side: Side) => setActiveState(side), []);
  const getProvider = useCallback(() => providerRef.current, []);
  const getProviderKey = useCallback(() => providerKeyRef.current, []);
  const isHidden = useCallback(() => hiddenRef.current, []);

  const refreshSizeDisplay = useCallback(() => {
    panesRef.current.local?.refreshSizeDisplay();
    panesRef.current.remote?.refreshSizeDisplay();
  }, []);

  const { columns, sizeMode, getSizeMode, setSizeMode, setColumnVisibility, resetColumns } =
    useColumnPreferences(refreshSizeDisplay);

  const { localPane, remotePane, revealCounterpart, refreshAll } = usePaneWorkspace({
    panesRef,
    getProvider,
    getProviderKey,
    isHidden,
    getSizeMode,
    toast,
    setActive,
    closeDetail: () => setSidebarMode((prev) => (prev === "detail" ? null : prev)),
  });

  const activePane = active === "local" ? localPane : remotePane;
  const activeEntry = activePane.selectedEntry();
  const currentProvider = provider;

  // Boot: navigate both panes to the provider root once the catalogue is ready.
  const bootRan = useRef(false);
  useEffect(() => {
    if (!booted || bootRan.current) return;
    bootRan.current = true;
    void panesRef.current.local?.navigate("", { push: false });
    void panesRef.current.remote?.navigate("", { push: false });
  }, [booted]);

  useEffect(() => {
    document.title = `Tank ⇄ ${currentProvider.label}`;
  }, [currentProvider.label]);

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

  useGlobalShortcuts({
    active,
    commandOpen,
    setCommandOpen,
    themePanelOpen,
    setThemePanelOpen,
    sidebarMode,
    setSidebarMode,
    legendOpen,
    setLegendOpen,
    filterMenu,
    setFilterMenu,
  });

  function setHidden(value: boolean) {
    hiddenRef.current = Boolean(value);
    setHiddenState(Boolean(value));
    refreshAll();
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
    saveProviderKey(key);
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

  const activeSide = activePane.side;

  return (
    <>
      <WaterBackdrop settings={waterSettings} themeMode={themeMode} />

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

      <Toast message={toastState.message} show={toastState.show} />
    </>
  );
}
