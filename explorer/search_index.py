#!/usr/bin/env python3
"""Compact, memory-resident substring index for file names.

Both snapshots have >1.3M entries, and SQLite cannot accelerate a substring
LIKE '%needle%'.  This module packs all basenames (lower-cased) into one byte
buffer plus offset/id arrays, and stores an interned parent id per entry so
"search this folder" can be filtered without touching SQLite.

Searching is then a C-speed bytes.find scan, typically tens of milliseconds,
and only the matching rows are fetched from SQLite.

The index is cached next to the explorer cache and rebuilt when either source
changes.
"""

from __future__ import annotations

import json
import sqlite3
import struct
import sys
import time
from array import array
from bisect import bisect_right
from pathlib import Path

try:
    from .providers import Provider, get_provider
except ImportError:
    from providers import Provider, get_provider

MAGIC = b"TJSI2\0\0\0"
HEADER = struct.Struct("<IIIIIIII")
VERSION = 2
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

BASE = "/mnt/tank"


def index_path(provider: Provider) -> Path:
    name = ("search.index" if provider.key == "jottacloud"
            else f"search-{provider.key}.index")
    return CACHE_DIR / name


def meta_path(provider: Provider) -> Path:
    return index_path(provider).with_suffix(".index.json")


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def signature(cache_db: Path, local_db: Path) -> str:
    con = sqlite3.connect(str(cache_db))
    try:
        rows = dict(con.execute("SELECT key,value FROM meta").fetchall())
    finally:
        con.close()
    st = local_db.stat()
    return f"{rows.get('signature', '')}|local:{st.st_size}:{st.st_mtime_ns}"


def _pack_names(rows, basename: bool = False):
    names = bytearray()
    offsets = array("I")
    ids = array("Q")
    parent_ids = array("I")
    parents = []
    parent_map = {}
    for row_id, raw_path, raw_parent in rows:
        if basename:
            name = str(raw_path).rsplit("/", 1)[-1]
            parent = str(raw_path).rpartition("/")[0]
        else:
            name = str(raw_path)
            parent = str(raw_parent or "")
        name = name.replace("\n", " ").lower()
        if not name:
            continue
        pid = parent_map.get(parent)
        if pid is None:
            pid = len(parents)
            parent_map[parent] = pid
            parents.append(parent)
        offsets.append(len(names))
        parent_ids.append(pid)
        ids.append(int(row_id))
        names += name.encode("utf-8")
        names.append(10)  # '\n' separator; queries never include a newline
    parents_blob = json.dumps(parents, ensure_ascii=False).encode("utf-8")
    return bytes(names), offsets, parent_ids, parents_blob, ids


def _write_index(path: Path, archive_rows, local_rows) -> None:
    a = _pack_names(archive_rows)
    l = _pack_names(local_rows, basename=True)
    a_names, a_offsets, a_pids, a_parents, a_ids = a
    l_names, l_offsets, l_pids, l_parents, l_ids = l

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "wb") as f:
        f.write(MAGIC)
        f.write(HEADER.pack(len(a_ids), len(a_names),
                            len(l_ids), len(l_names),
                            len(a_parents), len(a_offsets),
                            len(l_parents), len(l_offsets)))
        f.write(a_names)
        f.write(l_names)
        f.write(a_parents)
        f.write(l_parents)
        f.write(a_offsets.tobytes())
        f.write(l_offsets.tobytes())
        f.write(a_pids.tobytes())
        f.write(l_pids.tobytes())
        f.write(a_ids.tobytes())
        f.write(l_ids.tobytes())
    tmp.replace(path)


