---
title: Troubleshooting
sidebar_position: 1
description: Fix common startup, provider, cache, search, and data interpretation problems.
---

# Troubleshooting

## The explorer exits with “Local index not found”

```text
Local index not found: /path/to/file_indexer.db
```

The server expects `file_indexer.db` at the repository root. Either place the database there
or run the comparator with `--db` and copy the result, then restart from the repository root:

```bash
cd data-cloud-compare
ls -lh file_indexer.db
bun run --cwd app start --open
```

The explorer path is not configurable through a flag; the local index location is a constant
in `app/src/server/paths.ts` and `app/src/server/cache.ts`. See
[The local index](/guides/local-index#the-mnttank-base-path).

## A provider is dimmed or unavailable

The startup log explains which input is missing. Typical reasons:

| Reason | Fix |
| --- | --- |
| `archive.json is missing` | Run `rclone lsjson jotta:Archive -R > archive.json`. |
| `google_drive.json is missing` | Run `scripts/fetch_google_drive.sh`. |
| The report is missing | Run `python3 scripts/compare.py ...` with the matching `--out`. |
| `local_only.csv` is missing | Re-run the comparison; the explorer requires all report outputs. |

Provider readiness requires the snapshot, `report_data.json`, and `local_only.csv`. The
other provider stays usable when one is unavailable.

## rclone authentication or config problems

- Run `rclone lsd remote:` to confirm the remote works outside this tool.
- Re-authenticate with `rclone config reconnect remote:`.
- For Google Drive, complete the OAuth flow in `rclone config`; headless machines need a
  browser-based token creation.
- If you use a non-default config file, set `RCLONE_CONFIG` or pass `--config` in your own
  listing command. The fetch script checks a repository-local `rclone.conf` containing a
  `[gdrive]` section automatically.

## The first explorer start is slow

Expected. The first start builds a cache and search index per provider. On a large index,
allow roughly 30 seconds per provider for the cache and 20 seconds for search. Later starts
are instant.

If a start seems stuck, check the terminal. The server logs each cache phase and entries
parsed. Do not start multiple servers against the same cache directory simultaneously; the
cache is built through a temporary file and moved into place, but concurrent rebuilds waste
work.

## Numbers did not change after refreshing a snapshot

The cache detects changes to the snapshot, `report_data.json`, and `local_only.csv`. If you
replaced a file while preserving its size and modification time, detection can miss it.
Force a rebuild:

```bash
bun run app/src/server/index.ts --rebuild --open
```

Or delete the provider cache:

```bash
rm app/.cache/explorer-google_drive.db
rm app/.cache/search-google_drive.index*
```

The Jottacloud cache keeps the legacy name `explorer.db`.

## Search returns nothing

- Queries need at least **two characters**.
- Check the scope: **This folder** only searches the current subtree.
- Hidden files are excluded unless the **Hidden** switch is on.
- If the search index was built against an old local database, restart the explorer; the
  search index signature includes the local database.
- Results are capped at 400. Broaden the query if the response is truncated.

## Port already in use

```text
OSError: [Errno 48] Address already in use
```

Choose another port:

```bash
bun run app/src/server/index.ts --port 9000 --open
```

Find and stop the old process if needed:

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

## “Address already in use” from a previous run

The server stops on `Ctrl+C`. If a process is orphaned, kill it by PID from `lsof`, then
restart.

## Too many missing files

This is the most common interpretation problem. Confirm whether the paths fall under
dependency or build folders that the indexer skips:

```bash
grep -E '/(node_modules|\.next|dist|build|target|vendor|__pycache__)/' \
  report/missing.csv | wc -l
```

Compare that with the total:

```bash
wc -l report/missing.csv
```

In the reference run, 98% of missing files were expected exclusions. The
[matching model](/concepts/matching#the-dependency-folder-caveat) explains this in detail.

Also remember that “missing” means absent from the **index snapshot**, not necessarily
absent from the live disk.

## Google Drive shows zero exact matches

Expected in many setups. Drive paths are relative to the Drive root (or chosen subfolder),
while the local index is rooted at `/mnt/tank`. If the structures do not mirror each other,
files match by name and size instead of exact path. Check `moved.csv` and the explorer's
moved/possible badges rather than assuming the comparison failed.

Scoping the snapshot with `GDRIVE_PATH=Backup` can make the path structures align better.

## The Modified column is empty on Jottacloud

Jottacloud's listing does not provide reliable modification times. The explorer shows `—`
for that column. Google Drive snapshots include times when rclone provides them.

## The HTML report is huge or slow

`report.html` embeds sample issue data plus inline CSS/JS. The full dataset remains in
`report_data.json` and the CSVs. For very large archives, use the CSVs or JSON for analysis
and open the HTML only for a visual overview.

## Memory use is high during comparison

The comparator builds in-memory lookup maps for the entire local index. Memory grows with
the number of entries. This is intentional: it makes a full multi-million-row comparison
fast. Close other memory-heavy processes or run the comparison on a machine with sufficient
RAM.

## Paths outside `/mnt/tank`

Paths outside the base are normalized and kept rather than dropped. They usually will not
match cloud-relative paths. If your index uses a different root, update the `BASE` constant
consistently in `scripts/compare.py`, `app/src/server/paths.ts`, and
`app/src/server/cache.ts`.

## Exposing the explorer on a network

`--host 0.0.0.0` works, but there is **no authentication**. Anyone who can reach the port can
browse the index and cloud snapshot. Use a firewall, a trusted network, or a reverse proxy
with access control. The default loopback binding is the safe choice.

## The comparison is correct but the explorer shows different numbers

The explorer reads `summary.json` for headline numbers and the cache for listings. A stale
cache can disagree with a freshly written report. Restart the server or force
`--rebuild`.

## Documentation build fails

This site is a Docusaurus app under `docs/`. Install dependencies and build locally:

```bash
cd docs
npm ci
npm run build
```

For deployment-specific problems, see
[Deploying the site](/contributing/deploying-the-site).

## Still stuck

Include the following when asking for help:

- the command you ran
- the full terminal output, including the provider readiness lines
- `python3 --version` and `rclone version`
- the relevant `summary.json`
- whether the issue is comparison data or explorer behavior
