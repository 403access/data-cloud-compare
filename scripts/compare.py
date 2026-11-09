#!/usr/bin/env python3
"""
Compare a Jottacloud Archive listing against the local file_indexer.db.

The DB is treated as the source of truth. DB paths are rooted at /mnt/tank,
so that prefix is stripped before comparison. Archive paths are relative to
the Archive mountpoint (an optional leading "Archive/" is stripped).

Matching strategy per remote item:
  1. exact relative path
  2. case-insensitive relative path
  3. files: same basename + same size anywhere in the DB (=> moved)
  4. files: same basename, different size anyway (=> possible / size differs)
  5. folders: same folder name elsewhere, or all children found elsewhere

Outputs (in --out, default ./report):
  summary.json
  missing.csv
  moved.csv
  local_only.csv
  report.html   (self-contained visual diff)
"""

import argparse
import csv
import html
import json
import os
import re
import sqlite3
import sys
import unicodedata
from collections import defaultdict

BASE = "/mnt/tank"

# Jottacloud replaces these characters with fullwidth lookalikes.
FW = str.maketrans({
    "\uff02": '"', "\uff0a": "*", "\uff1a": ":", "\uff1c": "<",
    "\uff1e": ">", "\uff1f": "?", "\uff7c": "|", "\uff05": "%",
})


def norm_path(p):
    if p is None:
        return ""
    p = unicodedata.normalize("NFC", p)
    p = p.translate(FW)
    p = p.replace("\\", "/")
    p = re.sub(r"/+", "/", p)
    p = p.strip("/")
    return p


def load_archive(path, strip_archive_prefix=True):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("items", data.get("files", []))
    entries = []
    prefixes = set()
    for e in data:
        rel = norm_path(e.get("Path") or e.get("path") or e.get("Name") or "")
        if not rel:
            continue
        entries.append({
            "rel": rel,
            "isdir": bool(e.get("IsDir", e.get("is_dir", False))),
            "size": int(e.get("Size") or e.get("size") or 0),
            "md5": (e.get("Hashes") or {}).get("MD5") or e.get("md5") or "",
            "mod": e.get("ModTime") or e.get("mod") or "",
        })
        prefixes.add(rel.split("/", 1)[0])
    # If the listing is from the device root rather than the Archive mountpoint,
    # every path starts with "Archive/". Strip it.
    if strip_archive_prefix and len(prefixes) == 1 and "Archive" in prefixes:
        for e in entries:
            if e["rel"] == "Archive":
                e["rel"] = ""
            elif e["rel"].startswith("Archive/"):
                e["rel"] = e["rel"][len("Archive/"):]
        entries = [e for e in entries if e["rel"]]

    # Ensure every parent folder is present as an entry, even if the listing
    # did not include directories (or omitted empty parents).
    seen_dirs = {e["rel"] for e in entries if e["isdir"]}
    extra = []
    for e in entries:
        parts = e["rel"].split("/")
        for i in range(1, len(parts)):
            d = "/".join(parts[:i])
            if d not in seen_dirs:
                seen_dirs.add(d)
                extra.append({"rel": d, "isdir": True, "size": 0, "md5": "", "mod": ""})
    entries.extend(extra)
    return entries


def load_db(path):
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT path, size, is_directory, is_file FROM files"
    )
    exact = {}
    lower = defaultdict(list)
    name_size = defaultdict(list)   # (basename, size) -> [(rel, isdir)]
    name_any = defaultdict(list)    # basename -> [(rel, isdir, size)]
    dir_name = defaultdict(list)    # lower basename -> [(rel, size)]
    total = 0
    for r in rows:
        total += 1
        p = r["path"]
        if p == BASE:
            rel = ""
        elif p.startswith(BASE + "/"):
            rel = p[len(BASE) + 1:]
        else:
            # Not under the base; keep as-is so nothing is silently lost.
            rel = norm_path(p)
        isdir = bool(r["is_directory"])
        isfile = bool(r["is_file"])
        size = int(r["size"] or 0)
        exact[rel] = (size, isdir, isfile)
        lower[rel.lower()].append(rel)
        n = rel.rsplit("/", 1)[-1]
        name_any[n].append((rel, isdir, size))
        if isdir:
            dir_name[n.lower()].append((rel, size))
        if isfile:
            name_size[(n, size)].append(rel)
    con.close()
    return {
        "total": total,
        "exact": exact,
        "lower": lower,
        "name_size": name_size,
        "name_any": name_any,
        "dir_name": dir_name,
    }


