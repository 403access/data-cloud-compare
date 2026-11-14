/** Visible columns and size display mode, persisted to local storage. */

import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_COLUMNS,
  readSizeMode,
  readVisibleColumns,
  saveSizeMode,
  saveVisibleColumns,
} from "../lib/columns";
import type { SizeMode } from "../lib/types";

export function useColumnPreferences(onSizeModeChange: () => void) {
  const [columns, setColumns] = useState<Set<string>>(readVisibleColumns);
  const [sizeMode, setSizeModeState] = useState<SizeMode>(readSizeMode);
  const sizeModeRef = useRef(sizeMode);
  sizeModeRef.current = sizeMode;

  const getSizeMode = useCallback(() => sizeModeRef.current, []);

  const setSizeMode = useCallback(
    (mode: SizeMode) => {
      if (mode === sizeModeRef.current) return;
      sizeModeRef.current = mode;
      setSizeModeState(mode);
      saveSizeMode(mode);
      onSizeModeChange();
    },
    [onSizeModeChange],
  );

  const setColumnVisibility = useCallback((id: string, visible: boolean) => {
    setColumns((prev) => {
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      saveVisibleColumns(next);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    const next = new Set(DEFAULT_COLUMNS);
    setColumns(next);
    saveVisibleColumns(next);
  }, []);

  return {
    columns,
    sizeMode,
    getSizeMode,
    setSizeMode,
    setColumnVisibility,
    resetColumns,
  };
}
