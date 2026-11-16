/** Explorer application shell: shared chrome, panes, sidebars and command bar. */

import { useCallback, useEffect, useRef } from "react";
import type { Entry, Side } from "./lib/types";
import type { PaneApi } from "./hooks/usePane";
import { useColumnPreferences } from "./hooks/useColumnPreferences";
import { useExplorerUi } from "./hooks/useExplorerUi";
import { usePaneWorkspace } from "./hooks/usePaneWorkspace";
import { useProviderCatalog } from "./hooks/useProviderCatalog";
import { useProviderSwitch } from "./hooks/useProviderSwitch";
import { useThemeMode } from "./hooks/useThemeMode";
import { useToast } from "./hooks/useToast";
import { useWaterSettings } from "./hooks/useWaterSettings";
import { isDemo } from "./lib/demo";
import { AppBar } from "./components/AppBar";
import { CommandBar } from "./components/CommandBar";
import { PanePair } from "./components/PanePair";
import { ShellPanels } from "./components/ShellPanels";
import { StatusBar } from "./components/StatusBar";
import { Toast } from "./components/Toast";
import { WaterBackdrop } from "./components/WaterBackdrop";

export function App() {
  const { toast, toastState } = useToast();
  const {
    catalog,
    setProviderKey,
    booted,
    provider,
    meta,
    providerKeyRef,
    getProvider,
    getProviderKey,
  } = useProviderCatalog(toast);
  const ui = useExplorerUi();

  const { themeMode, applyThemeMode } = useThemeMode({
    onWaterPanel: () => ui.setThemePanelOpen(true),
  });
  const { waterSettings, waterRef, updateWaterSettings, resetWaterSettings } =
    useWaterSettings(toast);

  const panesRef = useRef<{ local?: PaneApi; remote?: PaneApi }>({});
  const refreshSizeDisplay = useCallback(() => {
    panesRef.current.local?.refreshSizeDisplay();
    panesRef.current.remote?.refreshSizeDisplay();
  }, []);
  const {
    columns,
    sizeMode,
    getSizeMode,
    setSizeMode,
    setColumnVisibility,
    resetColumns,
  } = useColumnPreferences(refreshSizeDisplay);

  const { localPane, remotePane, revealCounterpart, refreshAll } = usePaneWorkspace({
    panesRef,
    booted,
    getProvider,
    getProviderKey,
    isHidden: ui.getHidden,
    getSizeMode,
    toast,
    setActive: ui.setActive,
    closeDetail: ui.closeDetail,
  });

  const activePane = ui.active === "local" ? localPane : remotePane;
  const activeEntry = activePane.selectedEntry();
  const activeSide = activePane.side;
  const currentProvider = provider;

  useEffect(() => {
    document.title = `${isDemo() ? "Demo · " : ""}Tank ⇄ ${currentProvider.label}`;
  }, [currentProvider.label]);

  // Close the details sidebar when the active selection disappears.
  useEffect(() => {
    if (ui.sidebarMode === "detail" && !activeEntry) ui.setSidebarMode(null);
  }, [ui.sidebarMode, ui.active, activeEntry, ui.setSidebarMode]);

  const setHidden = useCallback(
    (value: boolean) => {
      ui.setHidden(value);
      refreshAll();
    },
    [refreshAll, ui.setHidden],
  );

  const switchProvider = useProviderSwitch({
    catalog,
    providerKeyRef,
    setProviderKey,
    panesRef,
    toast,
  });

  function openDetail(side: Side, entry: Entry) {
    ui.setActive(side);
    ui.setSidebarMode("detail");
    if (entry && side === "local" && localPane.selected !== entry.path) {
      localPane.select(entry.path);
    } else if (entry && side === "remote" && remotePane.selected !== entry.path) {
      remotePane.select(entry.path);
    }
  }

  return (
    <>
      <WaterBackdrop settings={waterSettings} themeMode={themeMode} />

      <AppBar
        provider={currentProvider}
        providers={catalog.list}
        themeMode={themeMode}
        sidebarMode={ui.sidebarMode}
        legendOpen={ui.legendOpen}
        hidden={ui.hidden}
        themePanelOpen={ui.themePanelOpen}
        commandOpen={ui.commandOpen}
        shortcut={ui.shortcut}
        onProviderSwitch={(key) => void switchProvider(key)}
        onThemeMode={(mode) => applyThemeMode(mode, { openPanel: mode === "water" })}
        onAnalytics={ui.toggleAnalytics}
        onCommandOpen={ui.openCommand}
        onLegendToggle={ui.toggleLegend}
        onHiddenChange={setHidden}
        onThemePanelToggle={ui.toggleThemePanel}
      />

      <main className={ui.panesClass} id="panes">
        <PanePair
          localPane={localPane}
          remotePane={remotePane}
          provider={currentProvider}
          active={ui.active}
          hidden={ui.hidden}
          columns={columns}
          sizeMode={sizeMode}
          filterMenu={ui.filterMenu}
          sidebarMode={ui.sidebarMode}
          sourcePanelSide={ui.sourcePanelSide}
          onActivate={ui.setActive}
          onFilterToggle={ui.toggleFilter}
          onFilterClose={ui.closeFilter}
          onOpenDetail={openDetail}
          onOpenSource={ui.openSource}
          onOpenColumns={ui.openColumns}
        />

        <ShellPanels
          sidebarMode={ui.sidebarMode}
          sourcePanelSide={ui.sourcePanelSide}
          themePanelOpen={ui.themePanelOpen}
          waterSettings={waterSettings}
          themeMode={themeMode}
          columns={columns}
          sizeMode={sizeMode}
          activeSide={activeSide}
          activeEntry={activeEntry}
          meta={meta}
          provider={currentProvider}
          onCloseSidebar={ui.closeSidebar}
          onCloseThemePanel={() => ui.setThemePanelOpen(false)}
          onResetWater={resetWaterSettings}
          onChangeWater={updateWaterSettings}
          onActivateWater={() => applyThemeMode("water", { openPanel: true })}
          onToggleColumn={setColumnVisibility}
          onResetColumns={resetColumns}
          onSizeMode={setSizeMode}
          onOpenFolder={(entry) => {
            ui.closeSidebar();
            activePane.activate(entry);
          }}
          onReveal={(entry, side) => void revealCounterpart(entry, side)}
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
        open={ui.commandOpen}
        panes={{ local: localPane, remote: remotePane }}
        active={activeSide}
        provider={currentProvider}
        providers={catalog.list}
        hidden={ui.hidden}
        legendOpen={ui.legendOpen}
        sidebarMode={ui.sidebarMode}
        themeMode={themeMode}
        themePanelOpen={ui.themePanelOpen}
        waterEffects={waterSettings.effects}
        columns={columns}
        shortcut={ui.shortcut}
        onClose={ui.closeCommand}
        onSetActive={ui.setActive}
        onSetHidden={setHidden}
        onSetLegend={ui.setLegendOpen}
        onOpenColumns={ui.openColumns}
        onCloseColumns={ui.closeSidebar}
        onOpenAnalytics={() => ui.setSidebarMode("analytics")}
        onCloseAnalytics={ui.closeSidebar}
        onOpenDetail={openDetail}
        onReveal={(entry, side) => void revealCounterpart(entry, side)}
        onToggleColumn={setColumnVisibility}
        onResetColumns={resetColumns}
        onThemeMode={(mode) => applyThemeMode(mode)}
        onThemePanel={ui.setThemePanelOpen}
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
