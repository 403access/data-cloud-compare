/** The columns sidebar: visible columns and folder-size display. */

import {
  COLUMN_DEFS,
  SIZE_MODE_LABELS,
  SIZE_MODES,
} from "../lib/columns";
import { useEffect, useRef } from "react";
import type { SizeMode } from "../lib/types";
import { useAnimatedPresence } from "./shared";

interface Props {
  open: boolean;
  columns: Set<string>;
  sizeMode: SizeMode;
  onToggleColumn: (id: string, visible: boolean) => void;
  onReset: () => void;
  onSizeMode: (mode: SizeMode) => void;
  onClose: () => void;
}

export function ColumnsPanel({
  open,
  columns,
  sizeMode,
  onToggleColumn,
  onReset,
  onSizeMode,
  onClose,
}: Props) {
  const presence = useAnimatedPresence(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (presence.shown) closeRef.current?.focus({ preventScroll: true });
  }, [presence.shown]);
  if (!presence.mounted) return null;
  return (
    <aside
      className={`columns-panel${presence.shown ? " is-open" : ""}`}
      id="columns-panel"
      aria-labelledby="columns-title"
      hidden={!presence.mounted}
    >
      <header className="columns-panel-head">
        <div>
          <h2 id="columns-title">Columns</h2>
          <p>Choose what both panes show and how folder sizes read.</p>
        </div>
        <button type="button" className="btn icon-btn" id="columns-close" ref={closeRef} title="Close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="columns-options" id="columns-options">
        {COLUMN_DEFS.map((col) => (
          <label className="columns-option" key={col.id}>
            <input
              type="checkbox"
              data-column={col.id}
              checked={columns.has(col.id)}
              disabled={col.required}
              onChange={(event) => onToggleColumn(col.id, event.target.checked)}
            />
            <span className="columns-option-text">
              <span className="columns-option-title">{col.label}</span>
              <span className="columns-option-hint">
                {col.required ? "Always shown" : col.hint}
              </span>
            </span>
          </label>
        ))}
        <label className="columns-setting">
          <span className="columns-option-text">
            <span className="columns-option-title">Folder size</span>
            <span className="columns-option-hint">
              Choose how the Size column shows folders.
            </span>
          </span>
          <select
            id="columns-size-mode"
            className="columns-select"
            aria-label="Folder size display"
            value={sizeMode}
            onChange={(event) => onSizeMode(event.target.value as SizeMode)}
          >
            {SIZE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {SIZE_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <footer className="columns-panel-foot">
        <button type="button" className="btn ghost" id="columns-reset" onClick={onReset}>
          Reset columns
        </button>
        <p>Right-click a table header any time to reopen this sidebar.</p>
      </footer>
    </aside>
  );
}
