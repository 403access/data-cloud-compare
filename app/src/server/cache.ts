/**
 * Build the read-only SQLite caches used by the explorer.
 *
 * The schema, signatures and on-disk layout intentionally match the legacy
 * Python implementation, so an existing cache is reused without rebuilding.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { CACHE_DIR, LOCAL_DB } from "./paths";
import {
  localOnlyCsv,
  type Provider,
  reportJson,
  summaryJson,
} from "./providers";
import { basename as pathBasename, dirname, normPath } from "./model";

const SCHEMA_VERSION = 1;
const FOLDER_SIZE_VERSION = 1;

const STATUS_MAP: Record<string, string> = {
  present_exact: "exact",
  present_moved: "moved",
  possible: "possible",
  size_mismatch: "possible",
  partial: "partial",
  missing: "missing",
  unresolved: "missing",
};

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function cachePath(provider: Provider): string {
  const name =
    provider.key === "jottacloud" ? "explorer.db" : `explorer-${provider.key}.db`;
  return resolve(CACHE_DIR, name);
}

function signature(provider: Provider): string {
  const parts: string[] = [];
  for (const path of [provider.archiveJson, reportJson(provider), localOnlyCsv(provider)]) {
    try {
      const st = statSync(path, { bigint: true });
      parts.push(`${basename(path)}:${st.size}:${st.mtimeNs}`);
    } catch {
      parts.push(`${basename(path)}:missing`);
    }
  }
  return parts.join("|");
}

export function localFolderSizesPath(): string {
  return resolve(CACHE_DIR, "local-folder-sizes.db");
}

function localFolderSizesSignature(localDb: string, base: string): string {
  try {
    const st = statSync(localDb, { bigint: true });
    return `${st.size}:${st.mtimeNs}:${base}`;
  } catch {
    return "missing";
  }
}

/**
 * Recursive byte totals for every folder in *rows*.
 *
 * Rows must be sorted by path and contain `[path, isDir, size]`. Paths are
 * laid out depth-first in that order, so one pass with a stack yields every
 * subtree sum.
 */
export function folderTotals(
  rows: Iterable<[string, number, number]>,
  base = "",
): Map<string, number> {
  const totals = new Map<string, number>();
  const stack: Array<{ folder: string; before: number }> = [];
  let running = 0;
  const prefix = base ? `${base}/` : "";
  for (const row of rows) {
    let path = row[0];
    const isDir = Number(row[1]) !== 0;
    const size = Number(row[2] ?? 0);
    if (prefix) {
      if (!path.startsWith(prefix)) continue;
      path = path.slice(prefix.length);
    }
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (path.startsWith(`${top.folder}/`)) break;
      stack.pop();
      totals.set(top.folder, running - top.before);
    }
    if (isDir) stack.push({ folder: path, before: running });
    else running += size;
  }
  while (stack.length) {
    const top = stack.pop()!;
    totals.set(top.folder, running - top.before);
  }
  return totals;
}

function* folderSizeRows(
  rows: Iterable<any>,
  dirKey: string,
): Generator<[string, number, number]> {
  for (const row of rows) {
    yield [String(row.path), Number(row[dirKey] ?? 0), Number(row.size ?? 0)];
  }
}

function writeFolderSizes(
  con: Database,
  rows: Iterable<[string, number, number]>,
  base = "",
): number {
  const totals = folderTotals(rows, base);
  const insert = con.prepare(
    "INSERT OR REPLACE INTO folder_size(path,bytes) VALUES (?,?)",
  );
  con.transaction(() => {
    for (const [path, bytes] of totals) insert.run(path, bytes);
  })();
  return totals.size;
}

function ensureProviderFolderSizes(dbPath: string): string {
  const con = new Database(dbPath);
  try {
    const meta = new Map<string, string>();
    for (const row of con.query("SELECT key,value FROM meta").all() as Array<{
      key: string;
      value: string;
    }>) {
      meta.set(row.key, row.value);
    }
    if (meta.get("folder_sizes") === String(FOLDER_SIZE_VERSION)) return dbPath;
    log("  indexing recursive folder sizes …");
    const t0 = performance.now();
    con.exec(
      "CREATE TABLE IF NOT EXISTS folder_size (" +
        "path TEXT PRIMARY KEY, bytes INTEGER NOT NULL) WITHOUT ROWID",
    );
    const rows = folderSizeRows(
      con.query("SELECT path,is_dir,size FROM archive ORDER BY path").iterate() as Iterable<any>,
      "is_dir",
    );
    const count = writeFolderSizes(con, rows);
    con.run(
      "INSERT OR REPLACE INTO meta(key,value) VALUES ('folder_sizes',?)",
      [String(FOLDER_SIZE_VERSION)],
    );
    log(
      `  ${count.toLocaleString()} folder sizes ready in ` +
        `${((performance.now() - t0) / 1000).toFixed(1)}s`,
    );
  } finally {
    con.close();
  }
  return dbPath;
}

