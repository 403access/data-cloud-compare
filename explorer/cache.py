#!/usr/bin/env python3
"""Build the read-only cache used by the two-pane explorer.

The explorer never touches a live /mnt/tank mount.  It browses:

  left  -> file_indexer.db   (the /mnt/tank index snapshot)
  right -> a provider snapshot (Jottacloud archive.json, Google Drive
           google_drive.json, …)

A provider snapshot is large (typically >1M entries) and is a flat list, so it
is converted once into a small SQLite tree.  Status information from the
provider's report_data.json and local_only.csv is folded into the same cache.

Each provider gets its own cache database; the Jottacloud one keeps the old
``explorer.db`` name so existing caches stay valid.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
from pathlib import Path

try:
    from .providers import Provider, get_provider
except ImportError:
    from providers import Provider, get_provider

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
SCHEMA_VERSION = 1
FOLDER_SIZE_VERSION = 1

# Jottacloud replaces these characters with fullwidth lookalikes.
FW = str.maketrans({
    "\uff02": '"', "\uff0a": "*", "\uff1a": ":", "\uff1c": "<",
    "\uff1e": ">", "\uff1f": "?", "\uff7c": "|", "\uff05": "%",
})

STATUS_MAP = {
    "present_exact": "exact",
    "present_moved": "moved",
    "possible": "possible",
    "size_mismatch": "possible",
    "partial": "partial",
    "missing": "missing",
    "unresolved": "missing",
}


def norm_path(p) -> str:
    """Same normalisation as scripts/compare.py."""
    if p is None:
        return ""
    p = unicodedata.normalize("NFC", str(p))
    p = p.translate(FW)
    p = p.replace("\\", "/")
    p = re.sub(r"/+", "/", p)
    return p.strip("/")


def _dirname(p: str) -> str:
    return p.rpartition("/")[0]


def _basename(p: str) -> str:
    return p.rpartition("/")[2]


def cache_path(provider: Provider) -> Path:
    name = ("explorer.db" if provider.key == "jottacloud"
            else f"explorer-{provider.key}.db")
    return CACHE_DIR / name


def _signature(provider: Provider) -> str:
    parts = []
    for path in (provider.archive_json, provider.report_json,
                 provider.local_only_csv):
        try:
            st = path.stat()
            parts.append(f"{path.name}:{st.st_size}:{st.st_mtime_ns}")
        except OSError:
            parts.append(f"{path.name}:missing")
    return "|".join(parts)


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _build_archive(con: sqlite3.Connection, provider: Provider) -> None:
    _log(f"  reading {provider.archive_json.name} …")
    t0 = time.time()
    with open(provider.archive_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("items") or data.get("files") or []
    _log(f"  {len(data):,} {provider.label} entries parsed "
         f"in {time.time() - t0:.1f}s")

    entries: dict[str, tuple] = {}
    prefixes = set()
    for e in data:
        rel = norm_path(e.get("Path") or e.get("Name") or "")
        if not rel:
            continue
        isdir = 1 if e.get("IsDir", e.get("is_dir", False)) else 0
        try:
            size = int(e.get("Size") or e.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        if size < 0:
            size = 0
        prefix = rel.split("/", 1)[0]
        prefixes.add(prefix)
        prev = entries.get(rel)
        # If a path is duplicated, prefer the directory entry.
        if prev is None or (isdir and not prev[3]):
            entries[rel] = (rel, _dirname(rel), _basename(rel), isdir, size)

    # If a Jottacloud listing came from the device root, every path starts
    # with "Archive/".  Strip that one level, exactly like compare.py.
    if (provider.key == "jottacloud" and len(prefixes) == 1
            and "Archive" in prefixes):
        stripped: dict[str, tuple] = {}
        for rel, row in entries.items():
            if rel == "Archive":
                continue
            if rel.startswith("Archive/"):
                rel = rel[len("Archive/"):]
            stripped[rel] = (rel, _dirname(rel), _basename(rel), row[3], row[4])
        entries = stripped

    # Snapshots normally contain every folder, but make sure every magnetic
    # parent exists so navigation can never reach a dead end.
    extra: dict[str, tuple] = {}
    for rel in list(entries):
        parent = _dirname(rel)
        while parent and parent not in entries and parent not in extra:
            extra[parent] = (parent, _dirname(parent), _basename(parent), 1, 0)
            parent = _dirname(parent)
    if extra:
        _log(f"  adding {len(extra):,} missing parent folders")
        entries.update(extra)

    _log(f"  writing {len(entries):,} tree rows …")
    rows = entries.values()
    batch = []
    for row in rows:
        batch.append(row)
        if len(batch) >= 20000:
            con.executemany(
                "INSERT OR IGNORE INTO archive(path,parent,name,is_dir,size) "
                "VALUES (?,?,?,?,?)", batch)
            batch.clear()
    if batch:
        con.executemany(
            "INSERT OR IGNORE INTO archive(path,parent,name,is_dir,size) "
            "VALUES (?,?,?,?,?)", batch)


def _build_status(con: sqlite3.Connection, provider: Provider) -> None:
    _log(f"  reading {provider.report_json.name} …")
    t0 = time.time()
    with open(provider.report_json, "r", encoding="utf-8") as f:
        report = json.load(f)
    issues = report.get("issues", [])
    folders = report.get("folders", [])
    _log(f"  {len(issues):,} issues / {len(folders):,} folders parsed "
         f"in {time.time() - t0:.1f}s")

    status_rows = []
    moved_rows = []
    for i in issues:
        path = norm_path(i.get("p"))
        if not path:
            continue
        status = STATUS_MAP.get(i.get("s"), i.get("s") or "missing")
        found = norm_path(i.get("f"))
        note = i.get("n") or ""
        status_rows.append((path, status, found, note))
        if found and status in ("moved", "partial"):
            moved_rows.append((found, path))
    con.executemany(
        "INSERT OR REPLACE INTO status(path,status,found_at,note) VALUES (?,?,?,?)",
        status_rows)

    folder_rows = []
    for f in folders:
        path = norm_path(f.get("p"))
        if not path:
            continue
        status = STATUS_MAP.get(f.get("s"), f.get("s") or "missing")
        total = int(f.get("n") or 0)
        exact = int(f.get("e") or 0)
        moved = int(f.get("m") or 0)
        missing = int(f.get("x") or 0)
        possible = max(0, total - exact - moved - missing)
        folder_rows.append((path, status, total, exact, moved, possible,
                            missing, norm_path(f.get("f"))))
    con.executemany(
        "INSERT OR REPLACE INTO folder(path,status,total,exact,moved,possible,"
        "missing,found_at) VALUES (?,?,?,?,?,?,?,?)", folder_rows)

    if moved_rows:
        con.executemany(
            "INSERT OR REPLACE INTO moved_db(path,archive_path) VALUES (?,?)",
            moved_rows)

    _log(f"  reading {provider.local_only_csv.name} …")
    local_rows = []
    with open(provider.local_only_csv, "r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            path = norm_path(row.get("local_path"))
            if not path:
                continue
            try:
                size = int(row.get("size") or 0)
            except ValueError:
                size = 0
            local_rows.append((path, 1 if row.get("type") == "dir" else 0, size))
    con.executemany(
        "INSERT OR REPLACE INTO local_only(path,is_dir,size) VALUES (?,?,?)",
        local_rows)


def local_folder_sizes_path() -> Path:
    return CACHE_DIR / "local-folder-sizes.db"


def _local_folder_sizes_signature(local_db: Path, base: str) -> str:
    try:
        st = local_db.stat()
    except OSError:
        return "missing"
    return f"{st.st_size}:{st.st_mtime_ns}:{base}"


def _folder_totals(rows, base: str = ""):
    """Return recursive byte totals for every folder in *rows*.

    Rows must be sorted by path and contain ``(path, is_dir, size)``.  Paths
    are laid out depth-first in that order, so a running total plus a stack of
    open folders yields every subtree sum in one pass.
    """
    totals: dict[str, int] = {}
    stack: list[tuple[str, int]] = []
    running = 0
    prefix = base + "/" if base else ""
    cut = len(prefix)
    for path, is_dir, size in rows:
        if prefix:
            if not path.startswith(prefix):
                continue
            path = path[cut:]
        while stack and not path.startswith(stack[-1][0] + "/"):
            folder, before = stack.pop()
            totals[folder] = running - before
        if is_dir:
            stack.append((path, running))
        else:
            running += size or 0
    while stack:
        folder, before = stack.pop()
        totals[folder] = running - before
    return totals


def _write_folder_sizes(con: sqlite3.Connection, rows, base: str = "") -> int:
    totals = _folder_totals(rows, base)
    con.executemany(
        "INSERT OR REPLACE INTO folder_size(path,bytes) VALUES (?,?)",
        totals.items())
    return len(totals)


def ensure_provider_folder_sizes(db_path: Path) -> Path:
    """Add the recursive folder-size table to an existing provider cache."""
    con = sqlite3.connect(str(db_path))
    try:
        meta = dict(con.execute("SELECT key,value FROM meta").fetchall())
        if meta.get("folder_sizes") == str(FOLDER_SIZE_VERSION):
            return db_path
        _log("  indexing recursive folder sizes …")
        t0 = time.time()
        con.execute(
            "CREATE TABLE IF NOT EXISTS folder_size ("
            "path TEXT PRIMARY KEY, bytes INTEGER NOT NULL) WITHOUT ROWID")
        rows = con.execute(
            "SELECT path,is_dir,size FROM archive ORDER BY path")
        count = _write_folder_sizes(con, rows)
        con.execute(
            "INSERT OR REPLACE INTO meta(key,value) VALUES ('folder_sizes',?)",
            (str(FOLDER_SIZE_VERSION),))
        con.commit()
        _log(f"  {count:,} folder sizes ready in {time.time() - t0:.1f}s")
    finally:
        con.close()
    return db_path


def ensure_local_folder_sizes(local_db: Path, base: str) -> Path:
    """Build/refresh a shared recursive size index for the local snapshot."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    db_path = local_folder_sizes_path()
    signature = _local_folder_sizes_signature(local_db, base)
    if db_path.exists():
        try:
            con = sqlite3.connect(str(db_path))
            meta = dict(con.execute("SELECT key,value FROM meta").fetchall())
            con.close()
            if (meta.get("folder_sizes") == str(FOLDER_SIZE_VERSION)
                    and meta.get("signature") == signature):
                return db_path
        except Exception:
            pass

    tmp = db_path.with_suffix(".db.tmp")
    for suffix in ("", "-wal", "-shm", "-journal"):
        try:
            Path(str(tmp) + suffix).unlink()
        except FileNotFoundError:
            pass

    _log("Indexing local folder sizes (one-time) …")
    t0 = time.time()
    source = sqlite3.connect(
        local_db.resolve().as_uri() + "?mode=ro", uri=True, timeout=20)
    con = sqlite3.connect(str(tmp))
    try:
        con.executescript("""
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
        """)
        rows = source.execute(
            "SELECT path,is_directory,size FROM files "
            "WHERE path >= ? AND path < ? ORDER BY path",
            (base + "/", base + "0"))
        count = _write_folder_sizes(con, rows, base)
        con.execute(
            "INSERT INTO meta(key,value) VALUES ('folder_sizes',?)",
            (str(FOLDER_SIZE_VERSION),))
        con.execute(
            "INSERT INTO meta(key,value) VALUES ('signature',?)",
            (signature,))
        con.commit()
        _log(f"  {count:,} local folder sizes ready in {time.time() - t0:.1f}s")
    finally:
        source.close()
        con.close()
    os.replace(tmp, db_path)
    return db_path


