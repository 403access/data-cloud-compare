/** Column configuration plus persisted column/size preferences. */

import type { SizeMode } from "./types";

export const COLUMN_STORAGE_KEY = "explorer-columns";
export const SIZE_MODE_STORAGE_KEY = "explorer-size-mode";
export const SIZE_MODES: SizeMode[] = ["bytes", "files", "both"];
export const SIZE_MODE_LABELS: Record<SizeMode, string> = {
  bytes: "Size in bytes",
  files: "Item count",
  both: "Bytes + item count",
};

export interface ColumnDef {
  id: string;
  label: string;
  hint: string;
  width: string;
  required: boolean;
}

export const COLUMN_DEFS: ColumnDef[] = [
  { id: "name", label: "Name", hint: "File or folder name", width: "minmax(0, 1fr)", required: true },
  { id: "type", label: "Type", hint: "Folder or file extension", width: "var(--col-type)", required: false },
  { id: "status", label: "Status", hint: "Comparison result", width: "var(--col-status)", required: false },
  { id: "size", label: "Size", hint: "Nested bytes or direct item count", width: "var(--col-size)", required: false },
  { id: "modified", label: "Modified", hint: "Last modified date", width: "var(--col-mod)", required: false },
];

export const DEFAULT_COLUMNS = COLUMN_DEFS.map((col) => col.id);

export function readVisibleColumns(): Set<string> {
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || "null");
  } catch {
    /* ignore */
  }
  if (!Array.isArray(saved)) return new Set(DEFAULT_COLUMNS);
  const valid = new Set(DEFAULT_COLUMNS);
  const chosen = new Set(saved.filter((id) => valid.has(id)));
  chosen.add("name");
  return chosen;
}

export function saveVisibleColumns(columns: Set<string>): void {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...columns]));
  } catch {
    /* ignore */
  }
}

export function readSizeMode(): SizeMode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SIZE_MODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return SIZE_MODES.includes(saved as SizeMode) ? (saved as SizeMode) : "bytes";
}

export function saveSizeMode(mode: SizeMode): void {
  try {
    localStorage.setItem(SIZE_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function columnTemplate(columns: Set<string>): string {
  return COLUMN_DEFS.filter((col) => columns.has(col.id))
    .map((col) => col.width)
    .join(" ");
}
