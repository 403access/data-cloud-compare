/** Document-level keyboard shortcuts for panes, sidebars and the command bar. */

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Side, SidebarMode } from "../lib/types";

interface Options {
  active: Side;
  commandOpen: boolean;
  setCommandOpen: Dispatch<SetStateAction<boolean>>;
  themePanelOpen: boolean;
  setThemePanelOpen: Dispatch<SetStateAction<boolean>>;
  sidebarMode: SidebarMode;
  setSidebarMode: Dispatch<SetStateAction<SidebarMode>>;
  legendOpen: boolean;
  setLegendOpen: Dispatch<SetStateAction<boolean>>;
  filterMenu: Side | null;
  setFilterMenu: Dispatch<SetStateAction<Side | null>>;
}

export function useGlobalShortcuts({
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
}: Options) {
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
  }, [
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
  ]);
}