def _create_schema(con: sqlite3.Connection) -> None:
    con.executescript("""
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
    """)


def _create_indexes(con: sqlite3.Connection) -> None:
    _log("  creating indexes …")
    con.executescript("""
        CREATE INDEX idx_archive_parent ON archive(parent);
        CREATE INDEX idx_archive_name ON archive(name COLLATE NOCASE);
        CREATE INDEX idx_archive_is_dir ON archive(is_dir);
    """)


def build_cache(provider: Provider | None = None, force: bool = False) -> Path:
    if provider is None:
        provider = get_provider("jottacloud")
    if provider is None:
        raise ValueError("unknown provider")
    db_path = cache_path(provider)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not force and db_path.exists():
        try:
            con = sqlite3.connect(str(db_path))
            meta = dict(con.execute("SELECT key,value FROM meta").fetchall())
            con.close()
            if (meta.get("schema_version") == str(SCHEMA_VERSION)
                    and meta.get("signature") == _signature(provider)):
                ensure_provider_folder_sizes(db_path)
                return db_path
        except Exception:
            pass

    tmp = db_path.with_suffix(".db.tmp")
    for suffix in ("", "-wal", "-shm", "-journal"):
        try:
            Path(str(tmp) + suffix).unlink()
        except FileNotFoundError:
            pass

    _log(f"Building {provider.label} explorer cache (one-time, ~30s) …")
    t0 = time.time()
    con = sqlite3.connect(str(tmp))
    try:
        _create_schema(con)
        _build_archive(con, provider)
        _build_status(con, provider)
        _create_indexes(con)
        _log("  indexing recursive folder sizes …")
        t0_sizes = time.time()
        count = _write_folder_sizes(
            con, con.execute("SELECT path,is_dir,size FROM archive ORDER BY path"))
        _log(f"  {count:,} folder sizes ready in {time.time() - t0_sizes:.1f}s")
        con.execute("INSERT INTO meta(key,value) VALUES ('schema_version',?)",
                    (str(SCHEMA_VERSION),))
        con.execute("INSERT INTO meta(key,value) VALUES ('signature',?)",
                    (_signature(provider),))
        con.execute("INSERT INTO meta(key,value) VALUES ('folder_sizes',?)",
                    (str(FOLDER_SIZE_VERSION),))
        con.commit()
    finally:
        con.close()
    os.replace(tmp, db_path)
    _log(f"{provider.label} cache ready in {time.time() - t0:.1f}s: {db_path}")
    return db_path


def load_summary(provider: Provider | None = None) -> dict:
    if provider is None:
        provider = get_provider("jottacloud")
    if provider is None:
        return {}
    try:
        with open(provider.summary_json, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


if __name__ == "__main__":
    provider_arg = sys.argv[1] if len(sys.argv) > 1 else "jottacloud"
    build_cache(get_provider(provider_arg), force="--force" in sys.argv)
