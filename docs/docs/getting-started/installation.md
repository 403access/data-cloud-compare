---
title: Installation
sidebar_position: 1
description: Install Python, rclone, and the repository, and confirm the expected index and snapshot files are present.
---

# Installation

Data Cloud Compare runs from a checkout of the repository. The comparator uses only the
Python standard library. The explorer is a Bun + React + TypeScript app with its own
dependencies; no Python virtual environment is required.

## Prerequisites

### Python 3.10 or newer

Check your version:

```bash
python3 --version
```

The code uses modern type-hint syntax and `from __future__ import annotations`. Python 3.10+
is the supported baseline. No third-party Python packages are used.

### Bun 1.3 or newer

The explorer runs on [Bun](https://bun.sh/):

```bash
bun --version
bun install --cwd app
```

The screenshot comparison tooling also needs the root dev dependencies (`bun install`).

### rclone

Install rclone from [rclone.org/install](https://rclone.org/install/), then confirm it is on
your `PATH`:

```bash
rclone version
```

You need a configured remote for each cloud provider you want to compare. The default
remote names are:

| Provider | Remote name | Root path |
| --- | --- | --- |
| Jottacloud | `jotta` | `Archive` |
| Google Drive | `gdrive` | My Drive root, or a subfolder |

You can use different names through environment variables or by editing the provider
definitions. See [Jottacloud](/guides/jottacloud) and [Google Drive](/guides/google-drive).

### Node.js (documentation only)

Node.js 20+ is required **only** if you want to run or build this documentation site. The
comparison tooling does not use Node; the explorer uses Bun.

## Clone the repository

```bash
git clone https://github.com/403access/data-cloud-compare.git
cd data-cloud-compare
```

## Expected inputs

A comparison needs two things.

### 1. The local SQLite index

By default the comparator looks for `file_indexer.db` in the current working directory:

```bash
ls -lh file_indexer.db
```

The database must contain a `files` table with at least these columns:

| Column | Type | Meaning |
| --- | --- | --- |
| `path` | text | Absolute local path, normally rooted at `/mnt/tank`. |
| `size` | integer | Byte size. |
| `is_directory` | boolean/integer | True for folders. |
| `is_file` | boolean/integer | True for files. |

See [The local index](/guides/local-index) for schema checks and matching details.

### 2. A provider snapshot

A snapshot is the output of `rclone lsjson -R`, saved as JSON. For Jottacloud:

```bash
rclone lsjson jotta:Archive -R > archive.json
```

For Google Drive, the included script creates `google_drive.json` for you.

You also need the comparison report generated from that snapshot. The explorer reads the
snapshot, the report's `report_data.json`, and `local_only.csv`.

## Repository layout

```text
scripts/
  compare.py                 comparison engine + report writer
  fetch_google_drive.sh      snapshot Google Drive, then compare
app/
  src/server/                Bun HTTP server, caches, listings and JSON API
  src/web/                   React + TypeScript client
  public/                    HTML shell and styles
  .cache/                    generated explorer caches (git-ignored)
explorer/                    legacy Python explorer (rendering reference)
tools/screenshots/           baseline/after screenshot harness
report/                      Jottacloud comparison output
report/google_drive/         Google Drive comparison output
marketing/                   static marketing site
docs/                        Docusaurus documentation site
```

Generated snapshots, reports, and explorer caches are excluded by `.gitignore`. A
hand-written summary of the reference run is kept in `report/SUMMARY.md`; treat your own
snapshots and reports as private data.

## Verify the checkout

Run the comparator's help output, the explorer's help output, and its type check:

```bash
python3 scripts/compare.py --help
bun run app/src/server/index.ts --help
bun run --cwd app typecheck
```

The comparator should print usage without importing anything outside the standard library.

## Next step

Continue to the [quickstart](/getting-started/quickstart) to run an end-to-end comparison.
