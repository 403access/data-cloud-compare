/** Document-level keyboard shortcuts for panes, sidebars and the command bar. */

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { shortcutMatches, type ShortcutBindings } from "../lib/shortcuts";
import type { Side, SidebarMode } from "../lib/types";

interface Options {
  active: Side;
  commandOpen: boolean;
  setCommandOpen: Dispatch<SetStateAction<boolean>>;
  shortcutsOpen: boolean;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  shortcuts: ShortcutBindings;
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
  shortcutsOpen,
  setShortcutsOpen,
  shortcuts,
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
      const isEscape = event.key === "Escape";
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const chordAllowed = !typing || event.ctrlKey || event.altKey || event.metaKey;
      const closeOverlay =
        chordAllowed && shortcutMatches(event, shortcuts["close-overlay"]);
      const closeWindow =
        chordAllowed && shortcutMatches(event, shortcuts["close-window"]);

      if (shortcutsOpen) {
        if (isEscape || closeOverlay || closeWindow) {
          event.preventDefault();
          setShortcutsOpen(false);
        }
        return;
      }

      if (
        chordAllowed &&
        shortcutMatches(event, shortcuts["shortcuts-cheatsheet"])
      ) {
        event.preventDefault();
        setCommandOpen(false);
        setShortcutsOpen(true);
        return;
      }

      if (chordAllowed && shortcutMatches(event, shortcuts["command-palette"])) {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }

      const closeTopmost = (): boolean => {
        if (commandOpen) {
          setCommandOpen(false);
          return true;
        }
        if (themePanelOpen) {
          setThemePanelOpen(false);
          return true;
        }
        if (sidebarMode) {
          setSidebarMode(null);
          return true;
        }
        if (legendOpen) {
          setLegendOpen(false);
          return true;
        }
        if (filterMenu) {
          setFilterMenu(null);
          return true;
        }
        return false;
      };

      if (closeWindow) {
        event.preventDefault();
        closeTopmost();
        return;
      }

      if (commandOpen) {
        if (isEscape || closeOverlay) {
          event.preventDefault();
          setCommandOpen(false);
        }
        return;
      }

      if (isEscape || closeOverlay) {
        if (closeTopmost()) {
          event.preventDefault();
          return;
        }
      }

      // Keep the app's established command palette alias working alongside the
      // configurable Simple key map.
      if (mod && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
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
    shortcutsOpen,
    setShortcutsOpen,
    shortcuts,
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
