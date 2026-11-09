---
title: The local index
sidebar_position: 1
description: Understand the SQLite file index, its expected schema, the /mnt/tank base path, and the folders indexers usually skip.
---

# The local index

The local index is the reference side of every comparison. It is a SQLite database
containing one row per file and folder, produced by a separate file indexer. Data Cloud
Compare does not build the index; it reads it.

## Expected schema

The comparator queries only four columns:

```sql
SELECT path, size, is_directory, is_file FROM files;
```

| Column | Expected value |
| --- | --- |
| `path` | Absolute path. Normally begins with `/mnt/tank/`. |
| `size` | File size in bytes. Folders may store `0`. |
| `is_directory` | Truthy for folders. |
| `is_file` | Truthy for files. |

A minimal compatible database can be created with:

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  size INTEGER NOT NULL DEFAULT 0,
  is_directory INTEGER NOT NULL DEFAULT 0,
  is_file INTEGER NOT NULL DEFAULT 0
);
```

The real index in this repository has additional columns; they are ignored.

## Inspecting the index

Count entries and confirm the expected shape:

```bash
sqlite3 file_indexer.db \
  "SELECT COUNT(*) AS entries,
          SUM(is_directory) AS dirs,
          SUM(is_file) AS files
   FROM files;"
```

Check the top-level layout:

```bash
sqlite3 file_indexer.db \
  "SELECT substr(path, 1, 40) AS prefix, COUNT(*)
   FROM files
   GROUP BY 1
   ORDER BY 2 DESC
   LIMIT 10;"
```

Check the newest modification metadata available in your schema:

```bash
sqlite3 file_indexer.db ".schema files"
```

## The `/mnt/tank` base path

The comparison strips the `/mnt/tank/` prefix from local paths so they can be compared
with cloud-relative paths. Paths outside the base are normalized and kept as-is rather than
discarded, so nothing is silently lost.

The base path is a constant (`BASE = "/mnt/tank"`) in:

- `scripts/compare.py`
- `explorer/server.py`
- `explorer/cache.py` (via the shared normalization helpers)

If your index uses a different root, change the constant consistently in those files before
running the comparison or explorer. A path that is outside the base is compared using its
normalized relative form, which usually will not line up with a cloud root.

## Ignored folders are the biggest caveat

Most indexers skip dependency and build directories. This repository's index was built with
`ignore_folders` covering:

```text
node_modules  .next  dist  build  target  .gradle  vendor
__pycache__   .venv  .turbo  bin  obj  __history  __recovery
```

Some are conditional (for example, a `bin` folder only when a marker file exists). The
consequence is important:

> A cloud file inside an ignored folder cannot be found in the index, so it is reported as
> missing even though it may be perfectly safe.

In the reference run, **173,463 of 176,971 missing files (98.0%)** were under one of those
folder names — mostly `node_modules`, `vendor`, `target`, `dist`, `build`, and `.next`. The
actionable remainder was **3,508 files / 84.1 GB**, dominated by two dated backup folders.

Use the missing report's paths to separate expected exclusions from real gaps. See
[What “missing” means](/concepts/matching#what-missing-means).

## Snapshot age

The local index is a snapshot, not a live view. The reference index is dated
**2026-08-25**; the Jottacloud snapshot is dated **2026-11-09**. A file added to the local
disk after the index date will not be in the database, and a file removed from disk after
the index date may still appear in it.

The live filesystem is intentionally not consulted. This makes comparisons deterministic
and lets them run without mounting the original storage. Refresh the index with your
indexer if you need current data.

## Read-only behavior

The comparator reads the database and writes only report artifacts. The explorer opens the
database with a read-only URI (`mode=ro`) and enables `PRAGMA query_only`. No part of this
project writes to `file_indexer.db`.

## Multi-provider use

The same local index is compared against every provider. The left pane of the explorer is
always the local index; switching providers recalculates its badges but does not change the
underlying rows. See [Adding a provider](/contributing/adding-a-provider).