def path_score(candidate_rel, remote_rel):
    """Higher is a better moved-to candidate."""
    cr = candidate_rel.split("/")
    rr = remote_rel.split("/")
    score = 0
    if cr and rr and cr[-2:-1] == rr[-2:-1]:
        score += 4
    if cr and rr and cr[0:1] == rr[0:1]:
        score += 2
    # Prefer similar depth and shorter paths.
    score -= abs(len(cr) - len(rr))
    score -= len(cr) * 0.01
    return score


def pick_candidate(cands, remote_rel):
    best = max(cands, key=lambda c: path_score(c, remote_rel))
    return best, len(cands) - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="file_indexer.db")
    ap.add_argument("--archive", required=True, help="rclone lsjson -R output")
    ap.add_argument("--out", default="report")
    ap.add_argument("--label", default="Jottacloud Archive",
                    help="remote service name used in the report title")
    ap.add_argument("--no-strip-archive", action="store_true",
                    help="keep a single top-level 'Archive/' prefix")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    print("Loading archive listing...", file=sys.stderr)
    remote = load_archive(args.archive,
                          strip_archive_prefix=not args.no_strip_archive)
    print(f"  {len(remote):,} archive entries", file=sys.stderr)

    print("Loading local index...", file=sys.stderr)
    db = load_db(args.db)
    print(f"  {db['total']:,} local entries", file=sys.stderr)

    files = [e for e in remote if not e["isdir"]]
    dirs = [e for e in remote if e["isdir"]]

    results = {}  # rel -> dict(status, found, note, isdir, size)
    matched_local = set()  # DB rel paths counted as present

    def exact_lookup(e, want_dir):
        rel = e["rel"]
        rec = db["exact"].get(rel)
        if rec and bool(rec[1]) == want_dir:
            return rel, True
        for cand in db["lower"].get(rel.lower(), []):
            r2 = db["exact"].get(cand)
            if r2 and bool(r2[1]) == want_dir:
                return cand, False
        return None, False

    def mark(rel, **kw):
        kw.setdefault("isdir", 0)
        kw.setdefault("size", 0)
        kw.setdefault("found", "")
        kw.setdefault("note", "")
        results[rel] = kw

    # ---- files ----
    unmatched = []
    for e in files:
        rel = e["rel"]
        size = e["size"]
        cand, case_exact = exact_lookup(e, False)
        if cand is not None:
            local_size = db["exact"][cand][0]
            same = local_size == size
            note = "" if same else f"size differs: archive {size:,} / local {local_size:,}"
            mark(rel, status="present_exact" if same else "size_mismatch",
                 isdir=0, size=size, found=cand, note=note, size_mismatch=not same)
            matched_local.add(cand)
            continue
        unmatched.append(e)

    for e in unmatched:
        rel, size = e["rel"], e["size"]
        n = rel.rsplit("/", 1)[-1]
        cands = db["name_size"].get((n, size), [])
        if cands:
            best, others = pick_candidate(cands, rel)
            mark(rel, status="present_moved", isdir=0, size=size, found=best,
                 note=(f"+{others} other location(s)" if others else ""))
            matched_local.add(best)
            continue
        anyc = db["name_any"].get(n, [])
        if anyc:
            # Same name exists but no size match: still likely the same item
            # (e.g. edited), so flag it rather than call it missing.
            file_cands = [(r, s) for (r, d, s) in anyc if not d]
            if file_cands:
                sizes = sorted({s for _, s in file_cands})
                best, others = pick_candidate([r for r, _ in file_cands], rel)
                bsize = dict(file_cands).get(best, 0)
                mark(rel, status="possible", isdir=0, size=size, found=best,
                     note=f"same name, different size (local {bsize:,})"
                          + (f"; +{others} more" if others else ""))
                matched_local.add(best)
                continue
        mark(rel, status="missing", isdir=0, size=size)

    # ---- dirs ----
    # First pass: exact / same-name
    dir_children = defaultdict(list)  # remote dir rel -> [child rel]
    for e in dirs:
        rel = e["rel"]
        parent = rel.rsplit("/", 1)[0] if "/" in rel else ""
        dir_children[parent].append(rel)
        cand, case_exact = exact_lookup(e, True)
        if cand is not None:
            mark(rel, status="present_exact", isdir=1, size=e["size"], found=cand)
            matched_local.add(cand)

    for e in dirs:
        rel = e["rel"]
        if rel in results and results[rel]["status"] == "present_exact":
            continue
        n = rel.rsplit("/", 1)[-1]
        cands = db["dir_name"].get(n.lower(), [])
        if cands:
            best, others = pick_candidate([r for r, _ in cands], rel)
            mark(rel, status="present_moved", isdir=1, size=e["size"], found=best,
                 note=(f"+{others} other folder(s)" if others else "same folder name"))
            matched_local.add(best)
        else:
            mark(rel, status="unresolved", isdir=1, size=e["size"])

    # Second pass (deepest first): folder status from children.
    depth = {e["rel"]: e["rel"].count("/") + 1 for e in dirs}
    for e in sorted(dirs, key=lambda x: -depth[x["rel"]]):
        rel = e["rel"]
        if results[rel]["status"] != "unresolved":
            continue
        kids = dir_children.get(rel, [])
        if not kids:
            results[rel]["status"] = "missing"
            continue
        counts = defaultdict(int)
        for k in kids:
            counts[results.get(k, {}).get("status", "missing")] += 1
        counts["present_exact"] += counts.get("size_mismatch", 0)
        present = counts["present_exact"] + counts["present_moved"]
        missing = counts["missing"]
        if present and not missing:
            results[rel]["status"] = "present_moved"
            results[rel]["note"] = "structure differs but all children found"
        elif present:
            results[rel]["status"] = "partial"
            results[rel]["note"] = f"{present} present / {missing} missing child item(s)"
        else:
            results[rel]["status"] = "missing"

    # ---- aggregate ----
    STATUS_LABEL = {
        "present_exact": "Present (same path)",
        "size_mismatch": "Present (size differs)",
        "present_moved": "Present (moved)",
        "possible": "Possible (name only)",
        "partial": "Partially present",
        "missing": "Missing",
        "unresolved": "Unresolved",
    }
    summary = defaultdict(lambda: {"files": 0, "dirs": 0, "bytes": 0})
    for e in remote:
        st = results[e["rel"]]["status"]
        bucket = "missing" if st in ("missing", "unresolved") else (
            "possible" if st == "possible" else (
                "moved" if st in ("present_moved", "partial") else "exact"))
        summary[bucket]["files" if not e["isdir"] else "dirs"] += 1
        if not e["isdir"]:
            summary[bucket]["bytes"] += e["size"]

    total_files = len(files)
    total_dirs = len(dirs)
    total_bytes = sum(e["size"] for e in files)
    present_files = summary["exact"]["files"] + summary["moved"]["files"] + summary["possible"]["files"]
    missing_files = summary["missing"]["files"]

    summary_out = {
        "archive": {
            "files": total_files,
            "dirs": total_dirs,
            "bytes": total_bytes,
        },
        "buckets": {k: dict(v) for k, v in summary.items()},
        "present_files": present_files,
        "missing_files": missing_files,
        "present_pct": (100.0 * present_files / total_files) if total_files else 0.0,
        "db_entries": db["total"],
    }

    # ---- top level breakdown ----
    top = defaultdict(lambda: {"files": 0, "dirs": 0, "exact": 0, "moved": 0,
                               "possible": 0, "missing": 0, "bytes": 0})
    for e in remote:
        if e["rel"] == "":
            continue
        t = e["rel"].split("/", 1)[0]
        rec = top[t]
        st = results[e["rel"]]["status"]
        key = ("missing" if st in ("missing", "unresolved") else
               "possible" if st == "possible" else
               "moved" if st in ("present_moved", "partial") else "exact")
        rec[key] += 1
        rec["files" if not e["isdir"] else "dirs"] += 1
        if not e["isdir"]:
            rec["bytes"] += e["size"]
    top_list = [{"name": k, **v} for k, v in sorted(top.items())]

    # ---- write csvs ----
    moved_rows, missing_rows = [], []
    for e in remote:
        r = results[e["rel"]]
        row = [e["rel"], "dir" if e["isdir"] else "file", r["status"],
               e["size"], r.get("found", ""), r.get("note", "")]
        if r["status"] in ("missing", "unresolved"):
            missing_rows.append(row)
        elif r["status"] in ("present_moved", "possible", "partial"):
            moved_rows.append(row)

    def write_csv(name, header, rows):
        with open(os.path.join(args.out, name), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)

    write_csv("moved.csv",
              ["archive_path", "type", "status", "size", "found_at", "note"],
              moved_rows)
    write_csv("missing.csv",
              ["archive_path", "type", "status", "size", "found_at", "note"],
              missing_rows)

    # local-only entries: DB items never matched to an archive item
    local_only = []
    for rel, (size, isdir, isfile) in db["exact"].items():
        if rel == "":
            continue
        if rel not in matched_local:
            local_only.append([rel, "dir" if isdir else "file", size])
    write_csv("local_only.csv", ["local_path", "type", "size"], local_only)

    summary_out["local_only_count"] = len(local_only)

    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary_out, f, indent=2)

    # ---- report data ----
    folders = []
    for e in dirs:
        rel = e["rel"]
        r = results[rel]
        kids = dir_children.get(rel, [])
        c = defaultdict(int)
        for k in kids:
            c[results.get(k, {}).get("status", "missing")] += 1
        c["present_exact"] += c.get("size_mismatch", 0)
        folders.append({
            "p": rel, "s": r["status"],
            "n": len(kids),
            "e": c["present_exact"],
            "m": c["present_moved"],
            "x": c["missing"],
            "f": r.get("found", ""),
        })

    # Full issue list is streamed to report_data.json so we never hold a
    # million-row Python list in memory. The HTML embeds a bounded sample;
    # the CSVs and report_data.json hold everything.
    SAMPLES = {
        "missing": 25000,
        "possible": 10000,
        "present_moved": 10000,
        "partial": 4000,
        "size_mismatch": 4000,
    }
    issue_counts = defaultdict(int)
    sample_counts = defaultdict(int)
    issues_sample = []
    data_path = os.path.join(args.out, "report_data.json")
    first = True
    with open(data_path, "w", encoding="utf-8") as f:
        f.write('{"summary":')
        json.dump(summary_out, f, ensure_ascii=False)
        f.write(',"top":')
        json.dump(top_list, f, ensure_ascii=False)
        f.write(',"folders":')
        json.dump(folders, f, ensure_ascii=False)
        f.write(',"issues":[')
        for e in remote:
            r = results[e["rel"]]
            st = r["status"]
            if st == "present_exact":
                continue
            issue_counts[st] += 1
            obj = {"p": e["rel"], "d": 1 if e["isdir"] else 0, "s": st,
                   "z": e["size"], "f": r.get("found", ""), "n": r.get("note", "")}
            if not first:
                f.write(",")
            json.dump(obj, f, ensure_ascii=False)
            first = False
            if sample_counts[st] < SAMPLES.get(st, 0):
                sample_counts[st] += 1
                issues_sample.append(obj)
        f.write('],"issue_counts":')
        json.dump(dict(issue_counts), f, ensure_ascii=False)
        f.write('}')
    n_issues = sum(issue_counts.values())

    payload = {
        "summary": summary_out,
        "top": top_list,
        "folders": folders,
        "issues": issues_sample,
        "issue_counts": dict(issue_counts),
        "status_labels": STATUS_LABEL,
        "samples": SAMPLES,
    }
    write_html(args.out, payload, n_issues, len(missing_rows), len(moved_rows),
               args.label)

    print(f"\nArchive: {total_files:,} files, {total_dirs:,} dirs, "
          f"{human(total_bytes)}", file=sys.stderr)
    for k in ("exact", "moved", "possible", "missing"):
        b = summary[k]
        print(f"  {k:9s}: {b['files']:,} files / {b['dirs']:,} dirs", file=sys.stderr)
    print(f"Local-only DB entries: {len(local_only):,}", file=sys.stderr)
    print(f"Report: {os.path.abspath(os.path.join(args.out, 'report.html'))}", file=sys.stderr)


