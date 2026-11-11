#!/usr/bin/env python3
"""Listings and search for the remote (Jottacloud / Google Drive) side."""

from __future__ import annotations

from pathlib import Path

try:
    from . import runtime
    from .cache import cache_path, norm_path
    from .model import (build_stats, chunks, connect_ro, entry_type,
                        folder_agg, make_crumbs, placeholders, sort_entries)
except ImportError:
    import runtime  # type: ignore[no-redef]
    from cache import cache_path, norm_path
    from model import (build_stats, chunks, connect_ro, entry_type,
                       folder_agg, make_crumbs, placeholders, sort_entries)


def remote_entry(row) -> dict:
    is_dir = bool(row["is_dir"])
    fstatus = row["fstatus"]
    status = fstatus if (is_dir and fstatus) else (row["status"] or "exact")
    agg = None
    if is_dir and row["ftotal"] is not None:
        agg = folder_agg(row["ftotal"], row["fexact"], row["fmoved"],
                         row["fpossible"], row["fmissing"], 0,
                         row["ffound"] or "")
    return {
        "name": row["name"],
        "path": row["path"],
        "parent": row["path"].rpartition("/")[0] if "/" in row["path"] else "",
        "is_dir": is_dir,
        "type": entry_type(row["name"], is_dir),
        "size": None if is_dir else int(row["size"] or 0),
        "modified": None,
        "status": status,
        "found_at": row["found_at"] or (agg["found_at"] if agg else ""),
        "note": row["note"] or "",
        "child_count": None,
        "folder_size": None,
        "agg": agg,
    }


def apply_folder_sizes(entries: list, db_path: Path) -> None:
    """Fill ``folder_size`` (recursive bytes) for folder entries."""
    dirs = {norm_path(e["path"]): e for e in entries if e["is_dir"]}
    if not dirs:
        return
    con = connect_ro(db_path)
    try:
        for chunk in chunks(list(dirs), 400):
            ph = placeholders(len(chunk))
            for r in con.execute(
                    f"SELECT path, bytes FROM folder_size WHERE path IN ({ph})",
                    chunk):
                entry = dirs.get(r["path"])
                if entry is not None:
                    entry["folder_size"] = int(r["bytes"] or 0)
    finally:
        con.close()


def apply_local_folder_sizes(entries: list) -> None:
    if runtime.LOCAL_SIZE_DB is None:
        return
    apply_folder_sizes(entries, runtime.LOCAL_SIZE_DB)


def apply_folder_rollups(provider, entries: list, con=None) -> None:
    """Summarise *all* direct children (files + folders) for each folder row.

    The report's folder counts only roll up subfolders; this query includes
    files too, so badges and counts match what the pane actually contains.
    """
    dirs = list(dict.fromkeys(
        norm_path(e["path"]) for e in entries if e["is_dir"]))
    if not dirs:
        return
    own_con = con is None
    if own_con:
        con = connect_ro(cache_path(provider))
    stats = {}
    try:
        for chunk in chunks(dirs, 400):
            ph = placeholders(len(chunk))
            for r in con.execute(
                    f"""
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
                    WHERE a.parent IN ({ph})
                    GROUP BY a.parent
                    """, chunk):
                stats[r["p"]] = r
    finally:
        if own_con:
            con.close()

    for e in entries:
        r = stats.get(norm_path(e["path"]))
        if r is None or not r["total"]:
            continue
        total = int(r["total"])
        exact = int(r["exact"] or 0)
        moved = int(r["moved"] or 0)
        possible = int(r["possible"] or 0)
        missing = int(r["missing"] or 0)
        partial = int(r["partial"] or 0)
        e["child_count"] = total if e.get("child_count") is None else e["child_count"]
        e["agg"] = folder_agg(total, exact, moved, possible, missing, partial,
                              (e.get("agg") or {}).get("found_at", ""))
        if missing == total:
            e["status"] = "missing"
        elif missing or partial:
            e["status"] = "partial"
        elif possible:
            e["status"] = "possible"
        elif moved:
            e["status"] = "moved"
        else:
            e["status"] = "exact"


def list_remote(provider, rel: str, sort: str, direction: str,
                hidden: bool, size_mode: str = "bytes") -> dict:
    con = connect_ro(cache_path(provider))
    try:
        rows = con.execute(
            """
            SELECT a.path, a.name, a.is_dir, a.size,
                   s.status AS status, s.found_at AS found_at, s.note AS note,
                   f.status AS fstatus, f.total AS ftotal, f.exact AS fexact,
                   f.moved AS fmoved, f.possible AS fpossible,
                   f.missing AS fmissing, f.found_at AS ffound
            FROM archive a
            LEFT JOIN status s ON s.path = a.path
            LEFT JOIN folder f ON f.path = a.path
            WHERE a.parent = ?
            """, (rel,)).fetchall()
        exists = rel == "" or bool(con.execute(
            "SELECT 1 FROM archive WHERE path = ? AND is_dir = 1",
            (rel,)).fetchone())
    finally:
        con.close()

    entries = []
    for row in rows:
        if not hidden and row["name"].startswith("."):
            continue
        entries.append(remote_entry(row))
    apply_folder_rollups(provider, entries)
    apply_folder_sizes(entries, cache_path(provider))
    sort_entries(entries, sort, direction, size_mode)
    return {
        "side": "remote",
        "provider": provider.key,
        "path": rel,
        "exists": exists,
        "crumbs": make_crumbs(rel, provider.root_label),
        "entries": entries,
        "stats": build_stats(entries),
    }


REMOTE_COLS = """
    a.path, a.name, a.is_dir, a.size,
    s.status AS status, s.found_at AS found_at, s.note AS note,
    f.status AS fstatus, f.total AS ftotal, f.exact AS fexact,
    f.moved AS fmoved, f.possible AS fpossible,
    f.missing AS fmissing, f.found_at AS ffound
"""


def _remote_rows_by_rowids(provider, ids):
    con = connect_ro(cache_path(provider))
    rows = []
    try:
        for chunk in chunks(ids, 400):
            ph = placeholders(len(chunk))
            rows.extend(con.execute(
                f"""
                SELECT {REMOTE_COLS}
                FROM archive a
                LEFT JOIN status s ON s.path = a.path
                LEFT JOIN folder f ON f.path = a.path
                WHERE a.rowid IN ({ph})
                """, chunk).fetchall())
    finally:
        con.close()
    return rows


def search_remote(provider, q: str, scope: str, rel: str,
                  hidden: bool) -> dict:
    scope_path = rel if (scope == "folder" and rel) else None
    ids, truncated = runtime.SEARCH[provider.key].archive.search(
        q, runtime.SEARCH_LIMIT * 3, scope=scope_path)
    rows = _remote_rows_by_rowids(provider, ids)

    entries = []
    for r in rows:
        if not hidden and r["name"].startswith("."):
            continue
        entries.append(remote_entry(r))
        if len(entries) >= runtime.SEARCH_LIMIT:
            truncated = True
            break
    apply_folder_rollups(provider, entries)
    apply_folder_sizes(entries, cache_path(provider))
    sort_entries(entries, "name", "asc")
    return {
        "side": "remote",
        "provider": provider.key,
        "query": q,
        "scope": scope,
        "entries": entries,
        "truncated": truncated,
    }
