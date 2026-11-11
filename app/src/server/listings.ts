/** Listings and search for the local index and the remote snapshots. */

import type { Database } from "bun:sqlite";
import {
  BASE,
  LOCAL_DB,
  SEARCH_LIMIT,
} from "./paths";
import {
  type FolderAgg,
  basename,
  buildStats,
  chunks,
  connectRO,
  dirname,
  entryType,
  folderAgg,
  localAbs,
  makeCrumbs,
  normPath,
  placeholders,
  sortEntries,
  type SortableEntry,
} from "./model";
import { cachePath } from "./cache";
import type { Provider as ProviderModel } from "./providers";
import { LOCAL_SIZE_DB, SEARCH } from "./state";

export interface Entry extends SortableEntry {
  name: string;
  path: string;
  parent: string;
  is_dir: boolean;
  type: string;
  size: number | null;
  modified: number | null;
  status: string;
  found_at: string;
  note: string;
  child_count: number | null;
  folder_size: number | null;
  agg: FolderAgg | null;
}

interface LocalRow {
  path: string;
  size: number | null;
  modified: number | null;
  is_directory: number;
  is_file?: number;
  is_symlink?: number;
}

function statusMap(cacheCon: Database, relPaths: Entry[]): Map<string, any> {
  const norms = [...new Set(relPaths.filter((e) => e.path).map((e) => normPath(e.path)))];
  const result = new Map<string, any>();
  if (!norms.length) return result;

  const archive = new Map<string, boolean>();
  const folders = new Map<string, any>();
  const moved = new Map<string, string>();
  const localOnly = new Map<string, any>();
  for (const chunk of chunks(norms)) {
    const ph = placeholders(chunk.length);
    for (const row of cacheCon
      .query(`SELECT path, is_dir FROM archive WHERE path IN (${ph})`)
      .all(...chunk) as Array<{ path: string; is_dir: number }>) {
      archive.set(row.path, Boolean(row.is_dir));
    }
    for (const row of cacheCon
      .query(
        `SELECT path, status, total, exact, moved, possible, missing, found_at ` +
          `FROM folder WHERE path IN (${ph})`,
      )
      .all(...chunk) as any[]) {
      folders.set(row.path, row);
    }
    for (const row of cacheCon
      .query(`SELECT path, archive_path FROM moved_db WHERE path IN (${ph})`)
      .all(...chunk) as Array<{ path: string; archive_path: string }>) {
      moved.set(row.path, row.archive_path);
    }
    for (const row of cacheCon
      .query(`SELECT path, is_dir, size FROM local_only WHERE path IN (${ph})`)
      .all(...chunk) as any[]) {
      localOnly.set(row.path, row);
    }
  }

  const source = new Map<string, Entry>();
  for (const entry of relPaths) {
    const norm = normPath(entry.path);
    if (!source.has(norm)) source.set(norm, entry);
  }

  for (const [norm, entry] of source) {
    const isDir = Boolean(entry.is_dir);
    const inArchive = archive.has(norm);
    const folder = folders.get(norm);
    const move = moved.get(norm);
    let agg: FolderAgg | null = null;
    let foundAt = "";
    if (folder) {
      agg = folderAgg(
        folder.total,
        folder.exact,
        folder.moved,
        folder.possible,
        folder.missing,
        0,
        folder.found_at,
      );
    }
    let status: string;
    if (inArchive) {
      if (isDir && folder) status = folder.status;
      else if (isDir) status = "exact";
      else if (archive.get(norm)) status = "type_mismatch";
      else status = "exact";
    } else if (isDir && folder) status = folder.status;
    else if (move) {
      status = "moved_match";
      foundAt = move;
    } else if (localOnly.has(norm)) status = "local_only";
    else status = "unmatched";

    result.set(norm, {
      status,
      found_at: foundAt,
      agg,
      child_count: agg ? agg.total : null,
    });
  }
  return result;
}

function localChildCounts(con: Database, entries: Entry[]): Map<string, number> {
  const dirs = entries.filter((entry) => entry.is_dir).map((entry) => localAbs(entry.path));
  const counts = new Map<string, number>();
  for (const chunk of chunks(dirs, 400)) {
    const ph = placeholders(chunk.length);
    for (const row of con
      .query(
        `SELECT parent_path, COUNT(*) AS n FROM files ` +
          `WHERE parent_path IN (${ph}) GROUP BY parent_path`,
      )
      .all(...chunk) as Array<{ parent_path: string; n: number }>) {
      counts.set(row.parent_path, Number(row.n));
    }
  }
  return counts;
}

