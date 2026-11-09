#!/usr/bin/env python3
"""Two-pane explorer: /mnt/tank index vs Jottacloud / Google Drive snapshots.

Run:
    python3 explorer/server.py          # http://127.0.0.1:8787
    python3 explorer/server.py --open   # also open the browser
"""

from __future__ import annotations

import argparse
import gzip
import json
import mimetypes
import os
import sqlite3
import sys
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

try:
    from .cache import build_cache, cache_path, load_summary, norm_path
    from .providers import DEFAULT_PROVIDER, ROOT, get_providers
    from .search_index import load_indexes
except ImportError:
    from cache import build_cache, cache_path, load_summary, norm_path
    from providers import DEFAULT_PROVIDER, ROOT, get_providers
    from search_index import load_indexes

BASE = "/mnt/tank"
LOCAL_DB = ROOT / "file_indexer.db"
WEB_DIR = Path(__file__).resolve().parent / "web"
SEARCH_LIMIT = 400

PROVIDERS = {p.key: p for p in get_providers()}
PROVIDER_STATE: dict[str, dict] = {}
SEARCH: dict[str, object] = {}  # provider key -> SearchIndexes, set in main()

STATUS_ORDER = {
    "missing": 0,
    "partial": 1,
    "possible": 2,
    "moved": 3,
    "moved_match": 3,
    "type_mismatch": 4,
    "exact": 5,
    "local_only": 6,
    "unmatched": 7,
}


# --------------------------------------------------------------------------
# helpers

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


def sort_entries(entries: list, sort: str, direction: str) -> list:
    desc = direction == "desc"
    if sort == "size":
        key = lambda e: e.get("size") or 0  # noqa: E731
    elif sort == "modified":
        key = lambda e: e.get("modified") or 0  # noqa: E731
    elif sort == "status":
        key = lambda e: STATUS_ORDER.get(e.get("status"), 99)  # noqa: E731
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
    return {"files": files, "dirs": dirs, "items": len(entries), "bytes": size}


def make_crumbs(rel: str, root_name: str) -> list:
    out = [{"name": root_name, "path": ""}]
    if rel:
        acc = []
        for part in rel.split("/"):
            acc.append(part)
            out.append({"name": part, "path": "/".join(acc)})
    return out


# --------------------------------------------------------------------------
# remote (Jottacloud archive) side

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
        "size": None if is_dir else int(row["size"] or 0),
        "modified": None,
        "status": status,
        "found_at": row["found_at"] or (agg["found_at"] if agg else ""),
        "note": row["note"] or "",
        "child_count": None,
        "agg": agg,
    }


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
                hidden: bool) -> dict:
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
    sort_entries(entries, sort, direction)
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
    ids, truncated = SEARCH[provider.key].archive.search(
        q, SEARCH_LIMIT * 3, scope=scope_path)
    rows = _remote_rows_by_rowids(provider, ids)

    entries = []
    for r in rows:
        if not hidden and r["name"].startswith("."):
            continue
        entries.append(remote_entry(r))
        if len(entries) >= SEARCH_LIMIT:
            truncated = True
            break
    apply_folder_rollups(provider, entries)
    sort_entries(entries, "name", "asc")
    return {
        "side": "remote",
        "provider": provider.key,
        "query": q,
        "scope": scope,
        "entries": entries,
        "truncated": truncated,
    }


