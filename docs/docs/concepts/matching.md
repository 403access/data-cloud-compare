---
title: Matching model
sidebar_position: 1
description: How the comparator normalizes paths and cascades from exact-path matches to moved and possible matches, and what missing really means.
---

# Matching model

The comparator does not make a single guess. It works through a cascade, from strongest
evidence to weakest, and records exactly which rule produced each verdict. This page
documents that cascade and its limits.

## Path normalization

Before any comparison, both sides are normalized:

1. Unicode **NFC** normalization.
2. Jottacloud's fullwidth lookalikes are translated back to ASCII:
   `＂ → "`, `＊ → *`, `： → :`, `＜ → <`, `＞ → >`, `？ → ?`, `｜ → |`, `％ → %`.
3. Backslashes become forward slashes.
4. Repeated slashes collapse, and leading/trailing slashes are removed.

The local side additionally strips the `/mnt/tank` prefix. The cloud side optionally strips
a single top-level `Archive` prefix when every entry shares it (Jottacloud device-root
listings).

Snapshots may be a JSON array or an object containing `items` or `files`. Paths are read
from `Path`, `path`, or `Name`; directory flags from `IsDir`/`is_dir`; sizes from
`Size`/`size`; hashes from `Hashes.MD5`; modification times from `ModTime`.

## Files: the four-pass cascade

Each cloud file is tested in order. The first pass that succeeds wins.

### Pass 1 — exact relative path

The same relative path must exist locally **and be a file**. If it exists but the byte size
differs, the file is marked `size_mismatch` rather than missing. It stays present in the
summary totals but is surfaced as a report issue and displayed as <span class="status status-possible">Maybe</span>
in the explorer.

### Pass 2 — case-insensitive path

Filesystems differ on case sensitivity. If no exact path matches, the comparator looks for a
unique case-insensitive path whose type also matches. The matched local path is recorded in
`found_at`.

### Pass 3 — same basename + same size

If the path is gone, the file may simply have moved. The comparator searches the entire
index for the same basename and the exact same byte size. A match is marked
`present_moved` and the chosen local path is recorded.

### Pass 4 — same basename, different size

If the name exists but no size matches, the file is marked `possible`. This is deliberately
**not** missing: it may be an edited file, a partial download, or a different file that
happens to share a name. It is surfaced for review.

If none of the passes succeed, the file is marked `missing`.

## Choosing between moved candidates

Name + size can be ambiguous. When several local files qualify, the comparator scores each
candidate:

| Signal | Score |
| --- | ---: |
| Same immediate parent folder name | `+4` |
| Same top-level folder | `+2` |
| Depth difference | `−abs(local_depth − cloud_depth)` |
| Longer candidate path | `−0.01 × path_depth` |

The highest-scoring candidate is used and the number of other candidates is recorded in the
note (for example `+3 other location(s)`). The `found_at` value in the CSV is always the
chosen path; it is a best-effort location, not proof of identity.

## Folders

Folders are handled in two stages.

### Direct folder matching

1. Exact path and directory type.
2. Same folder basename anywhere in the index (case-insensitive), scored with the same
   candidate logic.

If neither succeeds, the folder is marked unresolved for now.

### Bottom-up aggregation

Remaining folders are processed deepest-first using their children:

| Children | Folder status |
| --- | --- |
| All present | `present_moved` — “structure differs but all children found” |
| Some present, some missing | `partial` |
| None present | `missing` |
| Empty and unmatched | `missing` |

A folder is therefore never labelled missing merely because its own path changed. It is
missing only when neither its path nor its name matched and none of its children were found.

## Bucket aggregation

The summary rolls statuses into four buckets:

| Bucket | Internal statuses |
| --- | --- |
| `exact` | `present_exact`, `size_mismatch`, and any other unresolved default |
| `moved` | `present_moved`, `partial` |
| `possible` | `possible` |
| `missing` | `missing`, `unresolved` |

`present_pct` is computed as:

```text
(exact.files + moved.files + possible.files) / archive.files × 100
```

Because `possible` counts as present, the headline percentage is optimistic. Use the bucket
counts for a stricter view.

## What “missing” means

An item is labelled **missing** only when all of the following are true:

1. No local entry exists at the same relative path (including a case-insensitive fallback).
2. No local entry exists anywhere with the same basename and byte size.
3. For folders, no same-name folder was found and no child was found.

It means **absence from the local index snapshot**, not proof that a file was deleted or is
absent from the live disk. The live filesystem is intentionally not consulted.

### The dependency-folder caveat

Indexers skip build and dependency folders. In the reference run, 173,463 of 176,971 missing
files (98.0%) were under one of:

```text
node_modules  vendor  target  dist  build  .next  .gradle
__pycache__   .venv   .turbo  bin   obj    __history  __recovery
```

Those files are in the cloud but were never indexed locally. The actionable remainder was
3,508 files / 84.1 GB, dominated by two dated backup folders. Always separate expected
exclusions from real gaps before acting on the missing count.

### No cross-hash verification

Jottacloud exposes MD5 while the local index stores SHA-256, so a direct content hash
cross-check is not possible in the reference workflow. Consequences:

- A file that was renamed **and** resized can be reported missing even if a copy exists.
- A same-name file with a different size is labelled `possible`, not confirmed absent.
- A size collision can produce a false moved match, especially for tiny files.

The tool is a verification aid, not a forensic proof of content identity.

## Type mismatches

Files are only matched to files and folders to folders. If a local file shares a path with a
cloud folder (or vice versa), the explorer displays <span class="status status-type">Type differs</span>
on the local side. The cloud side will typically show missing or a name-based match,
depending on the rest of the cascade.

## Worked example

```text
Cloud item:   Projects/Aurora/README.md   (11,400 bytes)

Local index:
  Projects/Aurora/README.md ............... absent
  archive/2024/Aurora/README.md ........... 11,400 bytes  ← pass 3 match
  notes/Aurora/README.md .................. 9,100 bytes   (not a size match)

Result: present_moved
found_at: archive/2024/Aurora/README.md
note: +0 other location(s)
```

In the explorer this appears as <span class="status status-moved">Moved</span> on the cloud
side and <span class="status status-moved">Moved match</span> on the local side.

## Related

- [Status reference](/reference/statuses)
- [Reports](/guides/reports)
- [The local index](/guides/local-index)
