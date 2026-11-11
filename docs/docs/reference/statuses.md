---
title: Status reference
sidebar_position: 1
description: Every badge and internal status key, what it means, and what to do next.
---

# Status reference

Statuses are shown as badges in the explorer and stored as internal keys in
`report_data.json` and the CSVs. This page is the complete mapping.

## Cloud side

These badges describe an item from the selected provider snapshot.

| Badge | Internal key | Meaning | Suggested action |
| --- | --- | --- | --- |
| <span class="status status-same">Same</span> | `present_exact` | Same relative path and type exists locally. Files also have the same size. | Nothing. |
| <span class="status status-possible">Maybe</span> | `size_mismatch` | Same path and type, but the local file size differs. | Review the note; the file may be edited or truncated. |
| <span class="status status-moved">Moved</span> | `present_moved` | No same-path match; same basename and byte size found elsewhere. | Check `found_at` to confirm the relocation. |
| <span class="status status-possible">Maybe</span> | `possible` | Same basename exists locally, but no size match. | Treat as needs review, not confirmed missing. |
| <span class="status status-partial">Partial</span> | `partial` | Folder has some children present and some missing. | Open the folder and inspect missing children. |
| <span class="status status-missing">Missing</span> | `missing` | No path, name, or name + size match. | Check the ignored-folder caveat, then verify against the live source. |
| <span class="status status-missing">Missing</span> | `unresolved` | Folder could not be resolved by path or name. | Inspect the tree; likely a genuinely absent folder. |

:::note
`size_mismatch` is counted in the `exact` summary bucket because the path matched, but the
explorer maps it to **Maybe** so it is not silently treated as verified. In
`report_data.json` the original key is preserved.
:::

## Local side

These badges describe an entry from `file_indexer.db` relative to the selected provider.

| Badge | Internal key | Meaning |
| --- | --- | --- |
| <span class="status status-in">In Jottacloud</span> / <span class="status status-in">In Google Drive</span> | `exact` | Same path exists in the selected provider. |
| <span class="status status-moved">Moved match</span> | `moved_match` | This is the local counterpart of a provider item marked moved or partial. |
| <span class="status status-possible">Maybe</span> | `possible` | This local item is the name-only counterpart of a possible match. |
| <span class="status status-local">Local only</span> | `local_only` | Present in the index but not found anywhere in the provider. |
| <span class="status status-muted">Not in cloud</span> | `unmatched` | No same-path counterpart; it may still have matched elsewhere. |
| <span class="status status-type">Type differs</span> | `type_mismatch` | Same path exists, but one side is a file and the other is a folder. |

The label on `exact` changes with the selected provider (`In Jottacloud` or
`In Google Drive`) so the badge stays unambiguous.

## Status ordering

The explorer sorts statuses in this order when sorting by status:

```text
missing → partial → possible → moved / moved_match
→ type_mismatch → exact → local_only → unmatched
```

This puts the items that need attention first. The order is defined in
`app/src/server/paths.ts` and mirrored in `app/src/web/hooks/usePane.ts`.

## Where statuses come from

| Stage | Source |
| --- | --- |
| Cloud statuses | `report_data.json` `issues` and `folders`, built by `scripts/compare.py`. |
| Local-only entries | `local_only.csv`. |
| Local badges | Computed per listing by `app/src/server/listings.ts` from the cache and local index. |

The explorer does not re-run the comparison. If the underlying snapshot or report changes,
restart the explorer (or run with `--rebuild`) so the cache reflects it.

## Reading counts

- **Files** vs **folders** are counted separately.
- **Size** is the cloud item's byte size; folders have size `0` in rclone listings.
- **Local-only** includes both files and folders. `summary.json`'s `local_only_count`
  counts rows in `local_only.csv`, not only files.
- **present_pct** includes possible matches; see
  [bucket aggregation](/concepts/matching#bucket-aggregation).
