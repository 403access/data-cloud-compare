---
title: Jottacloud
sidebar_position: 2
description: Configure rclone for Jottacloud, snapshot the Archive mountpoint, and compare it with the local index.
---

# Jottacloud

Jottacloud is the default provider. Its definition expects an rclone remote named `jotta`
and compares the `Archive` mountpoint against the local index.

## Configure rclone

Create a Jottacloud remote:

```bash
rclone config
```

Choose **n** for a new remote, name it `jotta`, select **Jottacloud**, and complete the
authentication flow. Then verify access:

```bash
rclone lsd jotta:
rclone lsd jotta:Archive
```

If your remote already has a different name, either rename it to `jotta`, update the
`rcloneRemote` field in `app/src/server/providers.ts`, or pass the path explicitly when listing.

## Snapshot the Archive

```bash
rclone lsjson jotta:Archive -R > archive.json
```

For a large archive, list to a temporary file and move it into place so a failed run does
not leave a partial snapshot:

```bash
rclone lsjson jotta:Archive -R > archive.json.tmp && mv archive.json.tmp archive.json
```

The snapshot contains paths relative to the `Archive` mountpoint, plus sizes and directory
flags. It does not download files, and Jottacloud's listing does not provide reliable
modification times, so the explorer shows `—` in its Modified column.

## Run the comparison

```bash
bun scripts/compare.ts \
  --db file_indexer.db \
  --archive archive.json \
  --out report \
  --label "Jottacloud Archive"
```

Defaults:

| Option | Default | Notes |
| --- | --- | --- |
| `--db` | `file_indexer.db` | Local SQLite index. |
| `--archive` | required | rclone `lsjson -R` output. |
| `--out` | `report` | Directory for all outputs. |
| `--label` | `Jottacloud Archive` | Used in the HTML report title. |
| `--no-strip-archive` | off | Keep a single top-level `Archive/` prefix. |

## How the Archive prefix is handled

If you list the device root rather than `jotta:Archive`, every path may begin with
`Archive/`. When **all** snapshot entries share that single top-level prefix, the comparator
strips it automatically so paths line up with `/mnt/tank`. If your listing is already
relative to `Archive`, nothing changes.

Use `--no-strip-archive` when the prefix is meaningful and should be preserved. Google Drive
uses this flag because a top-level folder could legitimately be named `Archive`.

## Refresh cadence

Re-run the two commands whenever you want current numbers:

```bash
rclone lsjson jotta:Archive -R > archive.json.tmp && mv archive.json.tmp archive.json
bun scripts/compare.ts --db file_indexer.db --archive archive.json --out report
```

Then restart the explorer, or leave it running and pass `--rebuild` on the next start. The
cache detects changes to the snapshot, `report_data.json`, `local_only.csv`, and the local
index automatically, so a restart normally rebuilds only what changed.

## Expected output

The comparison writes to `report/`:

```text
report/
  summary.json
  missing.csv
  moved.csv
  local_only.csv
  report_data.json
  report.html
```

See [Reports](/guides/reports) for the contents of each file, and
[Matching](/concepts/matching) for how statuses are assigned.

:::note
Jottacloud exposes MD5 hashes while the local index stores SHA-256, so a direct hash
cross-check is not part of the workflow. Name + size matching is used for moved files.
:::
