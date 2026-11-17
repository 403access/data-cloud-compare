/** Keyboard shortcut bindings with local persistence. */

import { useCallback, useRef, useState } from "react";
import {
  cloneShortcutBindings,
  readShortcutBindings,
  saveShortcutBindings,
  type ShortcutBindings,
  type ShortcutId,
} from "../lib/shortcuts";

export function useShortcutSettings(toast: (message: string) => void) {
  const [shortcuts, setShortcuts] = useState<ShortcutBindings>(readShortcutBindings);
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const setShortcut = useCallback((id: ShortcutId, combos: string[]) => {
    const next = { ...shortcutsRef.current, [id]: [...combos] };
    shortcutsRef.current = next;
    setShortcuts(next);
    saveShortcutBindings(next);
  }, []);

  const resetShortcuts = useCallback(() => {
    const next = cloneShortcutBindings();
    shortcutsRef.current = next;
    setShortcuts(next);
    saveShortcutBindings(next);
    toast("Shortcuts reset to Simple defaults.");
  }, [toast]);

  return { shortcuts, setShortcut, resetShortcuts };
}
