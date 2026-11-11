---
title: Quickstart
sidebar_position: 2
description: Run a complete Jottacloud comparison and open the virtual explorer in three commands.
---

# Quickstart

This walkthrough compares a Jottacloud `Archive` against `file_indexer.db` and opens the
explorer. Run all commands from the repository root so the default file paths resolve.

## 1. Snapshot the cloud listing

```bash
rclone lsjson jotta:Archive -R > archive.json
```

`lsjson` returns JSON metadata without downloading file contents. A large archive can take
several minutes to list. The command writes a `.tmp`-free file only when the listing
finishes because your shell creates it directly; if you want an atomic refresh, write to a
temporary file and move it into place:

```bash
rclone lsjson jotta:Archive -R > archive.json.tmp
mv archive.json.tmp archive.json
```

:::note
If your remote is not named `jotta`, substitute your remote name. If you list the device
root instead of the `Archive` mountpoint, every path will usually start with `Archive/`;
the comparator strips that prefix automatically. Use `--no-strip-archive` to keep it.
:::

## 2. Compare against the local index

```bash
python3 scripts/compare.py \
  --db file_indexer.db \
  --archive archive.json \
  --out report
```

The comparator loads the snapshot, streams the comparison, and writes the report files into
`report/`:

```text
Loading archive listing...
  1,434,971 archive entries
Loading local index...
  1,333,411 local entries

Archive: 1,434,971 files, 196,836 dirs, 7.0 TB
  exact    : 1,173,034 files / 155,166 dirs
  moved    : 23,384 files / 29,367 dirs
  possible : 61,582 files / 0 dirs
  missing  : 176,971 files / 12,303 dirs
Local-only DB entries: 5,188
Report: /path/to/repo/report/report.html
```

The exact counts depend on your index and snapshot. The four buckets are explained in
[the matching model](/concepts/matching#bucket-aggregation).

## 3. Open the virtual explorer

```bash
bun install --cwd app
bun run --cwd app build
bun run --cwd app start --open
```

Then visit [http://127.0.0.1:8787/](http://127.0.0.1:8787/) if the browser does not open automatically.

The first start builds a cache and a compact search index for each available provider. With
a multi-million-row index this can take around 30 seconds per provider for the cache and
around 20 seconds for the search index. Later starts detect unchanged inputs and start
instantly.

You should see two panes:

- **Left:** the local `/mnt/tank` index.
- **Right:** the selected provider's snapshot, with a `Jottacloud` / `Google Drive` switch
  in the top bar.

Both panes are virtual. The explorer never reads `/mnt/tank` and never changes either side.

## Optional: compare Google Drive

Configure an rclone remote named `gdrive`, then run the included script:

```bash
rclone config
scripts/fetch_google_drive.sh
bun run --cwd app start --open
```

The script lists the drive, writes `google_drive.json`, and runs the comparison into
`report/google_drive/`. See the [Google Drive guide](/guides/google-drive) for scoping and
environment overrides.

## Where to go next

- [Explorer guide](/guides/explorer) — navigation, search, filters, keyboard shortcuts.
- [Reports](/guides/reports) — what each output file contains.
- [Matching model](/concepts/matching) — why a file might be labelled missing.
- [Troubleshooting](/help/troubleshooting) — common startup and provider problems.