function localEntriesFromRows(
  rows: LocalRow[],
  cacheCon: Database,
  con: Database,
  needCounts = true,
): Entry[] {
  const entries: Entry[] = [];
  for (const row of rows) {
    const path = row.path;
    if (path === BASE || !path.startsWith(`${BASE}/`)) continue;
    const rel = path.slice(BASE.length + 1);
    const isDir = Boolean(row.is_directory);
    const name = basename(rel);
    entries.push({
      name,
      path: rel,
      parent: rel.includes("/") ? dirname(rel) : "",
      is_dir: isDir,
      type: entryType(name, isDir),
      size: isDir ? null : Number(row.size ?? 0),
      modified: row.modified ?? null,
      status: "unmatched",
      found_at: "",
      note: "",
      child_count: null,
      folder_size: null,
      agg: null,
    });
  }
  const statuses = statusMap(cacheCon, entries);
  const counts = needCounts ? localChildCounts(con, entries) : new Map<string, number>();
  for (const entry of entries) {
    const info = statuses.get(normPath(entry.path));
    if (info) Object.assign(entry, info);
    if (entry.is_dir && counts.has(localAbs(entry.path))) {
      entry.child_count = counts.get(localAbs(entry.path))!;
    }
  }
  return entries;
}

export function applyFolderSizes(entries: Entry[], dbPath: string): void {
  const dirs = new Map<string, Entry>();
  for (const entry of entries) {
    if (entry.is_dir) dirs.set(normPath(entry.path), entry);
  }
  if (!dirs.size) return;
  const con = connectRO(dbPath);
  try {
    for (const chunk of chunks([...dirs.keys()], 400)) {
      const ph = placeholders(chunk.length);
      for (const row of con
        .query(`SELECT path, bytes FROM folder_size WHERE path IN (${ph})`)
        .all(...chunk) as Array<{ path: string; bytes: number }>) {
        const entry = dirs.get(row.path);
        if (entry) entry.folder_size = Number(row.bytes ?? 0);
      }
    }
  } finally {
    con.close();
  }
}

export function applyLocalFolderSizes(entries: Entry[]): void {
  if (LOCAL_SIZE_DB === null) return;
  applyFolderSizes(entries, LOCAL_SIZE_DB);
}

export function applyFolderRollups(
  provider: ProviderModel,
  entries: Entry[],
  con?: Database,
): void {
  const dirs = [...new Set(entries.filter((e) => e.is_dir).map((e) => normPath(e.path)))];
  if (!dirs.length) return;
  const own = con === undefined;
  const db = con ?? connectRO(cachePath(provider));
  const stats = new Map<string, any>();
  try {
    for (const chunk of chunks(dirs, 400)) {
      const ph = placeholders(chunk.length);
      for (const row of db
        .query(
          `
          SELECT a.parent AS p, COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(s.status,'exact')='exact'
                       THEN 1 ELSE 0 END) AS exact,
              SUM(CASE WHEN COALESCE(s.status,'exact')='moved'
                       THEN 1 ELSE 0 END) AS moved,
              SUM(CASE WHEN COALESCE(s.status,'exact')='possible'
                       THEN 1 ELSE 0 END) AS possible,
              SUM(CASE WHEN COALESCE(s.status,'exact')='missing'
                       THEN 1 ELSE 0 END) AS missing,
              SUM(CASE WHEN COALESCE(s.status,'exact')='partial'
                       THEN 1 ELSE 0 END) AS partial
          FROM archive a
          LEFT JOIN status s ON s.path = a.path
          WHERE a.parent IN (${ph})
          GROUP BY a.parent
          `,
        )
        .all(...chunk) as any[]) {
        stats.set(row.p, row);
      }
    }
  } finally {
    if (own) db.close();
  }

  for (const entry of entries) {
    const row = stats.get(normPath(entry.path));
    if (!row || !row.total) continue;
    const total = Number(row.total);
    const exact = Number(row.exact ?? 0);
    const moved = Number(row.moved ?? 0);
    const possible = Number(row.possible ?? 0);
    const missing = Number(row.missing ?? 0);
    const partial = Number(row.partial ?? 0);
    if (entry.child_count == null) entry.child_count = total;
    entry.agg = folderAgg(
      total,
      exact,
      moved,
      possible,
      missing,
      partial,
      entry.agg?.found_at ?? "",
    );
    if (missing === total) entry.status = "missing";
    else if (missing || partial) entry.status = "partial";
    else if (possible) entry.status = "possible";
    else if (moved) entry.status = "moved";
    else entry.status = "exact";
  }
}

