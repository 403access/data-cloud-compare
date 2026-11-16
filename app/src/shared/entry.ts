/**
 * Pure, platform-neutral helpers for file entries.
 *
 * Both the Bun server and the static demo build import this module, so it must
 * stay free of Node/Bun built-ins.
 */

// Jottacloud replaces these characters with fullwidth lookalikes.
const FW: Record<string, string> = {
  "\uff02": '"',
  "\uff0a": "*",
  "\uff1a": ":",
  "\uff1c": "<",
  "\uff1e": ">",
  "\uff1f": "?",
  "\uff7c": "|",
  "\uff05": "%",
};

export const STATUS_ORDER: Record<string, number> = {
  missing: 0,
  partial: 1,
  possible: 2,
  moved: 3,
  moved_match: 3,
  type_mismatch: 4,
  exact: 5,
  local_only: 6,
  unmatched: 7,
};

export function normPath(value: unknown): string {
  if (value == null) return "";
  let p = String(value).normalize("NFC");
  p = p.replace(/[\uff02\uff0a\uff1a\uff1c\uff1e\uff1f\uff7c\uff05]/g, (ch) => FW[ch] ?? ch);
  p = p.replace(/\\/g, "/").replace(/\/+/g, "/");
  return p.replace(/^\/+|\/+$/g, "");
}

export function cleanRel(value: string): string {
  const rel = normPath(value || "");
  if (rel.includes("\x00")) throw new Error("invalid path");
  const parts = rel.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.some((part) => part === "..")) throw new Error("path traversal is not allowed");
  return parts.join("/");
}

/** Human-readable type: Folder, File, or the uppercase file extension. */
export function entryType(name: string, isDir: boolean): string {
  if (isDir) return "Folder";
  name = name || "";
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) return name.slice(dot + 1).toUpperCase();
  return "File";
}

export interface SortableEntry {
  name?: string;
  is_dir: boolean;
  size?: number | null;
  folder_size?: number | null;
  child_count?: number | null;
  modified?: number | null;
  status?: string;
  type?: string;
}

export function sortEntries<T extends SortableEntry>(
  entries: T[],
  sort: string,
  direction: string,
  sizeMode = "bytes",
): T[] {
  const desc = direction === "desc";
  let key: (entry: T) => number | string;
  if (sort === "size") {
    key =
      sizeMode === "files"
        ? (entry) => (entry.is_dir ? entry.child_count : entry.size) ?? 0
        : (entry) => (entry.is_dir ? entry.folder_size : entry.size) ?? 0;
  } else if (sort === "modified") {
    key = (entry) => entry.modified ?? 0;
  } else if (sort === "status") {
    key = (entry) => STATUS_ORDER[entry.status ?? ""] ?? 99;
  } else if (sort === "type") {
    key = (entry) => (entry.type || "").toLowerCase();
  } else {
    key = (entry) => (entry.name || "").toLowerCase();
  }
  entries.sort((a, b) => {
    const ak = key(a);
    const bk = key(b);
    if (ak < bk) return desc ? 1 : -1;
    if (ak > bk) return desc ? -1 : 1;
    return 0;
  });
  entries.sort((a, b) => (a.is_dir ? 0 : 1) - (b.is_dir ? 0 : 1));
  return entries;
}

export interface FolderAgg {
  total: number;
  exact: number;
  moved: number;
  possible: number;
  missing: number;
  partial: number;
  found_at: string;
}

export function folderAgg(
  total: unknown,
  exact: unknown,
  moved: unknown,
  possible: unknown,
  missing: unknown,
  partial = 0,
  foundAt = "",
): FolderAgg {
  return {
    total: Number(total ?? 0),
    exact: Number(exact ?? 0),
    moved: Number(moved ?? 0),
    possible: Number(possible ?? 0),
    missing: Number(missing ?? 0),
    partial: Number(partial ?? 0),
    found_at: foundAt || "",
  };
}

export function buildStats(entries: SortableEntry[]) {
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  for (const entry of entries) {
    if (entry.is_dir) {
      dirs += 1;
      bytes += entry.folder_size ?? 0;
    } else {
      files += 1;
      bytes += entry.size ?? 0;
    }
  }
  return { files, dirs, items: entries.length, bytes };
}

export function makeCrumbs(rel: string, rootName: string) {
  const out = [{ name: rootName, path: "" }];
  if (rel) {
    const acc: string[] = [];
    for (const part of rel.split("/")) {
      acc.push(part);
      out.push({ name: part, path: acc.join("/") });
    }
  }
  return out;
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
