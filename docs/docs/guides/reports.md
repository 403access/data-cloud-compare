---
title: Reports
sidebar_position: 5
description: Understand every file the comparator writes — HTML, CSV, JSON — and how to use them in scripts.
---

# Reports

Every comparison writes a self-contained set of outputs into the directory passed to
`--out` (default `report/`). Jottacloud and Google Drive use separate directories, so one
run never overwrites the other.

## Output files

| File | Format | Contents |
| --- | --- | --- |
| `report.html` | HTML | Self-contained visual diff with embedded sample data and styles. |
| `summary.json` | JSON | Headline totals and bucket counts. |
| `missing.csv` | CSV | Every cloud item in `missing` or `unresolved` state. |
| `moved.csv` | CSV | Every `moved`, `possible`, or `partial` cloud item, including where it was found. |
| `local_only.csv` | CSV | Local index entries never matched to a cloud item. |
| `report_data.json` | JSON | Full machine-readable dataset, including every issue. |

The HTML embeds a bounded sample of issues to keep the file manageable; the CSV and JSON
files contain the complete data.

## Summary

`summary.json` looks like this:

```json
{
  "archive": { "files": 1434971, "dirs": 196836, "bytes": 7142425862244 },
  "buckets": {
    "exact":    { "files": 1173034, "dirs": 155166, "bytes": 7000348398540 },
    "moved":    { "files": 23384,   "dirs": 29367,  "bytes": 29391149018 },
    "possible": { "files": 61582,   "dirs": 0,      "bytes": 16728305489 },
    "missing":  { "files": 176971,  "dirs": 12303,  "bytes": 95958009197 }
  },
  "present_files": 1258000,
  "missing_files": 176971,
  "present_pct": 87.66727689967254,
  "db_entries": 1333411,
  "local_only_count": 5188
}
```

`present_pct` includes `exact`, `moved`, and `possible` files. A `possible` match is a
same-name file with a different size, so it is present by name but not confirmed. Use the
bucket counts when you need a stricter percentage.

## CSV columns

`missing.csv` and `moved.csv` share a schema:

| Column | Meaning |
| --- | --- |
| `archive_path` | Path relative to the cloud root. |
| `type` | `file` or `dir`. |
| `status` | One of the internal status keys (see below). |
| `size` | Byte size for files, `0` for folders. |
| `found_at` | Local index path where the item was found, if any. |
| `note` | Extra context such as size differences or other candidate count. |

`local_only.csv` has three columns:

| Column | Meaning |
| --- | --- |
| `local_path` | Relative local path (prefix stripped). |
| `type` | `file` or `dir`. |
| `size` | Byte size or `0`. |

CSV files are written in RFC 4180 form: UTF-8, CRLF line endings, a header row, and
quoting only where needed.

## Internal status keys

| Key | Appears in | Meaning |
| --- | --- | --- |
| `present_exact` | report data | Same path and type; size matches for files. |
| `size_mismatch` | report data, HTML | Same path and type, but file size differs. |
| `present_moved` | moved CSV | Found elsewhere by basename + size. |
| `possible` | moved CSV | Same basename, different size. |
| `partial` | moved CSV | Folder with some children present and some missing. |
| `missing` | missing CSV | No path, name, or name + size match. |
| `unresolved` | missing CSV | Folder that could not be resolved by name. |

The explorer maps these to friendlier badges. See [Status reference](/reference/statuses).

## `report_data.json`

The JSON dataset has five top-level keys:

| Key | Shape | Notes |
| --- | --- | --- |
| `summary` | Same object as `summary.json` | Headline totals. |
| `top` | Array of top-level folder records | Counts per bucket, files, dirs, bytes. |
| `folders` | Array of folder records | Compact keys: `p` path, `s` status, `n` children, `e` exact, `m` moved, `x` missing, `f` found-at. |
| `issues` | Array of issue records | Only non-exact items. Keys: `p` path, `d` is-dir, `s` status, `z` size, `f` found-at, `n` note. |
| `issue_counts` | Object | Counts per internal status key. |

The comparator streams `report_data.json` so it never builds a second million-row array
in memory. The HTML receives a bounded sample with these caps:

| Status | Sample cap |
| --- | ---: |
| `missing` | 25,000 |
| `possible` | 10,000 |
| `present_moved` | 10,000 |
| `partial` | 4,000 |
| `size_mismatch` | 4,000 |

## Reading `report.html`

The HTML report is a single file with inline CSS and JavaScript. Open it directly in a
browser; there is no server or network access required.

- Green = present at the same path.
- Blue = present but moved.
- Amber = possible or partial.
- Red = missing.
- The tree opens filtered to folders with missing items. Uncheck the filter to see
  everything.

## Automating reports

Because the outputs are plain files, they are easy to archive or post-process:

```bash
# Count missing files by top-level folder
bun -e 'const d = await Bun.file("report/report_data.json").json();
const counts = {};
for (const x of d.issues) {
  if (x.s !== "missing" || x.d) continue;
  const key = x.p.split("/")[0];
  counts[key] = (counts[key] || 0) + 1;
}
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10));'

# Print the summary
bun -e 'console.log((await Bun.file("report/report_data.json").json()).summary)'
```

Reports can be large. Store them outside a public repository if the paths are sensitive.

## Next

- [Matching model](/concepts/matching) — how each status is computed.
- [Status reference](/reference/statuses) — badge-by-badge meanings.
- [CLI reference](/reference/cli) — flags and options.
