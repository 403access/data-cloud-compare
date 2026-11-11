---
title: Architecture
sidebar_position: 3
description: Repository layout, data flow, caching, performance choices, and the provider abstraction.
---

# Architecture

The comparator is a small Python standard-library script. The explorer is a Bun + React +
TypeScript app with a `bun:sqlite` backend. There is no external service, no database
migration, and no write path into the user's archive. The original Python explorer remains
in `explorer/` as the rendering reference for `bun run screenshots`.

## Repository layout

```text
.
├── scripts/
│   ├── compare.py              comparison engine + report writer
│   ├── fetch_google_drive.sh   snapshot Drive, then compare
│   └── assemble-site.mjs       combined Pages artifact builder
├── app/
│   ├── src/server/             Bun HTTP server, caches, listings and JSON API
│   │   ├── index.ts            CLI entry + HTTP server
│   │   ├── providers.ts        provider definitions
│   │   ├── cache.ts            per-provider SQLite tree/status cache
│   │   ├── search-index.ts     compact name index
│   │   ├── listings.ts         local/remote listings and search
│   │   ├── api.ts              JSON API payloads
│   │   └── paths.ts            shared constants and runtime state
│   ├── src/web/                React + TypeScript client
│   │   ├── App.tsx             application shell and shared state
│   │   ├── components/         app bar, panes, command bar, status bar
│   │   ├── hooks/usePane.ts    pane state, navigation, search and filters
│   │   ├── panels/             columns, theme, detail, source, analytics
│   │   └── lib/                API client, formatting, icons, water effects
│   ├── public/                 HTML shell and styles (generated JS in public/js/)
│   └── .cache/                 generated SQLite and search indexes
├── explorer/                   legacy Python explorer + macOS launcher
├── tools/screenshots/          baseline/after rendering comparison
├── report/                     Jottacloud outputs
├── report/google_drive/        Google Drive outputs
├── marketing/                  static marketing site
├── docs/                       this Docusaurus site
└── .github/workflows/          GitHub Pages deployment
```

## Data flow

```text
rclone lsjson -R
        │
        ▼
provider snapshot (JSON) ───────────────┐
                                        │
file_indexer.db (SQLite) ───────────────┤
                                        ▼
                              scripts/compare.py
                                        │
              ┌─────────────────────────┼──────────────────────┐
              ▼                         ▼                      ▼
        report.html              missing/moved CSV      summary/report_data JSON
              │                         │                      │
              └─────────────────────────┴──────────┬───────────┘
                                                   ▼
                                         app/src/server/cache.ts
                                         (per-provider SQLite)
                                                   │
                                                   ▼
                                         app/src/server/index.ts
                                         (Bun HTTP + JSON API)
                                                   │
                                                   ▼
                                            app/src/web/
                                            (React client)
```

The comparison is a batch step. The explorer is a read-only visualization of its outputs
plus the local index.

## Comparison engine

`scripts/compare.py`:

1. Loads the snapshot, normalizes paths, and synthesizes missing parent folders.
2. Loads the local index into in-memory lookup maps:
   - exact paths
   - lowercase paths
   - `(basename, size)` → paths
   - `basename` → entries
   - lowercase folder name → folders
3. Classifies files through the four-pass cascade.
4. Classifies folders directly, then bottom-up from children.
5. Aggregates summary buckets and top-level folder stats.
6. Writes CSV files, `summary.json`, and `report_data.json` (streamed).
7. Writes a self-contained `report.html` with a bounded sample of issues.

The in-memory maps make a full comparison fast, at the cost of memory proportional to the
index size. Streaming the issue list into `report_data.json` avoids building a second
million-row structure.

## Explorer cache

Caches live in `app/.cache/` and are keyed by provider. Each cache is a SQLite database
with:

| Table | Purpose |
| --- | --- |
| `archive` | Normalized cloud tree (`path`, `parent`, `name`, `is_dir`, `size`). |
| `status` | Status per issue path, plus `found_at` and note. |
| `folder` | Folder rollups and child counts. |
| `moved_db` | Reverse lookup from local path to the cloud item that moved. |
| `local_only` | Local index entries with no provider counterpart. |
| `meta` | Schema version and input signature. |

The cache signature covers the snapshot, `report_data.json`, and `local_only.csv`. If any
changes, the cache rebuilds. `--rebuild` forces it.

The local pane is served from `file_indexer.db` through a read-only connection; it is not
copied into the cache.

## Search index

`app/src/server/search-index.ts` builds a compact name index per provider, combining the cloud
snapshot and local index. It stores paths and names in a form optimized for case-insensitive
substring search, with a sidecar metadata file. The index signature includes the cache
signature and the local database's size and modification time.

Queries shorter than two characters return no results. Results are capped at 400 per query
and include a `truncated` flag.

## HTTP server

`app/src/server/index.ts` uses Bun's built-in `Bun.serve` and `bun:sqlite`; it needs no
web framework.

| Route | Behavior |
| --- | --- |
| `/` | Serves `app/public/index.html`. |
| `/api/providers` | Provider list, readiness, summaries, source files. |
| `/api/meta` | Metadata for one provider. |
| `/api/list` | Directory listing for `local` or `remote`. |
| `/api/search` | Substring search, whole snapshot or current folder. |
| Other paths | Static files under `app/public/`, with traversal protection. |

Readiness is checked at startup. Missing snapshots or reports mark a provider unavailable
with a human-readable reason; other providers continue to work.

## Provider abstraction

A provider is a plain object in `app/src/server/providers.ts`:

| Field | Purpose |
| --- | --- |
| `key` | Stable identifier used by the API and cache filenames. |
| `label` | Display name. |
| `archiveJson` | Snapshot path. |
| `reportDir` | Directory containing the comparison outputs. |
| `rcloneRemote` | Remote name used in help text and scripts. |
| `rootLabel` | Display root (for example `Archive` or `My Drive`). |
| `subtitle` | Source description shown in the UI. |
| `accent` | UI accent color. |
| `help` | Command shown when the provider is unavailable. |

The server resolves `report_data.json`, `local_only.csv`, and `summary.json` inside the
report directory. See [Adding a provider](/contributing/adding-a-provider).

## Security and privacy

- The server binds to `127.0.0.1` by default.
- SQLite is opened read-only with `PRAGMA query_only`.
- API paths reject `..` traversal and null bytes.
- Static files are resolved under `app/public/` and rejected if they escape it.
- There is no authentication. Exposing the server with `--host 0.0.0.0` is an explicit
  choice on a trusted network.
- No telemetry, no external asset requests, and no upload path exist in the tooling.

## Rendering comparison

`bun run screenshots` starts the legacy Python explorer and this app, captures the same UI
states in Chromium, and writes pixel diffs and a pass/fail report under `screenshots/`.
Animations are frozen and the water canvas is hidden so the comparison is deterministic.
See [app/README.md](https://github.com/403access/data-cloud-compare/blob/main/app/README.md)
for details.

## Deployment

The marketing site and these docs are static builds assembled into one GitHub Pages
artifact. The workflow builds Docusaurus with a base URL derived from the Pages
configuration, copies it under `docs/`, and places the marketing files at the root. See
[Deploying the site](/contributing/deploying-the-site).
