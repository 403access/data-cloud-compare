# Tank ⇄ cloud explorer (Bun + React + TypeScript)

The two-pane, virtual filesystem explorer for the comparison data in this
repository. It is written entirely in TypeScript: a Bun HTTP server, a
`bun:sqlite` backend, and a React 19 client.

| Pane | Source | What it shows |
|---|---|---|
| Left | `file_indexer.db` | the indexed `/mnt/tank` snapshot |
| Right | a provider snapshot | Jottacloud `archive.json` or Google Drive `google_drive.json` |

The HTTP API, cache schema, status model, keyboard shortcuts and CSS are kept
compatible with the original explorer. Reference screenshots from that
implementation live in `../tools/screenshots/reference/`.

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

On macOS you can also double-click [`../run.command`](../run.command), which builds and
starts the explorer.

Useful flags:

```bash
bun run src/server/index.ts --port 9000        # different port
bun run src/server/index.ts --host 0.0.0.0     # expose on the LAN
bun run src/server/index.ts --rebuild          # rebuild all provider caches
```

The first start builds the provider caches, folder-size indexes and compact
search indexes in `app/.cache/` (git-ignored). Later starts reuse them. Add
`--rebuild` after regenerating a snapshot, report or the local index.

## Static demo

The public site ships the same client at `/demo/` with no server behind it. The
marketing site links there, and `scripts/assemble-site.ts` builds it during the
Pages deployment:

```bash
npm run build     # docs + assemble dist/, including dist/demo/
npm run preview   # http://localhost:4173/demo/
```

`scripts/build-demo.ts` generates a deterministic synthetic dataset covering
both providers and every verdict. The demo `index.html` sets
`window.__DCA_DEMO__`, and `src/web/lib/demo.ts` answers the four `/api/*`
requests from that dataset. No SQLite, archive, or index file is involved.

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
    search-index.ts   compact name index (TJSI2 format)
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
    lib/              API client, demo dataset adapter, formatting, icons
  src/shared/
    entry.ts          pure path/status/sorting helpers shared with the server
  public/
    index.html        static document shell (theme bootstrap + CSS links)
    style.css/css/    stylesheet, preserved from the original explorer
    js/               generated bundle (git-ignored)
  .cache/             generated SQLite and search indexes (git-ignored)
```

The server binds to `127.0.0.1` by default, opens SQLite databases read-only and
never writes to either source.

## Rendering comparison

The app is compared against checked-in reference screenshots of every important
UI state:

```bash
bun run screenshots            # capture + diff + report
bun run screenshots:after      # capture the app only
bun run screenshots:compare    # diff existing captures
bun run screenshots:reference  # materialize the reference images
```

The harness starts the app server when needed, freezes animations, and writes
`screenshots/{baseline,after,diff}/<state>.png` plus `screenshots/report.json`
and `screenshots/report.md`. Scenario names follow the UI state
(`default-light`, `water`, `command-search`, `analytics-panel`,
`google-drive`, `mobile`, …).

## Notes

- The water palette and interactions are distilled into the shared
  [`../design-system/`](../design-system/) package, with a live component gallery.
- The keyboard button in the header opens the **Keyboard shortcuts** window.
  Its key map lives in `src/web/lib/shortcuts.ts`; rebinding is stored in
  `localStorage` under `explorer-shortcuts`. The command palette, cheat-sheet,
  close-window, and close-overlay bindings drive the real shell shortcuts, while
  the remaining entries document the wider window-manager map.
- Caches live under `app/.cache/` and stay compatible with the original schema
  and signatures.
- The UI intentionally uses the original stylesheet unchanged so every visual
  detail (light/dark/water themes, responsive layout, motion) matches.
- Jottacloud listings have no modification times, so that column shows `—` on
  that side. Google Drive snapshots include them when rclone provides them.