export function ensureLocalFolderSizes(localDb: string, base: string): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const dbPath = localFolderSizesPath();
  const sig = localFolderSizesSignature(localDb, base);
  if (existsSync(dbPath)) {
    try {
      const con = new Database(dbPath);
      try {
        const meta = new Map<string, string>();
        for (const row of con.query("SELECT key,value FROM meta").all() as Array<{
          key: string;
          value: string;
        }>) {
          meta.set(row.key, row.value);
        }
        if (
          meta.get("folder_sizes") === String(FOLDER_SIZE_VERSION) &&
          meta.get("signature") === sig
        ) {
          return dbPath;
        }
      } finally {
        con.close();
      }
    } catch {
      /* rebuild below */
    }
  }

  const tmp = dbPath.replace(/\.db$/, ".db.tmp");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      rmSync(tmp + suffix);
    } catch {
      /* ignore */
    }
  }

  log("Indexing local folder sizes (one-time) …");
  const t0 = performance.now();
  const source = new Database(localDb, { readonly: true });
  const con = new Database(tmp);
  try {
    con.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      PRAGMA temp_store = MEMORY;
      CREATE TABLE meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
      );
      CREATE TABLE folder_size (
          path  TEXT PRIMARY KEY,
          bytes INTEGER NOT NULL
      ) WITHOUT ROWID;
    `);
    const rows = folderSizeRows(
      source
        .query(
          "SELECT path,is_directory,size FROM files " +
            "WHERE path >= ? AND path < ? ORDER BY path",
        )
        .iterate(`${base}/`, `${base}0`) as Iterable<any>,
      "is_directory",
    );
    const count = writeFolderSizes(con, rows, base);
    con.run(
      "INSERT INTO meta(key,value) VALUES ('folder_sizes',?)",
      [String(FOLDER_SIZE_VERSION)],
    );
    con.run("INSERT INTO meta(key,value) VALUES ('signature',?)", [sig]);
    log(
      `  ${count.toLocaleString()} local folder sizes ready in ` +
        `${((performance.now() - t0) / 1000).toFixed(1)}s`,
    );
  } finally {
    source.close();
    con.close();
  }
  renameSync(tmp, dbPath);
  return dbPath;
}

function createSchema(con: Database): void {
  con.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -200000;

    CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE archive (
        path   TEXT PRIMARY KEY,
        parent TEXT NOT NULL DEFAULT '',
        name   TEXT NOT NULL,
        is_dir INTEGER NOT NULL,
        size   INTEGER NOT NULL
    );
    CREATE TABLE status (
        path     TEXT PRIMARY KEY,
        status   TEXT NOT NULL,
        found_at TEXT NOT NULL DEFAULT '',
        note     TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE folder (
        path     TEXT PRIMARY KEY,
        status   TEXT NOT NULL,
        total    INTEGER NOT NULL DEFAULT 0,
        exact    INTEGER NOT NULL DEFAULT 0,
        moved    INTEGER NOT NULL DEFAULT 0,
        possible INTEGER NOT NULL DEFAULT 0,
        missing  INTEGER NOT NULL DEFAULT 0,
        found_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE moved_db (
        path         TEXT PRIMARY KEY,
        archive_path TEXT NOT NULL
    );
    CREATE TABLE local_only (
        path   TEXT PRIMARY KEY,
        is_dir INTEGER NOT NULL,
        size   INTEGER NOT NULL
    );
    CREATE TABLE folder_size (
        path  TEXT PRIMARY KEY,
        bytes INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);
}

function createIndexes(con: Database): void {
  log("  creating indexes …");
  con.exec(`
    CREATE INDEX idx_archive_parent ON archive(parent);
    CREATE INDEX idx_archive_name ON archive(name COLLATE NOCASE);
    CREATE INDEX idx_archive_is_dir ON archive(is_dir);
  `);
}

interface ArchiveEntry {
  rel: string;
  parent: string;
  name: string;
  isDir: number;
  size: number;
}

function buildArchive(con: Database, provider: Provider): void {
  log(`  reading ${basename(provider.archiveJson)} …`);
  const t0 = performance.now();
  let text: string | null = readFileSync(provider.archiveJson, "utf8");
  let data: any = JSON.parse(text);
  text = null;
  if (!Array.isArray(data)) data = data?.items ?? data?.files ?? [];
  log(
    `  ${data.length.toLocaleString()} ${provider.label} entries parsed in ` +
      `${((performance.now() - t0) / 1000).toFixed(1)}s`,
  );

  let entries = new Map<string, ArchiveEntry>();
  const prefixes = new Set<string>();
  for (const raw of data) {
    const rel = normPath(raw?.Path || raw?.Name || "");
    if (!rel) continue;
    const isDir = raw?.IsDir ?? raw?.is_dir ?? false ? 1 : 0;
    let size = Number.parseInt(raw?.Size ?? raw?.size ?? 0, 10);
    if (!Number.isFinite(size) || size < 0) size = 0;
    prefixes.add(rel.split("/", 1)[0]);
    const previous = entries.get(rel);
    if (!previous || (isDir && !previous.isDir)) {
      entries.set(rel, {
        rel,
        parent: dirname(rel),
        name: pathBasename(rel),
        isDir,
        size,
      });
    }
  }
  data = null;

  // If a Jottacloud listing came from the device root, every path starts with
  // "Archive/". Strip that one level, exactly like compare.py.
  if (
    provider.key === "jottacloud" &&
    prefixes.size === 1 &&
    prefixes.has("Archive")
  ) {
    const stripped = new Map<string, ArchiveEntry>();
    for (const [rel, row] of entries) {
      if (rel === "Archive") continue;
      const next = rel.startsWith("Archive/") ? rel.slice("Archive/".length) : rel;
      stripped.set(next, {
        rel: next,
        parent: dirname(next),
        name: pathBasename(next),
        isDir: row.isDir,
        size: row.size,
      });
    }
    entries = stripped;
  }

  // Snapshots normally contain every folder, but make sure every parent exists
  // so navigation can never reach a dead end.
  const extra = new Map<string, ArchiveEntry>();
  for (const rel of entries.keys()) {
    let parent = dirname(rel);
    while (parent && !entries.has(parent) && !extra.has(parent)) {
      extra.set(parent, {
        rel: parent,
        parent: dirname(parent),
        name: pathBasename(parent),
        isDir: 1,
        size: 0,
      });
      parent = dirname(parent);
    }
  }
  if (extra.size) log(`  adding ${extra.size.toLocaleString()} missing parent folders`);
  for (const [key, value] of extra) entries.set(key, value);

  log(`  writing ${entries.size.toLocaleString()} tree rows …`);
  const insert = con.prepare(
    "INSERT OR IGNORE INTO archive(path,parent,name,is_dir,size) VALUES (?,?,?,?,?)",
  );
  con.transaction(() => {
    let batch: ArchiveEntry[] = [];
    const flush = () => {
      for (const row of batch) insert.run(row.rel, row.parent, row.name, row.isDir, row.size);
      batch = [];
    };
    for (const row of entries.values()) {
      batch.push(row);
      if (batch.length >= 20000) flush();
    }
    if (batch.length) flush();
  })();
}

function buildStatus(con: Database, provider: Provider): void {
  log(`  reading ${basename(reportJson(provider))} …`);
  const t0 = performance.now();
  const report = JSON.parse(readFileSync(reportJson(provider), "utf8"));
  const issues: any[] = report.issues ?? [];
  const folders: any[] = report.folders ?? [];
  log(
    `  ${issues.length.toLocaleString()} issues / ${folders.length.toLocaleString()} ` +
      `folders parsed in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
  );

  const statusInsert = con.prepare(
    "INSERT OR REPLACE INTO status(path,status,found_at,note) VALUES (?,?,?,?)",
  );
  const movedInsert = con.prepare(
    "INSERT OR REPLACE INTO moved_db(path,archive_path) VALUES (?,?)",
  );
  con.transaction(() => {
    for (const issue of issues) {
      const path = normPath(issue?.p);
      if (!path) continue;
      const status = STATUS_MAP[issue?.s] ?? issue?.s ?? "missing";
      const found = normPath(issue?.f);
      const note = issue?.n ?? "";
      statusInsert.run(path, status, found, note);
      if (found && (status === "moved" || status === "partial")) {
        movedInsert.run(found, path);
      }
    }
  })();

  const folderInsert = con.prepare(
    "INSERT OR REPLACE INTO folder(path,status,total,exact,moved,possible," +
      "missing,found_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  con.transaction(() => {
    for (const folder of folders) {
      const path = normPath(folder?.p);
      if (!path) continue;
      const status = STATUS_MAP[folder?.s] ?? folder?.s ?? "missing";
      const total = Number(folder?.n ?? 0);
      const exact = Number(folder?.e ?? 0);
      const moved = Number(folder?.m ?? 0);
      const missing = Number(folder?.x ?? 0);
      const possible = Math.max(0, total - exact - moved - missing);
      folderInsert.run(
        path,
        status,
        total,
        exact,
        moved,
        possible,
        missing,
        normPath(folder?.f),
      );
    }
  })();

  log(`  reading ${basename(localOnlyCsv(provider))} …`);
  const csv = readFileSync(localOnlyCsv(provider), "utf8");
  const localInsert = con.prepare(
    "INSERT OR REPLACE INTO local_only(path,is_dir,size) VALUES (?,?,?)",
  );
  con.transaction(() => {
    const rows = parseCsv(csv);
    if (!rows.length) return;
    const header = rows[0];
    const localIndex = header.indexOf("local_path");
    const typeIndex = header.indexOf("type");
    const sizeIndex = header.indexOf("size");
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row.length) continue;
      const path = normPath(row[localIndex]);
      if (!path) continue;
      let size = Number.parseInt(row[sizeIndex] ?? "0", 10);
      if (!Number.isFinite(size)) size = 0;
      localInsert.run(path, row[typeIndex] === "dir" ? 1 : 0, size);
    }
  })();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else quoted = false;
      } else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (ch === "\r") {
      /* handled by the following newline */
    } else value += ch;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function buildCache(provider: Provider, force = false): string {
  const dbPath = cachePath(provider);
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!force && existsSync(dbPath)) {
    try {
      const con = new Database(dbPath);
      try {
        const meta = new Map<string, string>();
        for (const row of con.query("SELECT key,value FROM meta").all() as Array<{
          key: string;
          value: string;
        }>) {
          meta.set(row.key, row.value);
        }
        if (
          meta.get("schema_version") === String(SCHEMA_VERSION) &&
          meta.get("signature") === signature(provider)
        ) {
          return ensureProviderFolderSizes(dbPath);
        }
      } finally {
        con.close();
      }
    } catch {
      /* rebuild below */
    }
  }

  const tmp = dbPath.replace(/\.db$/, ".db.tmp");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      rmSync(tmp + suffix);
    } catch {
      /* ignore */
    }
  }

  log(`Building ${provider.label} explorer cache (one-time, ~30s) …`);
  const t0 = performance.now();
  const con = new Database(tmp);
  try {
    createSchema(con);
    buildArchive(con, provider);
    buildStatus(con, provider);
    createIndexes(con);
    log("  indexing recursive folder sizes …");
    const tSizes = performance.now();
    const rows = folderSizeRows(
      con.query("SELECT path,is_dir,size FROM archive ORDER BY path").iterate() as Iterable<any>,
      "is_dir",
    );
    const count = writeFolderSizes(con, rows);
    log(
      `  ${count.toLocaleString()} folder sizes ready in ` +
        `${((performance.now() - tSizes) / 1000).toFixed(1)}s`,
    );
    con.run("INSERT INTO meta(key,value) VALUES ('schema_version',?)", [
      String(SCHEMA_VERSION),
    ]);
    con.run("INSERT INTO meta(key,value) VALUES ('signature',?)", [signature(provider)]);
    con.run("INSERT INTO meta(key,value) VALUES ('folder_sizes',?)", [
      String(FOLDER_SIZE_VERSION),
    ]);
  } finally {
    con.close();
  }
  renameSync(tmp, dbPath);
  log(
    `${provider.label} cache ready in ${((performance.now() - t0) / 1000).toFixed(1)}s: ${dbPath}`,
  );
  return dbPath;
}

export function loadSummary(provider: Provider): Record<string, any> {
  try {
    return JSON.parse(readFileSync(summaryJson(provider), "utf8"));
  } catch {
    return {};
  }
}

export function localDatabasePath(): string {
  return LOCAL_DB;
}