export function listLocal(
  provider: ProviderModel,
  rel: string,
  sort: string,
  direction: string,
  hidden: boolean,
  sizeMode = "bytes",
) {
  const con = connectRO(LOCAL_DB);
  const cacheCon = connectRO(cachePath(provider));
  let entries: Entry[];
  let exists: boolean;
  try {
    const rows = con
      .query(
        `SELECT path, size, modified, is_directory, is_file, is_symlink ` +
          `FROM files WHERE parent_path = ?`,
      )
      .all(localAbs(rel)) as LocalRow[];
    exists =
      rel === "" ||
      Boolean(
        con
          .query("SELECT 1 FROM files WHERE path = ? AND is_directory = 1")
          .get(localAbs(rel)),
      );
    entries = localEntriesFromRows(rows, cacheCon, con);
    applyFolderRollups(provider, entries, cacheCon);
    applyLocalFolderSizes(entries);
  } finally {
    con.close();
    cacheCon.close();
  }

  if (!hidden) entries = entries.filter((entry) => !entry.name.startsWith("."));
  sortEntries(entries, sort, direction, sizeMode);
  return {
    side: "local",
    provider: provider.key,
    path: rel,
    exists,
    crumbs: makeCrumbs(rel, BASE),
    entries,
    stats: buildStats(entries),
  };
}

function localRowsByIds(ids: number[]): LocalRow[] {
  const con = connectRO(LOCAL_DB);
  const rows: LocalRow[] = [];
  try {
    for (const chunk of chunks(ids, 400)) {
      const ph = placeholders(chunk.length);
      rows.push(
        ...(con
          .query(
            `SELECT path, size, modified, is_directory, is_file, is_symlink ` +
              `FROM files WHERE id IN (${ph})`,
          )
          .all(...chunk) as LocalRow[]),
      );
    }
  } finally {
    con.close();
  }
  return rows;
}

export function searchLocal(
  provider: ProviderModel,
  q: string,
  scope: string,
  rel: string,
  hidden: boolean,
) {
  const scopePath = scope === "folder" && rel ? localAbs(rel) : null;
  const indexes = SEARCH.get(provider.key);
  if (!indexes) throw new Error(`${provider.label} search index is not ready`);
  const { ids, truncated: initialTruncated } = indexes.local.search(
    q,
    SEARCH_LIMIT * 3,
    scopePath,
  );
  const rows = localRowsByIds(ids);

  const con = connectRO(LOCAL_DB);
  const cacheCon = connectRO(cachePath(provider));
  let entries: Entry[];
  try {
    entries = localEntriesFromRows(rows, cacheCon, con, true);
    applyFolderRollups(provider, entries, cacheCon);
    applyLocalFolderSizes(entries);
  } finally {
    con.close();
    cacheCon.close();
  }

  if (!hidden) entries = entries.filter((entry) => !entry.name.startsWith("."));
  let truncated = initialTruncated;
  if (entries.length > SEARCH_LIMIT) {
    truncated = true;
    entries = entries.slice(0, SEARCH_LIMIT);
  }
  sortEntries(entries, "name", "asc");
  return {
    side: "local",
    provider: provider.key,
    query: q,
    scope,
    entries,
    truncated,
  };
}

interface RemoteRow {
  path: string;
  name: string;
  is_dir: number;
  size: number | null;
  status: string | null;
  found_at: string | null;
  note: string | null;
  fstatus: string | null;
  ftotal: number | null;
  fexact: number | null;
  fmoved: number | null;
  fpossible: number | null;
  fmissing: number | null;
  ffound: string | null;
}

