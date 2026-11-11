/** Number, size and date formatting used by rows, panels and the status bar. */

import type { Entry, SizeMode } from "./types";

const NUM = new Intl.NumberFormat();
export const DATE = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function fmtNum(n: number | null | undefined): string {
  return n == null ? "—" : NUM.format(n);
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function sizeDisplay(
  entry: Entry,
  sizeMode: SizeMode,
): { text: string; title: string } {
  if (!entry.is_dir) {
    return {
      text: fmtBytes(entry.size),
      title: entry.size != null ? `${fmtNum(entry.size)} bytes` : "",
    };
  }
  const bytes = entry.folder_size != null ? fmtBytes(entry.folder_size) : "—";
  const bytesTitle =
    entry.folder_size != null
      ? `${fmtNum(entry.folder_size)} bytes across all nested files`
      : "Folder size unavailable";
  const count = entry.child_count != null ? fmtNum(entry.child_count) : "—";
  const countTitle =
    entry.child_count != null
      ? `${fmtNum(entry.child_count)} direct items`
      : "Item count unavailable";
  if (sizeMode === "files") return { text: count, title: countTitle };
  if (sizeMode === "both") {
    return {
      text: `${bytes} · ${count}`,
      title: `${bytesTitle} · ${countTitle}`,
    };
  }
  return { text: bytes, title: bytesTitle };
}

export function sizeSortValue(entry: Entry, sizeMode: SizeMode): number {
  if (!entry.is_dir) return entry.size || 0;
  return sizeMode === "files"
    ? entry.child_count || 0
    : entry.folder_size || 0;
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  try {
    return DATE.format(new Date(ts * 1000));
  } catch {
    return "—";
  }
}

export function entryType(entry: Entry): string {
  if (entry.type) return entry.type;
  if (entry.is_dir) return "Folder";
  const name = entry.name || baseOf(entry.path);
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toUpperCase()
    : "File";
}

export function plural(n: number, one: string, many?: string): string {
  return `${fmtNum(n)} ${n === 1 ? one : many || `${one}s`}`;
}

export function baseOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function parentOf(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}