def human(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024.0


def write_html(outdir, payload, n_issues, n_missing, n_moved,
               label="Jottacloud Archive"):
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    status_labels = json.dumps(payload["status_labels"])
    title = f"{label} vs local index"
    html_doc = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jottacloud Archive vs local index</title>
<style>
:root{
  --bg:#0f1115; --panel:#171a21; --panel2:#1e222b; --text:#e6e9ef; --muted:#9aa4b2;
  --green:#2ea043; --greenbg:#16351f; --blue:#3b82f6; --bluebg:#16233d;
  --amber:#d29922; --amberbg:#3a2d10; --red:#e5534b; --redbg:#3d1a18;
  --border:#2a2f3a;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{padding:22px 26px 6px}
h1{margin:0 0 4px;font-size:22px;font-weight:650}
.sub{color:var(--muted);font-size:13px}
.wrap{padding:16px 26px 60px;max-width:1500px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.card .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.card .v{font-size:26px;font-weight:650;margin-top:4px}
.card .d{color:var(--muted);font-size:12px;margin-top:2px}
.g .v{color:var(--green)} .b .v{color:var(--blue)} .a .v{color:var(--amber)} .r .v{color:var(--red)}
.bar{height:12px;border-radius:8px;overflow:hidden;display:flex;background:#222733;margin:6px 0 2px}
.bar span{display:block;height:100%}
section{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:18px 0}
h2{margin:0 0 12px;font-size:15px;font-weight:600;letter-spacing:.02em}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px;position:sticky;top:0;background:var(--panel);z-index:1}
tr:hover td{background:#1b1f28}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.badge{display:inline-block;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.s-present_exact{background:var(--greenbg);color:#7ee2a0}
.s-present_moved{background:var(--bluebg);color:#8ab4ff}
.s-possible{background:var(--amberbg);color:#f0c75e}
.s-partial{background:var(--amberbg);color:#f0c75e}
.s-missing{background:var(--redbg);color:#ff8a84}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}
.muted{color:var(--muted)}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
input[type=search],select{background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 11px;font-size:13px}
input[type=search]{min-width:320px;flex:1}
.tabs{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.tab{padding:6px 12px;border:1px solid var(--border);border-radius:20px;cursor:pointer;color:var(--muted);background:var(--panel2);font-size:12px}
.tab.active{color:var(--text);border-color:#3d4657;background:#232936}
.tree{max-height:560px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px}
.tree details{margin-left:14px}
.tree summary{cursor:pointer;padding:2px 4px;border-radius:5px}
.tree summary:hover{background:#20252f}
.tree .leaf{padding:2px 4px 2px 22px}
.pill{font-size:10px;padding:0 6px;border-radius:10px;margin-left:6px}
.scroll{max-height:640px;overflow:auto;border:1px solid var(--border);border-radius:8px}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:12px;margin-top:8px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}
</style>
</head>
<body>
<header>
  <h1>Jottacloud Archive vs local index</h1>
  <div class="sub">Archive is the remote listing. “Present” means found in <span class="mono">file_indexer.db</span> (relative to /mnt/tank), either at the same path or anywhere else by name + size.</div>
</header>
<div class="wrap">
  <div class="cards" id="cards"></div>
  <section>
    <h2>Overall coverage</h2>
    <div class="bar" id="bar"></div>
    <div class="legend" id="legend"></div>
  </section>
  <section>
    <h2>Top-level folders</h2>
    <div class="scroll"><table id="toptable">
      <thead><tr><th>Folder</th><th class="num">Files</th><th class="num">Folders</th>
      <th class="num">Present</th><th class="num">Moved</th><th class="num">Possible</th>
      <th class="num">Missing</th><th class="num">Size</th></tr></thead><tbody></tbody></table></div>
  </section>
  <section>
    <h2>Folder tree <span class="muted" style="font-weight:400">(status aggregated from contents)</span></h2>
    <div class="toolbar">
      <input type="search" id="foldersearch" placeholder="Filter folders…">
      <label class="muted"><input type="checkbox" id="onlyproblems"> only folders with missing items</label>
    </div>
    <div class="tree" id="tree"></div>
  </section>
  <section>
    <h2>Differences <span class="muted" id="issuecount" style="font-weight:400"></span></h2>
    <div class="tabs" id="tabs"></div>
    <div class="muted" id="samplenote" style="margin:0 0 10px"></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search path, status or found-at…">
      <select id="topfilter"><option value="">All top-level folders</option></select>
      <span class="muted" id="shown"></span>
    </div>
    <div class="scroll"><table id="issuetable">
      <thead><tr><th>Status</th><th>Archive path</th><th class="num">Size</th><th>Found at / note</th></tr></thead>
      <tbody></tbody></table></div>
    <div class="legend">
      <span><span class="dot" style="background:var(--green)"></span>present, same path</span>
      <span><span class="dot" style="background:var(--blue)"></span>present, moved</span>
      <span><span class="dot" style="background:var(--amber)"></span>possible / partial</span>
      <span><span class="dot" style="background:var(--red)"></span>missing</span>
    </div>
  </section>
  <p class="muted">Also written next to this report: <span class="mono">missing.csv</span>, <span class="mono">moved.csv</span>, <span class="mono">local_only.csv</span>, <span class="mono">summary.json</span>, <span class="mono">report_data.json</span>.</p>
</div>
<script>
const DATA = __DATA__;
const LABELS = __LABELS__;
const COLORS = {present_exact:'var(--green)',present_moved:'var(--blue)',partial:'var(--amber)',possible:'var(--amber)',missing:'var(--red)'};
const fmt = n => n.toLocaleString();
function human(n){const u=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return (i?n.toFixed(1):n)+' '+u[i]}
const S = DATA.summary;
// cards
const cards = [
  ['Archive files', fmt(S.archive.files), human(S.archive.bytes), ''],
  ['Archive folders', fmt(S.archive.dirs), '', ''],
  ['Present (same path)', fmt(S.buckets.exact.files), 'files', 'g'],
  ['Present (moved)', fmt(S.buckets.moved.files), 'files', 'b'],
  ['Possible', fmt(S.buckets.possible.files), 'files', 'a'],
  ['Missing', fmt(S.buckets.missing.files), 'files', 'r'],
  ['Coverage', S.present_pct.toFixed(2)+'%', 'of archive files found', S.present_pct>99?'g':(S.present_pct>90?'b':'a')],
  ['Local-only DB entries', fmt(S.local_only_count||0), 'in DB, not in Archive', ''],
];
document.getElementById('cards').innerHTML = cards.map(([k,v,d,c])=>`<div class="card ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
// bar
const total = Math.max(1,S.archive.files);
const segs=[['exact','var(--green)'],['moved','var(--blue)'],['possible','var(--amber)'],['missing','var(--red)']];
document.getElementById('bar').innerHTML = segs.map(([k,c])=>`<span style="width:${100*S.buckets[k].files/total}%;background:${c}"></span>`).join('');
document.getElementById('legend').innerHTML = segs.map(([k,c])=>`<span><span class="dot" style="background:${c}"></span>${k}: ${fmt(S.buckets[k].files)} files</span>`).join('');
// top table
const tt = document.querySelector('#toptable tbody');
tt.innerHTML = DATA.top.map(t=>`<tr>
  <td class="mono">${t.name}</td><td class="num">${fmt(t.files)}</td><td class="num">${fmt(t.dirs)}</td>
  <td class="num">${fmt(t.exact)}</td><td class="num">${fmt(t.moved)}</td>
  <td class="num">${fmt(t.possible)}</td><td class="num">${fmt(t.missing)}</td>
  <td class="num">${human(t.bytes)}</td></tr>`).join('');
// top filter options
const tf=document.getElementById('topfilter');
DATA.top.forEach(t=>{const o=document.createElement('option');o.value=t.name;o.textContent=t.name;tf.appendChild(o)});
// issues
const issues = DATA.issues;
const tabsDef=[['all','All differences',()=>true],['present_moved','Moved',x=>x.s==='present_moved'],['possible','Possible',x=>x.s==='possible'||x.s==='partial'],['size_mismatch','Size differs',x=>x.s==='size_mismatch'],['missing','Missing',x=>x.s==='missing']];
const COUNTS = DATA.issue_counts||{};
function tabCount(k){ if(k==='all') return Object.values(COUNTS).reduce((a,b)=>a+b,0); if(k==='possible') return (COUNTS.possible||0)+(COUNTS.partial||0); return COUNTS[k]||0; }
let active='all';
document.getElementById('tabs').innerHTML = tabsDef.map(([k,l])=>`<div class="tab${k==='all'?' active':''}" data-k="${k}">${l} (${tabCount(k).toLocaleString()})</div>`).join('');
document.getElementById('samplenote').textContent = `The table below shows a bounded sample (${issues.length.toLocaleString()} rows) to keep this page light. The complete lists are in missing.csv / moved.csv and report_data.json.`;
const q=document.getElementById('q');
const shownEl=document.getElementById('shown');
const tbody=document.querySelector('#issuetable tbody');
function renderIssues(){
  const needle=q.value.toLowerCase();
  const top=tf.value;
  const pred=tabsDef.find(d=>d[0]===active)[2];
  const rows=[];
  for(const x of issues){
    if(!pred(x))continue;
    if(top && !x.p.startsWith(top+'/'))continue;
    if(needle && !(x.p.toLowerCase().includes(needle)||x.s.includes(needle)||(x.f||'').toLowerCase().includes(needle)||(x.n||'').toLowerCase().includes(needle)))continue;
    rows.push(x);
    if(rows.length>=5000)break;
  }
  tbody.innerHTML=rows.map(x=>`<tr>
    <td><span class="badge s-${x.s}">${LABELS[x.s]||x.s}</span></td>
    <td class="mono">${x.d?'📁 ':''}${x.p}</td>
    <td class="num">${x.d?'':fmt(x.z)}</td>
    <td class="mono muted">${x.f?('↳ '+x.f):''}${x.n?(x.f?'<br>':'')+x.n:''}</td></tr>`).join('');
  shownEl.textContent=`showing ${fmt(rows.length)} sample row(s)${rows.length>=5000?' (table capped at 5,000 — use the CSV/report_data.json for everything)':''}`;
}
document.getElementById('tabs').addEventListener('click',e=>{
  const t=e.target.closest('.tab'); if(!t)return;
  active=t.dataset.k;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
  renderIssues();
});
q.addEventListener('input',renderIssues); tf.addEventListener('change',renderIssues);
document.getElementById('issuecount').textContent=`(${fmt(n_issues)} items)`;
renderIssues();
// tree
const byParent={};
DATA.folders.forEach(f=>{
  const parent=f.p.includes('/')?f.p.slice(0,f.p.lastIndexOf('/')):'';
  (byParent[parent]=byParent[parent]||[]).push(f);
});
const fs=document.getElementById('foldersearch');
const onlyp=document.getElementById('onlyproblems');
function stColor(s){return COLORS[s]||'var(--muted)'}
function node(f){
  const kids=byParent[f.p]||[];
  if(onlyp.checked && f.x===0 && !kids.some(hasProblem)) return '';
  if(fs.value && !f.p.toLowerCase().includes(fs.value.toLowerCase()) && !kids.some(k=>k.p.toLowerCase().includes(fs.value.toLowerCase()))) return '';
  const badge=`<span class="pill" style="background:${stColor(f.s)}22;color:${stColor(f.s)}">${LABELS[f.s]||f.s}</span>`;
  const counts=`<span class="muted">${fmt(f.n)} items · ${fmt(f.e)} exact · ${fmt(f.m)} moved · ${fmt(f.x)} missing</span>`;
  if(kids.length){
    return `<details><summary>📁 <b>${f.p.split('/').pop()}</b> ${badge} ${counts}</summary>${kids.map(node).join('')}</details>`;
  }
  return `<div class="leaf">📁 ${f.p.split('/').pop()} ${badge} ${counts}</div>`;
}
function hasProblem(f){
  if(f.x>0||f.s==='missing'||f.s==='partial')return true;
  return (byParent[f.p]||[]).some(hasProblem);
}
function renderTree(){
  const roots=byParent['']||[];
  document.getElementById('tree').innerHTML=roots.map(node).join('')||'<div class="muted" style="padding:10px">No folders match.</div>';
}
fs.addEventListener('input',renderTree); onlyp.addEventListener('change',renderTree);
renderTree();
</script>
</body>
</html>
"""
    html_doc = html_doc.replace("__DATA__", data).replace("__LABELS__", status_labels)
    html_doc = html_doc.replace("Jottacloud Archive vs local index",
                                html.escape(title))
    # inject issue count for the heading
    html_doc = html_doc.replace("const S = DATA.summary;", f"const S = DATA.summary; const N_ISSUES = {n_issues};")
    html_doc = html_doc.replace("fmt(n_issues)", "fmt(N_ISSUES)")
    with open(os.path.join(outdir, "report.html"), "w", encoding="utf-8") as f:
        f.write(html_doc)


if __name__ == "__main__":
    main()
