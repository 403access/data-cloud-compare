---
title: Google Drive
sidebar_position: 3
description: Snapshot Google Drive with rclone and compare it with the local index using the included fetch script.
---

# Google Drive

Google Drive support is provided by `scripts/fetch_google_drive.sh`. It lists the drive with
rclone, writes a snapshot, and runs the comparator with a separate report directory so
Jottacloud and Drive results do not overwrite each other.

## Configure rclone

Create a Google Drive remote named `gdrive`:

```bash
rclone config
```

Choose **n** for a new remote, name it `gdrive`, select **Google Drive**, and complete the
OAuth flow. Then verify:

```bash
rclone lsd gdrive:
```

Alternatively:

```bash
rclone config create gdrive drive
```

The interactive flow is recommended the first time because it handles the browser consent
and token storage.

## Run the fetch script

```bash
scripts/fetch_google_drive.sh
```

The script performs two steps:

1. `rclone lsjson gdrive: -R > google_drive.json`
2. `python3 scripts/compare.py --db file_indexer.db --archive google_drive.json --out report/google_drive --label "Google Drive" --no-strip-archive`

It then prints the command to start the explorer.

## Environment overrides

| Variable | Default | Purpose |
| --- | --- | --- |
| `GDRIVE_REMOTE` | `gdrive` | rclone remote name. |
| `GDRIVE_PATH` | *(empty)* | Optional subfolder inside the drive, for example `Backup`. |
| `GDRIVE_ARCHIVE` | `<repo>/google_drive.json` | Snapshot output path. |
| `GDRIVE_REPORT` | `<repo>/report/google_drive` | Report output directory. |
| `RCLONE_CONFIG` | *(empty)* | Use a specific rclone config file. If unset, a repo `rclone.conf` containing a `[gdrive]` section is used automatically. |
| `SKIP_COMPARE` | `0` | Set to `1` to refresh only the snapshot and skip the comparison. |

Examples:

```bash
# Use a different remote
GDRIVE_REMOTE=my-drive scripts/fetch_google_drive.sh

# Only list one folder
GDRIVE_PATH=Backup scripts/fetch_google_drive.sh

# Refresh the snapshot without comparing
SKIP_COMPARE=1 scripts/fetch_google_drive.sh
```

Run from the repository root. If you run the script from elsewhere, it still resolves paths
relative to its own location.

## Why `--no-strip-archive`?

The Jottacloud path can be listed from a device root where every entry starts with
`Archive/`, so the comparator strips that prefix when it is the only top-level folder.
Google Drive has no equivalent mountpoint, and a folder could legitimately be named
`Archive`. The fetch script therefore disables prefix stripping explicitly.

## Relation to the local index

Drive paths are relative to the root (or the chosen subfolder). The local index is rooted at
`/mnt/tank`. Exact-path matches only occur where those relative structures correspond.

In the reference repository, the Google Drive report shows **0 exact matches** because the
Drive contents live under paths such as `GoogleDrivePrivate/...` that do not mirror the local
root. The matching cascade still finds moved and possible items by name and size. This is
expected, not a bug.

## Refresh and explorer use

Re-run the script whenever you want fresh numbers. The explorer detects the new snapshot and
report on restart and rebuilds the Google Drive cache automatically.

If Google Drive has not been fetched, the provider button is dimmed in the explorer and its
tooltip explains what to run. Jottacloud continues to work independently.
