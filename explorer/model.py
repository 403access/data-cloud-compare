#!/usr/bin/env python3
"""Small, side-effect-free helpers shared by the local and remote listings."""

from __future__ import annotations

import sqlite3
from pathlib import Path

try:
    from . import runtime
    from .cache import norm_path
except ImportError:
    import runtime  # type: ignore[no-redef]
    from cache import norm_path

BASE = runtime.BASE


def connect_ro(path: Path) -> sqlite3.Connection:
    uri = path.resolve().as_uri() + "?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=20)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA query_only = ON")
    return con


def clean_rel(value: str) -> str:
    rel = norm_path(value or "")
    if "\x00" in rel:
        raise ValueError("invalid path")
    parts = [p for p in rel.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise ValueError("path traversal is not allowed")
    return "/".join(parts)


def local_abs(rel: str) -> str:
    return BASE if not rel else BASE + "/" + rel


def chunks(values, size=400):
    for i in range(0, len(values), size):
        yield values[i:i + size]


def placeholders(n: int) -> str:
    return ",".join("?" * n)


def entry_type(name: str, is_dir: bool) -> str:
    """Human-readable type: Folder, File, or the uppercase file extension."""
    if is_dir:
        return "Folder"
    name = name or ""
    dot = name.rfind(".")
    if 0 < dot < len(name) - 1:
        return name[dot + 1:].upper()
    return "File"


def sort_entries(entries: list, sort: str, direction: str,
                 size_mode: str = "bytes") -> list:
    desc = direction == "desc"
    if sort == "size":
        if size_mode == "files":
            key = lambda e: (e.get("size") if not e.get("is_dir")
                             else e.get("child_count")) or 0  # noqa: E731
        else:
            key = lambda e: (e.get("size") if not e.get("is_dir")
                             else e.get("folder_size")) or 0  # noqa: E731
    elif sort == "modified":
        key = lambda e: e.get("modified") or 0  # noqa: E731
    elif sort == "status":
        key = lambda e: runtime.STATUS_ORDER.get(e.get("status"), 99)  # noqa: E731
    elif sort == "type":
        key = lambda e: (e.get("type") or "").casefold()  # noqa: E731
    else:
        key = lambda e: e.get("name", "").casefold()  # noqa: E731
    entries.sort(key=key, reverse=desc)
    entries.sort(key=lambda e: 0 if e.get("is_dir") else 1)
    return entries


def folder_agg(total, exact, moved, possible, missing, partial=0,
               found_at=""):
    return {
        "total": int(total or 0),
        "exact": int(exact or 0),
        "moved": int(moved or 0),
        "possible": int(possible or 0),
        "missing": int(missing or 0),
        "partial": int(partial or 0),
        "found_at": found_at or "",
    }


def build_stats(entries: list) -> dict:
    files = sum(1 for e in entries if not e["is_dir"])
    dirs = len(entries) - files
    size = sum((e.get("size") or 0) for e in entries if not e["is_dir"])
    size += sum((e.get("folder_size") or 0) for e in entries if e["is_dir"])
    return {"files": files, "dirs": dirs, "items": len(entries), "bytes": size}


def make_crumbs(rel: str, root_name: str) -> list:
    out = [{"name": root_name, "path": ""}]
    if rel:
        acc = []
        for part in rel.split("/"):
            acc.append(part)
            out.append({"name": part, "path": "/".join(acc)})
    return out