# --------------------------------------------------------------------------
# local (/mnt/tank index) side

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
        entries.append({
            "name": rel.rpartition("/")[2],
            "path": rel,
            "parent": rel.rpartition("/")[0] if "/" in rel else "",
            "is_dir": is_dir,
            "size": None if is_dir else int(r["size"] or 0),
            "modified": r["modified"],
            "status": "unmatched",
            "found_at": "",
            "note": "",
            "child_count": None,
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
               hidden: bool) -> dict:
    con = connect_ro(LOCAL_DB)
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
    finally:
        con.close()
        cache_con.close()

    if not hidden:
        entries = [e for e in entries if not e["name"].startswith(".")]
    sort_entries(entries, sort, direction)
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
    con = connect_ro(LOCAL_DB)
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
    ids, truncated = SEARCH[provider.key].local.search(
        q, SEARCH_LIMIT * 3, scope=scope_path)
    rows = _local_rows_by_ids(ids)

    con = connect_ro(LOCAL_DB)
    cache_con = connect_ro(cache_path(provider))
    try:
        entries = local_entries_from_rows(rows, cache_con, con,
                                          need_counts=True)
        apply_folder_rollups(provider, entries, cache_con)
    finally:
        con.close()
        cache_con.close()

    if not hidden:
        entries = [e for e in entries if not e["name"].startswith(".")]
    if len(entries) > SEARCH_LIMIT:
        truncated = True
        entries = entries[:SEARCH_LIMIT]
    sort_entries(entries, "name", "asc")
    return {
        "side": "local",
        "provider": provider.key,
        "query": q,
        "scope": scope,
        "entries": entries,
        "truncated": truncated,
    }


# --------------------------------------------------------------------------
# HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "TankCloudExplorer/1.1"

    def log_message(self, fmt, *args):
        # Keep the console quiet; only errors are interesting.
        if args and str(args[0]).startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def send_bytes(self, body: bytes, content_type: str, status: int = 200,
                   cache: bool = False) -> None:
        headers = [("Content-Type", content_type)]
        if "gzip" in self.headers.get("Accept-Encoding", "") and len(body) > 2048:
            body = gzip.compress(body, compresslevel=5)
            headers.append(("Content-Encoding", "gzip"))
            headers.append(("Vary", "Accept-Encoding"))
        self.send_response(status)
        for k, v in headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        if cache:
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def send_json(self, obj, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False,
                          separators=(",", ":")).encode("utf-8")
        self.send_bytes(body, "application/json; charset=utf-8", status)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json({"error": message}, status)

    def do_GET(self):
        try:
            self.handle_get()
        except ValueError as exc:
            self.send_error_json(400, str(exc))
        except BrokenPipeError:
            pass
        except Exception:
            traceback.print_exc()
            try:
                self.send_error_json(500, "internal server error")
            except Exception:
                pass

    def handle_get(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        params = {k: v[-1] for k, v in parse_qs(parsed.query).items()}

        if path.startswith("/api/"):
            self.handle_api(path, params)
            return
        self.serve_static(path)

    def require_provider(self, params: dict):
        key = params.get("provider") or DEFAULT_PROVIDER
        provider = PROVIDERS.get(key)
        if provider is None:
            self.send_error_json(400, "unknown provider")
            return None
        state = PROVIDER_STATE.get(key) or {}
        if not state.get("ready"):
            self.send_error_json(
                503, state.get("reason") or f"{provider.label} is not ready")
            return None
        return provider

    def handle_api(self, path: str, params: dict):
        if path == "/api/providers":
            self.send_json(api_providers())
            return
        if path == "/api/meta":
            provider = self.require_provider(params)
            if provider is not None:
                self.send_json(api_meta(provider))
            return
        if path == "/api/list":
            provider = self.require_provider(params)
            if provider is None:
                return
            side = params.get("side", "local")
            rel = clean_rel(params.get("path", ""))
            sort = params.get("sort", "name")
            direction = params.get("dir", "asc")
            hidden = params.get("hidden", "0") in ("1", "true", "yes")
            if sort not in ("name", "size", "modified", "status"):
                sort = "name"
            if direction not in ("asc", "desc"):
                direction = "asc"
            if side == "remote":
                self.send_json(
                    list_remote(provider, rel, sort, direction, hidden))
            elif side == "local":
                self.send_json(
                    list_local(provider, rel, sort, direction, hidden))
            else:
                self.send_error_json(400, "unknown side")
            return
        if path == "/api/search":
            provider = self.require_provider(params)
            if provider is None:
                return
            side = params.get("side", "local")
            q = (params.get("q") or "").strip()
            scope = params.get("scope", "all")
            rel = clean_rel(params.get("path", ""))
            hidden = params.get("hidden", "0") in ("1", "true", "yes")
            if len(q) < 2:
                self.send_json({"side": side, "provider": provider.key,
                                "query": q, "scope": scope,
                                "entries": [], "truncated": False})
                return
            if side == "remote":
                self.send_json(
                    search_remote(provider, q, scope, rel, hidden))
            elif side == "local":
                self.send_json(
                    search_local(provider, q, scope, rel, hidden))
            else:
                self.send_error_json(400, "unknown side")
            return
        self.send_error_json(404, "unknown endpoint")

    def serve_static(self, path: str):
        if path in ("", "/"):
            path = "/index.html"
        # Prevent path traversal outside web/.
        rel = path.lstrip("/")
        target = (WEB_DIR / rel).resolve()
        try:
            target.relative_to(WEB_DIR.resolve())
        except ValueError:
            self.send_error_json(403, "forbidden")
            return
        if not target.is_file():
            self.send_error_json(404, "not found")
            return
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in (
                "application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self.send_bytes(target.read_bytes(), ctype, cache=True)


def provider_sources(provider) -> list:
    sources = []
    for label, path in (
            ("local_db", LOCAL_DB),
            ("archive", provider.archive_json),
            ("report", provider.report_json),
            ("local_only", provider.local_only_csv)):
        try:
            st = path.stat()
            sources.append({"label": label, "path": str(path),
                            "mtime": st.st_mtime, "size": st.st_size})
        except OSError:
            sources.append({"label": label, "path": str(path), "missing": True})
    return sources


def provider_record(provider) -> dict:
    state = PROVIDER_STATE.get(provider.key) or {}
    record = provider.public()
    record.update({
        "available": bool(state.get("ready")),
        "reason": state.get("reason") or "",
        "summary": load_summary(provider),
        "sources": provider_sources(provider),
    })
    return record


def api_providers() -> dict:
    return {
        "default": DEFAULT_PROVIDER,
        "providers": [provider_record(p) for p in PROVIDERS.values()],
    }


def api_meta(provider) -> dict:
    return {"provider": provider.public(),
            "summary": load_summary(provider),
            "sources": provider_sources(provider),
            "base": BASE,
            "cache": str(cache_path(provider))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--open", action="store_true",
                        help="open the explorer in the default browser")
    parser.add_argument("--rebuild", action="store_true",
                        help="rebuild all provider caches from their snapshots")
    args = parser.parse_args()

    if not LOCAL_DB.exists():
        _ = sys.stderr.write(f"Local index not found: {LOCAL_DB}\n")
        raise SystemExit(1)

    for provider in PROVIDERS.values():
        ready, reason = provider.readiness()
        if not ready:
            PROVIDER_STATE[provider.key] = {"ready": False, "reason": reason}
            print(f"  {provider.label:12s}: unavailable — {reason}")
            continue
        try:
            db_path = build_cache(provider, force=args.rebuild)
            SEARCH[provider.key] = load_indexes(db_path, LOCAL_DB, provider)
            PROVIDER_STATE[provider.key] = {"ready": True, "reason": ""}
        except Exception as exc:  # keep the other providers usable
            traceback.print_exc()
            PROVIDER_STATE[provider.key] = {
                "ready": False,
                "reason": f"Could not load {provider.label}: {exc}",
            }

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    url = f"http://{args.host}:{args.port}/"
    print(f"Explorer running at {url}")
    print("  left  : /mnt/tank index (file_indexer.db)")
    for provider in PROVIDERS.values():
        state = PROVIDER_STATE.get(provider.key) or {}
        if state.get("ready"):
            print(f"  right : {provider.label} — {provider.archive_json.name}")
        else:
            print(f"  right : {provider.label} — unavailable")
    print("Press Ctrl+C to stop.")
    if args.open:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
