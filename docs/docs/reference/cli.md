---
title: CLI reference
sidebar_position: 2
description: Flags and environment variables for the comparator, the explorer server, and the Google Drive fetch script.
---

# CLI reference

## `scripts/compare.py`

Compares an rclone JSON listing with the local SQLite index and writes reports.

```bash
python3 scripts/compare.py \
  --db file_indexer.db \
  --archive archive.json \
  --out report \
  --label "Jottacloud Archive"
```

| Option | Default | Description |
| --- | --- | --- |
| `--db PATH` | `file_indexer.db` | SQLite index with a `files` table. |
| `--archive PATH` | **required** | rclone `lsjson -R` output (JSON). |
| `--out DIR` | `report` | Output directory. Created if missing. |
| `--label TEXT` | `Jottacloud Archive` | Service name used in the HTML report title. |
| `--no-strip-archive` | off | Keep a single top-level `Archive/` prefix instead of stripping it. |

Behavior notes:

- Relative paths resolve against the current working directory. Run from the repository
  root to use the defaults.
- The comparator only reads the database; it writes report files into `--out`.
- It streams `report_data.json` and embeds only a bounded sample in the HTML.
- Google Drive's fetch script passes `--no-strip-archive`.

Examples:

```bash
# Google Drive, separate output directory
python3 scripts/compare.py \
  --db file_indexer.db \
  --archive google_drive.json \
  --out report/google_drive \
  --label "Google Drive" \
  --no-strip-archive

# Different index location
python3 scripts/compare.py \
  --db /data/index/file_indexer.db \
  --archive archive.json \
  --out /data/reports/jotta
```

## `explorer/server.py`

Starts the virtual two-pane explorer.

```bash
python3 explorer/server.py --open
```

| Option | Default | Description |
| --- | --- | --- |
| `--host HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` only on trusted networks. |
| `--port PORT` | `8787` | HTTP port. |
| `--open` | off | Open the default browser after startup. |
| `--rebuild` | off | Rebuild all available provider caches. |

Behavior notes:

- Exits with status `1` if `file_indexer.db` is not found next to the repository root.
- Unavailable providers are skipped with a reason printed at startup.
- The first run builds caches and search indexes; later runs reuse them.
- The server serves the static UI from `explorer/web/` and the JSON API under `/api/`.

Examples:

```bash
# Different port
python3 explorer/server.py --port 9000

# LAN access (no authentication)
python3 explorer/server.py --host 0.0.0.0 --port 8787

# Force a cache rebuild after changing snapshots
python3 explorer/server.py --rebuild --open
```

## `scripts/fetch_google_drive.sh`

Snapshots Google Drive and optionally runs the comparison.

```bash
scripts/fetch_google_drive.sh
```

| Variable | Default | Description |
| --- | --- | --- |
| `GDRIVE_REMOTE` | `gdrive` | rclone remote name. |
| `GDRIVE_PATH` | *(empty)* | Optional folder inside the drive. |
| `GDRIVE_ARCHIVE` | `<repo>/google_drive.json` | Snapshot output file. |
| `GDRIVE_REPORT` | `<repo>/report/google_drive` | Report output directory. |
| `RCLONE_CONFIG` | *(empty)* | Explicit rclone config path. A repo `rclone.conf` with `[gdrive]` is used automatically if present. |
| `SKIP_COMPARE` | `0` | Set to `1` to list only, without comparing. |

The script is Bash with `set -euo pipefail`. It lists to a `.tmp` file and moves it into place
on success. If `SKIP_COMPARE=1`, it exits after the snapshot.

## `rclone lsjson`

The snapshot command is not wrapped for Jottacloud, so use rclone directly:

```bash
rclone lsjson jotta:Archive -R > archive.json
```

Useful rclone flags for very large listings:

| Flag | Effect |
| --- | --- |
| `--fast-list` | Use a recursive listing where the backend supports it; often faster and fewer API calls. |
| `--files-only` | Omit directories. The comparator and explorer synthesize missing parents. |
| `--stats 30s` | Print progress while listing. |

Keep the JSON structure intact; the comparator expects `Path`, `Size`, `IsDir`, and
optionally `Hashes`, `ModTime`.

## Environment variables

Only the documentation build uses environment variables (`SITE_URL`, `DOCS_BASE_URL`,
`MARKETING_URL`). The comparison tooling has no required environment variables. See
[Deploying the site](/contributing/deploying-the-site).
