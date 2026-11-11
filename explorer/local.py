#!/usr/bin/env python3
"""Listings and search for the local (/mnt/tank index) side."""

from __future__ import annotations

try:
    from . import runtime
    from .cache import cache_path, norm_path
    from .model import (BASE, build_stats, chunks, connect_ro, entry_type,
                        folder_agg, local_abs, make_crumbs, placeholders,
                        sort_entries)
    from .remote import apply_folder_rollups, apply_local_folder_sizes
except ImportError:
    import runtime  # type: ignore[no-redef]
    from cache import cache_path, norm_path
    from model import (BASE, build_stats, chunks, connect_ro, entry_type,
                       folder_agg, local_abs, make_crumbs, placeholders,
                       sort_entries)
    from remote import apply_folder_rollups, apply_local_folder_sizes


def local_status_map(cache_con, rel_paths: list) -> dict:
    """Return norm path -> status info for a batch of local entries."""
    norms = list(dict.fromkeys(norm_path(e["path"]) for e in rel_paths if e.get("path")))
    archive = {}
    folders = {}
    moved = {}
    local_only = {}
    if not norms:
        return {}
    for chunk in chunks(norms):
        ph = placeholders(len(chunk))
        for r in cache_con.execute(
                f"SELECT path, is_dir FROM archive WHERE path IN ({ph})", chunk):
            archive[r["path"]] = bool(r["is_dir"])
        for r in cache_con.execute(
                f"SELECT path, status, total, exact, moved, possible, missing, "
                f"found_at FROM folder WHERE path IN ({ph})", chunk):
            folders[r["path"]] = r
        for r in cache_con.execute(
                f"SELECT path, archive_path FROM moved_db WHERE path IN ({ph})",
                chunk):
            moved[r["path"]] = r["archive_path"]
        for r in cache_con.execute(
                f"SELECT path, is_dir, size FROM local_only WHERE path IN ({ph})",
                chunk):
            local_only[r["path"]] = r

    source = {}
    for e in rel_paths:
        norm = norm_path(e["path"])
        if norm not in source:
            source[norm] = e
    result = {}
    for norm, e in source.items():
        is_dir = bool(e["is_dir"])
        in_archive = norm in archive
        fol = folders.get(norm)
        mv = moved.get(norm)
        agg = None
        found_at = ""
        if fol:
            agg = folder_agg(fol["total"], fol["exact"], fol["moved"],
                             fol["possible"], fol["missing"], 0,
                             fol["found_at"])
        if in_archive:
            if is_dir and fol:
                status = fol["status"]
            elif is_dir:
                status = "exact"
            elif archive[norm]:
                status = "type_mismatch"
            else:
                status = "exact"
        elif is_dir and fol:
            status = fol["status"]
        elif mv:
            status = "moved_match"
            found_at = mv
        elif norm in local_only:
            status = "local_only"
        else:
            status = "unmatched"
        result[norm] = {
            "status": status,
            "found_at": found_at,
            "agg": agg,
            "child_count": agg["total"] if agg else None,
        }
    return result


def local_child_counts(con, entries: list) -> dict:
    dirs = [local_abs(e["path"]) for e in entries if e["is_dir"]]
    counts = {}
    for chunk in chunks(dirs, 400):
        ph = placeholders(len(chunk))
        for r in con.execute(
                f"SELECT parent_path, COUNT(*) AS n FROM files "
                f"WHERE parent_path IN ({ph}) GROUP BY parent_path", chunk):
            counts[r["parent_path"]] = r["n"]
    return counts


def local_entries_from_rows(rows, cache_con, con, need_counts=True) -> list:
    entries = []
    for r in rows:
        path = r["path"]
        if path == BASE or not path.startswith(BASE + "/"):
            continue
        rel = path[len(BASE) + 1:]
        is_dir = bool(r["is_directory"])
        name = rel.rpartition("/")[2]
        entries.append({
            "name": name,
            "path": rel,
            "parent": rel.rpartition("/")[0] if "/" in rel else "",
            "is_dir": is_dir,
            "type": entry_type(name, is_dir),
            "size": None if is_dir else int(r["size"] or 0),
            "modified": r["modified"],
            "status": "unmatched",
            "found_at": "",
            "note": "",
            "child_count": None,
            "folder_size": None,
            "agg": None,
        })
    statuses = local_status_map(cache_con, entries)
    counts = local_child_counts(con, entries) if need_counts else {}
    for e in entries:
        info = statuses.get(norm_path(e["path"]), {})
        e.update(info)
        if e["is_dir"] and local_abs(e["path"]) in counts:
            e["child_count"] = counts[local_abs(e["path"])]
    return entries


def list_local(provider, rel: str, sort: str, direction: str,
               hidden: bool, size_mode: str = "bytes") -> dict:
    con = connect_ro(runtime.LOCAL_DB)
    cache_con = connect_ro(cache_path(provider))
    try:
        rows = con.execute(
            """
            SELECT path, size, modified, is_directory, is_file, is_symlink
            FROM files WHERE parent_path = ?
            """, (local_abs(rel),)).fetchall()
        exists = rel == "" or bool(con.execute(
            "SELECT 1 FROM files WHERE path = ? AND is_directory = 1",
            (local_abs(rel),)).fetchone())
        entries = local_entries_from_rows(rows, cache_con, con)
        apply_folder_rollups(provider, entries, cache_con)
        apply_local_folder_sizes(entries)
    finally:
        con.close()
        cache_con.close()

    if not hidden:
        entries = [e for e in entries if not e["name"].startswith(".")]
    sort_entries(entries, sort, direction, size_mode)
    return {
        "side": "local",
        "provider": provider.key,
        "path": rel,
        "exists": exists,
        "crumbs": make_crumbs(rel, BASE),
        "entries": entries,
        "stats": build_stats(entries),
    }


def _local_rows_by_ids(ids):
    con = connect_ro(runtime.LOCAL_DB)
    rows = []
    try:
        for chunk in chunks(ids, 400):
            ph = placeholders(len(chunk))
            rows.extend(con.execute(
                f"""
                SELECT path, size, modified, is_directory, is_file, is_symlink
                FROM files WHERE id IN ({ph})
                """, chunk).fetchall())
    finally:
        con.close()
    return rows


def search_local(provider, q: str, scope: str, rel: str,
                 hidden: bool) -> dict:
    scope_path = local_abs(rel) if (scope == "folder" and rel) else None
    ids, truncated = runtime.SEARCH[provider.key].local.search(
        q, runtime.SEARCH_LIMIT * 3, scope=scope_path)
    rows = _local_rows_by_ids(ids)

    con = connect_ro(runtime.LOCAL_DB)
    cache_con = connect_ro(cache_path(provider))
    try:
        entries = local_entries_from_rows(rows, cache_con, con,
                                          need_counts=True)
        apply_folder_rollups(provider, entries, cache_con)
        apply_local_folder_sizes(entries)
    finally:
        con.close()
        cache_con.close()

    if not hidden:
        entries = [e for e in entries if not e["name"].startswith(".")]
    if len(entries) > runtime.SEARCH_LIMIT:
        truncated = True
        entries = entries[:runtime.SEARCH_LIMIT]
    sort_entries(entries, "name", "asc")
    return {
        "side": "local",
        "provider": provider.key,
        "query": q,
        "scope": scope,
        "entries": entries,
        "truncated": truncated,
    }
