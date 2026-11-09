---
slug: /
title: Overview
sidebar_label: Overview
sidebar_position: 1
description: Verify a cloud archive against a local file index with a cascading matcher, shareable reports, and a virtual two-pane explorer.
---

# Data Cloud Compare

**Data Cloud Compare verifies a cloud archive against a local file index.** It answers a
deceptively simple question after a migration, a sync, or a decade of backups:

> Is everything that is in the cloud still accounted for locally — and what is not?

Instead of trusting a sync log, the tool compares a full cloud listing with your SQLite
file index. It classifies every file and folder, writes shareable reports, and presents the
result in a Finder-style explorer where both sides are virtual and read-only.

<p>
  <span className="doc-badge">Local-first</span>{' '}
  <span className="doc-badge">Read-only</span>{' '}
  <span className="doc-badge">Python stdlib</span>{' '}
  <span className="doc-badge">rclone snapshots</span>
</p>

## What it does

| Piece | Purpose |
| --- | --- |
| **Comparator** (`scripts/compare.py`) | Compares an rclone JSON listing with a SQLite index and writes HTML, CSV, and JSON reports. |
| **Explorer** (`explorer/server.py`) | Serves a virtual two-pane UI over the comparison cache. No live filesystem access. |
| **Provider definitions** (`explorer/providers.py`) | Tell the explorer which snapshot and report belong to each cloud. |
| **Fetch script** (`scripts/fetch_google_drive.sh`) | Snapshots Google Drive with rclone and runs the comparison in one step. |

The project currently ships with two provider definitions: **Jottacloud** (the `Archive`
mountpoint) and **Google Drive**. Any rclone backend that can produce a JSON listing can be
added with a small provider definition.

## What it is not

- **Not a sync tool.** It does not upload, download, move, or delete files.
- **Not a content hash verifier.** Providers often expose MD5 while local indexes store
  SHA-256, so the reference workflow matches on path, name, and size. Read
  [the matching model](/concepts/matching) before treating a result as proof.
- **Not a hosted service.** The explorer binds to `127.0.0.1` and reads local files only.
- **Not a backup.** It verifies the relationship between two existing records.

## How a comparison runs

```text
cloud provider                      local machine
┌───────────────┐                   ┌──────────────────┐
│ rclone lsjson │                   │ file_indexer.db  │
│ snapshot.json │                   │ (SQLite)         │
└───────┬───────┘                   └────────┬─────────┘
        │                                    │
        └──────────────┬─────────────────────┘
                       ▼
              scripts/compare.py
                       │
        ┌──────────────┼───────────────┐
        ▼              ▼               ▼
   report.html    missing.csv     summary.json
   moved.csv      local_only.csv  report_data.json
                       │
                       ▼
              explorer/server.py
              (virtual two-pane UI)
```

The comparator never writes to the index. The explorer opens it with SQLite's `mode=ro` and
serves cached data over a loopback-only HTTP server.

## An example run

A reference comparison against a Jottacloud Archive (summarised in `report/SUMMARY.md`)
produced these numbers:

| Metric | Result |
| --- | ---: |
| Cloud files | 1,434,971 |
| Cloud folders | 196,836 |
| Catalogued size | 7,142.4 GB |
| Present by path, name, or move | 1,258,000 (87.7%) |
| Missing after all matching passes | 176,971 files |
| Local-only index entries | 5,077 files |

The headline caveat matters: **98% of the missing files were inside dependency and build
folders the indexer deliberately skips** (`node_modules`, `.next`, `target`, and similar).
The actionable remainder was 3,508 files. See
[What “missing” means](/concepts/matching#what-missing-means) for the full explanation.

## Requirements

- Python **3.10+** (standard library only — no `pip install` required)
- [rclone](https://rclone.org/) with a configured remote
- An index database with the expected `files` table
- At least one provider snapshot and its comparison report

## Start here

1. [Install the prerequisites](/getting-started/installation)
2. [Run your first comparison](/getting-started/quickstart)
3. [Set up Jottacloud](/guides/jottacloud) or [Google Drive](/guides/google-drive)
4. [Learn the explorer](/guides/explorer)
5. [Read the matching model](/concepts/matching) before acting on results