def build_index(cache_db: Path, local_db: Path, provider: Provider,
                force: bool = False) -> None:
    path = index_path(provider)
    meta_path_ = meta_path(provider)
    sig = signature(cache_db, local_db)
    if not force and path.exists():
        try:
            meta = json.loads(meta_path_.read_text())
            if meta.get("signature") == sig and meta.get("version") == VERSION:
                return
        except (OSError, ValueError):
            pass

    _log(f"Building {provider.label} search index (one-time) …")
    t0 = time.time()
    con = sqlite3.connect(str(cache_db))
    try:
        archive_rows = con.execute(
            "SELECT rowid,name,parent FROM archive").fetchall()
    finally:
        con.close()
    con = sqlite3.connect(f"{local_db.resolve().as_uri()}?mode=ro", uri=True)
    try:
        local_rows = con.execute(
            "SELECT id,path,'' FROM files WHERE path LIKE ?",
            (BASE + "/%",)).fetchall()
    finally:
        con.close()

    _write_index(path, archive_rows, local_rows)
    meta_path_.write_text(json.dumps({"signature": sig, "version": VERSION}))
    _log(f"{provider.label} search index ready in {time.time() - t0:.1f}s")


class NameIndex:
    __slots__ = ("raw", "start", "length", "offsets", "ids", "parent_ids",
                 "parents")

    def __init__(self, raw: bytes, start: int, length: int,
                 offsets: array, ids: array, parent_ids: array, parents: list):
        self.raw = raw
        self.start = start
        self.length = length
        self.offsets = offsets
        self.ids = ids
        self.parent_ids = parent_ids
        self.parents = parents

    def __len__(self):
        return len(self.ids)

    def search(self, query: str, wanted: int, scope: str | None = None,
               scan_cap: int = 250000):
        """Return (ids, truncated).  Matches are unique and in index order.

        scope limits results to that folder and its descendants.
        """
        needle = query.replace("\n", " ").lower().encode("utf-8")
        if not needle:
            return [], False
        end = self.start + self.length
        pos = self.start
        found = []
        seen = set()
        scanned = 0
        scoped = bool(scope)
        prefix = (scope + "/") if scoped else ""
        truncated = False
        while len(found) < wanted:
            hit = self.raw.find(needle, pos, end)
            if hit < 0:
                break
            scanned += 1
            if scanned >= scan_cap:
                truncated = True
                break
            rel = hit - self.start
            index = bisect_right(self.offsets, rel) - 1
            if index >= 0:
                if scoped:
                    parent = self.parents[self.parent_ids[index]]
                    if parent != scope and not parent.startswith(prefix):
                        pos = hit + 1
                        continue
                row_id = self.ids[index]
                if row_id not in seen:
                    seen.add(row_id)
                    found.append(row_id)
            pos = hit + 1
        if len(found) >= wanted:
            truncated = True
        return found, truncated


class SearchIndexes:
    def __init__(self, archive: NameIndex, local: NameIndex):
        self.archive = archive
        self.local = local


def load_indexes(cache_db: Path, local_db: Path, provider: Provider):
    build_index(cache_db, local_db, provider)
    path = index_path(provider)
    raw = path.read_bytes()
    if raw[:8] != MAGIC:
        raise RuntimeError("search index has an unknown format")
    (n_a, len_a, n_l, len_l, len_pa, n_pid_a,
     len_pl, n_pid_l) = HEADER.unpack_from(raw, 8)
    pos = 8 + HEADER.size
    a_start = pos
    pos += len_a
    l_start = pos
    pos += len_l
    a_parents_start = pos
    pos += len_pa
    l_parents_start = pos
    pos += len_pl
    a_off_start = pos
    pos += n_a * 4
    l_off_start = pos
    pos += n_l * 4
    a_pid_start = pos
    pos += n_pid_a * 4
    l_pid_start = pos
    pos += n_pid_l * 4
    a_id_start = pos
    pos += n_a * 8
    l_id_start = pos

    def arr(kind, offset, count):
        a = array(kind)
        a.frombytes(raw[offset:offset + count * a.itemsize])
        return a

    def parents(offset, length):
        if not length:
            return []
        return json.loads(raw[offset:offset + length].decode("utf-8"))

    return SearchIndexes(
        NameIndex(raw, a_start, len_a, arr("I", a_off_start, n_a),
                  arr("Q", a_id_start, n_a), arr("I", a_pid_start, n_pid_a),
                  parents(a_parents_start, len_pa)),
        NameIndex(raw, l_start, len_l, arr("I", l_off_start, n_l),
                  arr("Q", l_id_start, n_l), arr("I", l_pid_start, n_pid_l),
                  parents(l_parents_start, len_pl)),
    )
