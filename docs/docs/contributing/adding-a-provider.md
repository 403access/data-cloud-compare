---
title: Add a provider
sidebar_position: 1
description: Define a new rclone-backed cloud provider, generate its report, and make it appear in the explorer switch.
---

# Add a provider

Any cloud that rclone can list can be compared. Adding a provider is a four-step process:
snapshot, compare, define, restart.

The explorer reads the provider list from `/api/providers`, so a new definition appears in
the top-bar switch automatically — no frontend changes are needed.

## 1. Create a snapshot

List the remote to a JSON file at the repository root:

```bash
rclone lsjson myremote: -R > my_cloud.json
```

Use `--fast-list` for large remotes when the backend supports it.

The comparator accepts either a JSON array or an object containing `items` or `files`. For
each entry it reads:

| Field | Accepted keys |
| --- | --- |
| Path | `Path`, `path`, `Name` |
| Directory flag | `IsDir`, `is_dir` |
| Size | `Size`, `size` |
| MD5 | `Hashes.MD5`, `md5` |
| Modified time | `ModTime`, `mod` |

The explorer cache uses `Path`/`Name`, `IsDir`, and `Size`.

## 2. Generate a report

Choose a dedicated output directory:

```bash
python3 scripts/compare.py \
  --db file_indexer.db \
  --archive my_cloud.json \
  --out report/my_cloud \
  --label "My Cloud" \
  --no-strip-archive
```

Use `--no-strip-archive` unless you specifically want a single top-level `Archive/` prefix
removed. Without the flag, the comparator strips it whenever every path shares that prefix.
The explorer only performs Archive-prefix stripping for the Jottacloud provider, so keeping
the prefix avoids a mismatch between the report and the explorer tree.

The output directory must contain:

```text
report/my_cloud/
  report_data.json
  local_only.csv
  summary.json
  report.html
  missing.csv
  moved.csv
```

Readiness only requires `report_data.json` and `local_only.csv` (plus the snapshot), but
keeping the full set is useful.

## 3. Define the provider

Edit `explorer/providers.py`:

```python
MY_CLOUD = Provider(
    key="my_cloud",
    label="My Cloud",
    archive_json=ROOT / "my_cloud.json",
    report_dir=ROOT / "report" / "my_cloud",
    rclone_remote="myremote",
    root_label="My Drive",
    subtitle="my_cloud.json snapshot · virtual read-only view",
    accent="#e07a5f",
    help=(
        "Run: rclone lsjson myremote: -R > my_cloud.json && "
        "python3 scripts/compare.py --db file_indexer.db "
        "--archive my_cloud.json --out report/my_cloud "
        "--label 'My Cloud' --no-strip-archive"
    ),
)
```

Then register it:

```python
def get_providers() -> list[Provider]:
    return [JOTTACLOUD, GOOGLE_DRIVE, MY_CLOUD]
```

### Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `key` | yes | Stable, lowercase identifier. Used in URLs and cache filenames. |
| `label` | yes | Shown in the provider switch. |
| `archive_json` | yes | Absolute path to the snapshot. |
| `report_dir` | yes | Directory containing the report outputs. |
| `rclone_remote` | yes | Used in help text and for documentation. |
| `root_label` | yes | Display label for the cloud root. |
| `subtitle` | yes | Source description shown in the UI. |
| `accent` | yes | CSS color used for the provider accent. |
| `help` | yes | Commands shown when the provider is unavailable. |

`report_data.json`, `local_only.csv`, and `summary.json` are derived properties and must not
be set.

## 4. Restart the explorer

```bash
python3 explorer/server.py --open
```

The startup log lists each provider and whether it is ready. The new provider builds its own
cache on first use.

Cache naming:

- Jottacloud keeps the legacy `explorer/.cache/explorer.db`.
- Other providers use `explorer-<key>.db`.
- Search indexes use `search-<key>.index*`.

## Optional: add a fetch script

If listing the provider needs extra flags or arguments, add a script under `scripts/`
similar to `fetch_google_drive.sh`. Keep it idempotent: write the snapshot to a temporary
file, move it into place on success, then invoke `compare.py` with the provider's report
directory.

## Testing a new provider

1. Confirm readiness by starting the explorer and reading the log.
2. Open the switch and select the provider.
3. Check that the right pane shows the expected root and that a known file gets a plausible
   badge.
4. Compare `summary.json` with `report_data.json` counts.
5. Test with the provider's snapshot temporarily renamed; the explorer should mark only that
   provider unavailable.

## Next

- [Matching model](/concepts/matching)
- [Reports](/guides/reports)
- [Architecture](/reference/architecture)
