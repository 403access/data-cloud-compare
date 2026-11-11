# Tank ⇄ cloud explorer (Bun + React + TypeScript)

The two-pane, virtual filesystem explorer for the comparison data in this
repository. It is a full TypeScript rewrite of the original Python explorer in
[`../explorer/`](../explorer/), which is kept as the rendering reference for the
screenshot harness.

| Pane | Source | What it shows |
|---|---|---|
| Left | `file_indexer.db` | the indexed `/mnt/tank` snapshot |
| Right | a provider snapshot | Jottacloud `archive.json` or Google Drive `google_drive.json` |

The HTTP API, cache schema, status model, keyboard shortcuts and CSS are the same
as the legacy explorer. The UI is React 19; the server is Bun with `bun:sqlite`.

## Start

From the repository root:

```bash
bun install                       # screenshot/dev tooling
bun install --cwd app             # React app dependencies
bun run --cwd app start --open    # builds the client, then serves :8787
```

Or from this directory:

```bash
bun install
bun run dev        # build + start
```

On macOS you can also double-click [`../explorer/run.command`](../explorer/run.command),
which starts the current server entry point.

Useful flags:

```bash
bun run src/server/index.ts --port 9000        # different port
bun run src/server/index.ts --host 0.0.0.0     # expose on the LAN
bun run src/server/index.ts --rebuild          # rebuild all provider caches
```

The first start builds the provider caches, folder-size indexes and compact
search indexes in `app/.cache/` (git-ignored). Later starts reuse them. Add
`--rebuild` after regenerating a snapshot, report or the local index.

## Google Drive

Google Drive uses the versioned snapshots written by
`scripts/fetch_google_drive.sh`. The explorer resolves `snapshots/google_drive/LATEST`
automatically. Set `GDRIVE_SNAPSHOTS` to use a different snapshot root.

## Architecture

```text
app/
  src/server/
    index.ts          Bun HTTP server + CLI
    providers.ts      provider catalog and snapshot resolution
    cache.ts          SQLite cache builder and folder-size indexes
    search-index.ts   compact name index (same TJSI2 format as the legacy app)
    model.ts          path/matching/formatting helpers
    listings.ts       local/remote listings and search
    api.ts            JSON API payloads
    paths.ts          repository paths and constants
    state.ts          runtime provider/search state
  src/web/
    main.tsx          React entry point
    App.tsx           application shell and shared state
    components/       app bar, panes, command bar, status bar
    hooks/usePane.ts  pane state, navigation, search and filters
    panels/           columns, theme, detail, source, analytics sidebars
    lib/              API client, formatting, icons, water effects
  public/
    index.html        static document shell (theme bootstrap + CSS links)
    style.css/css/    stylesheet, unchanged from the legacy explorer
    js/               generated bundle (git-ignored)
  .cache/             generated SQLite and search indexes (git-ignored)
```

The server binds to `127.0.0.1` by default, opens SQLite databases read-only and
never writes to either source.

## Rendering comparison

Pixel screenshots of every important UI state are captured from both the legacy
Python explorer and this app, then compared:

```bash
bun run screenshots            # capture both + diff + report
bun run screenshots:baseline   # legacy Python app only
bun run screenshots:after      # Bun + React app only
bun run screenshots:compare    # diff existing captures
```

The harness starts each server when needed, freezes animations, and writes
`screenshots/{baseline,after,diff}/<state>.png` plus
`screenshots/report.json` and `screenshots/report.md`. Scenario names follow the
UI state (`default-light`, `water`, `command-search`, `analytics-panel`,
`google-drive`, `mobile`, …).

## Notes

- Caches are shared conceptually with the legacy explorer, but live under
  `app/.cache/`; both use the same schema and signatures.
- The UI intentionally uses the legacy stylesheet unchanged so every visual
  detail (light/dark/water themes, responsive layout, motion) matches.
- Jottacloud listings have no modification times, so that column shows `—` on
  that side. Google Drive snapshots include them when rclone provides them.
