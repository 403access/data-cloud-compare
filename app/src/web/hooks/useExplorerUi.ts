/** Shell UI state: pane focus, sidebars, menus, command bar and shortcuts. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGlobalShortcuts } from "./useGlobalShortcuts";
import type { Side, SidebarMode } from "../lib/types";

export function useExplorerUi() {
  const [active, setActive] = useState<Side>("local");
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

  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  const setHidden = useCallback((value: boolean) => {
    hiddenRef.current = Boolean(value);
    setHiddenState(Boolean(value));
  }, []);
  const getHidden = useCallback(() => hiddenRef.current, []);

  const closeSidebar = useCallback(() => setSidebarMode(null), []);
  const closeDetail = useCallback(
    () => setSidebarMode((prev) => (prev === "detail" ? null : prev)),
    [],
  );
  const openColumns = useCallback(() => setSidebarMode("columns"), []);
  const openSource = useCallback((side: Side) => {
    setSourcePanelSide(side);
    setSidebarMode("source");
  }, []);
  const toggleAnalytics = useCallback(
    () => setSidebarMode((prev) => (prev === "analytics" ? null : "analytics")),
    [],
  );
  const toggleThemePanel = useCallback(() => setThemePanelOpen((open) => !open), []);
  const toggleLegend = useCallback(() => setLegendOpen((open) => !open), []);
  const toggleFilter = useCallback(
    (side: Side) => setFilterMenu((prev) => (prev === side ? null : side)),
    [],
  );
  const closeFilter = useCallback(() => setFilterMenu(null), []);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

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

  const panesClass = `panes${sidebarMode ? " sidebar-open" : ""}${
    themePanelOpen ? " left-open" : ""
  }`;

  return {
    active,
    setActive,
    hidden,
    setHidden,
    getHidden,
    sidebarMode,
    setSidebarMode,
    sourcePanelSide,
    themePanelOpen,
    setThemePanelOpen,
    toggleThemePanel,
    legendOpen,
    setLegendOpen,
    toggleLegend,
    filterMenu,
    toggleFilter,
    closeFilter,
    commandOpen,
    setCommandOpen,
    openCommand,
    closeCommand,
    shortcut,
    closeSidebar,
    closeDetail,
    openColumns,
    openSource,
    toggleAnalytics,
    panesClass,
  };
}