function remoteEntry(row: RemoteRow): Entry {
  const isDir = Boolean(row.is_dir);
  const status = isDir && row.fstatus ? row.fstatus : row.status || "exact";
  let agg: FolderAgg | null = null;
  if (isDir && row.ftotal !== null) {
    agg = folderAgg(
      row.ftotal,
      row.fexact,
      row.fmoved,
      row.fpossible,
      row.fmissing,
      0,
      row.ffound || "",
    );
  }
  return {
    name: row.name,
    path: row.path,
    parent: row.path.includes("/") ? dirname(row.path) : "",
    is_dir: isDir,
    type: entryType(row.name, isDir),
    size: isDir ? null : Number(row.size ?? 0),
    modified: null,
    status,
    found_at: row.found_at || (agg ? agg.found_at : ""),
    note: row.note || "",
    child_count: null,
    folder_size: null,
    agg,
  };
}

export function listRemote(
  provider: ProviderModel,
  rel: string,
  sort: string,
  direction: string,
  hidden: boolean,
  sizeMode = "bytes",
) {
  const con = connectRO(cachePath(provider));
  let rows: RemoteRow[];
  let exists: boolean;
  try {
    rows = con
      .query(
        `SELECT a.path, a.name, a.is_dir, a.size,
                s.status AS status, s.found_at AS found_at, s.note AS note,
                f.status AS fstatus, f.total AS ftotal, f.exact AS fexact,
                f.moved AS fmoved, f.possible AS fpossible,
                f.missing AS fmissing, f.found_at AS ffound
         FROM archive a
         LEFT JOIN status s ON s.path = a.path
         LEFT JOIN folder f ON f.path = a.path
         WHERE a.parent = ?`,
      )
      .all(rel) as RemoteRow[];
    exists =
      rel === "" ||
      Boolean(
        con
          .query("SELECT 1 FROM archive WHERE path = ? AND is_dir = 1")
          .get(rel),
      );
  } finally {
    con.close();
  }

  let entries: Entry[] = [];
  for (const row of rows) {
    if (!hidden && row.name.startsWith(".")) continue;
    entries.push(remoteEntry(row));
  }
  applyFolderRollups(provider, entries);
  applyFolderSizes(entries, cachePath(provider));
  sortEntries(entries, sort, direction, sizeMode);
  return {
    side: "remote",
    provider: provider.key,
    path: rel,
    exists,
    crumbs: makeCrumbs(rel, provider.rootLabel),
    entries,
    stats: buildStats(entries),
  };
}

const REMOTE_COLS = `
    a.path, a.name, a.is_dir, a.size,
    s.status AS status, s.found_at AS found_at, s.note AS note,
    f.status AS fstatus, f.total AS ftotal, f.exact AS fexact,
    f.moved AS fmoved, f.possible AS fpossible,
    f.missing AS fmissing, f.found_at AS ffound
`;

function remoteRowsByRowids(provider: ProviderModel, ids: number[]): RemoteRow[] {
  const con = connectRO(cachePath(provider));
  const rows: RemoteRow[] = [];
  try {
    for (const chunk of chunks(ids, 400)) {
      const ph = placeholders(chunk.length);
      rows.push(
        ...(con
          .query(
            `SELECT ${REMOTE_COLS}
             FROM archive a
             LEFT JOIN status s ON s.path = a.path
             LEFT JOIN folder f ON f.path = a.path
             WHERE a.rowid IN (${ph})`,
          )
          .all(...chunk) as RemoteRow[]),
      );
    }
  } finally {
    con.close();
  }
  return rows;
}

export function searchRemote(
  provider: ProviderModel,
  q: string,
  scope: string,
  rel: string,
  hidden: boolean,
) {
  const scopePath = scope === "folder" && rel ? rel : null;
  const indexes = SEARCH.get(provider.key);
  if (!indexes) throw new Error(`${provider.label} search index is not ready`);
  const { ids, truncated: initialTruncated } = indexes.archive.search(
    q,
    SEARCH_LIMIT * 3,
    scopePath,
  );
  const rows = remoteRowsByRowids(provider, ids);

  const entries: Entry[] = [];
  let truncated = initialTruncated;
  for (const row of rows) {
    if (!hidden && row.name.startsWith(".")) continue;
    entries.push(remoteEntry(row));
    if (entries.length >= SEARCH_LIMIT) {
      truncated = true;
      break;
    }
  }
  applyFolderRollups(provider, entries);
  applyFolderSizes(entries, cachePath(provider));
  sortEntries(entries, "name", "asc");
  return {
    side: "remote",
    provider: provider.key,
    query: q,
    scope,
    entries,
    truncated,
  };
}
