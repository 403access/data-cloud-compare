---
title: Explorer
sidebar_position: 4
description: Navigate the virtual two-pane explorer, search millions of names, filter by status, and reveal counterparts.
---

# Explorer

The explorer is a Finder-style, two-pane view of a comparison. It is **virtual**: neither
pane touches a live filesystem. The left pane is the local index; the right pane is the
selected provider snapshot.

## Start the server

```bash
python3 explorer/server.py --open
```

Then open [http://127.0.0.1:8787/](http://127.0.0.1:8787/) if the browser did not open automatically.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--host` | `127.0.0.1` | Bind address. |
| `--port` | `8787` | HTTP port. |
| `--open` | off | Open the default browser after startup. |
| `--rebuild` | off | Force all provider caches to rebuild. |

The server exits if `file_indexer.db` is missing. Providers whose snapshot or report is
missing are marked unavailable; the others keep working.

## First start and caches

The first start builds a cache per available provider (roughly 30 seconds each on a large
index) and a compact search index (roughly 20 seconds each). Later starts are instant.

Caches live in `explorer/.cache/` and are git-ignored:

```text
explorer/.cache/
  explorer-<provider>.db
  search-<provider>.index
  search-<provider>.index.json
```

The cache notices changes to the snapshot, `report_data.json`, `local_only.csv`, and the
local index. If you change inputs and want to be certain, restart with `--rebuild` or delete
the provider's cache files.

## Layout

| Pane | Source | What it shows |
| --- | --- | --- |
| Left | `file_indexer.db` | The indexed `/mnt/tank` snapshot. |
| Right | `archive.json` or `google_drive.json` | The selected cloud snapshot. |

Both pane headers carry small **Snapshot** and **Read-only** indicators. The **i** button in
each header opens a source panel with the snapshot file, date, size, comparison dates, and the
full "not a live mount" / "virtual read-only view" description.

Use the segmented **Jottacloud** / **Google Drive** switch in the top bar to choose the
provider. The right pane tries to stay in the same folder; if that folder does not exist on
the other provider it starts at the root. The left pane stays put, but its badges are
recalculated for the new provider.

## Navigation

| Action | Control |
| --- | --- |
| Open a folder | Double-click, or select and press `Enter`. |
| Go up | `Backspace`, or the **Up** toolbar button. |
| Move selection | `←` / `→`. |
| Back / forward | Toolbar buttons. |
| Jump to a breadcrumb | Click any segment. |
| Align both panes | **⇄ Same path** moves the *other* pane to the current folder. |
| Reveal counterpart | Select a file and press `Enter`, or use the bottom bar. |

Reveal jumps the other pane to the matching item: the other path for a moved file, the same
path for an exact match. `Partial` folders jump to the same path; `Missing` and `Local only`
items have no counterpart.

## Search

Type in a pane's search field. Searches need at least **two characters**.

- The default scope searches the whole snapshot.
- Switch the dropdown to **This folder** to search only the current subtree.
- `Cmd/Ctrl+F` focuses the active pane's search.
- `Esc` clears it.

Search is backed by a compact name index, so substring queries stay fast even across
millions of entries. Results are capped at 400 per query; the response reports whether it
was truncated.

## Command bar

Press `Cmd/Ctrl+K`, or click **Search** in the top bar, to open the command bar.

- Typing searches files and folders in **both panes at once** and, in the same list, fuzzy
  matches shortcuts for navigation, status filters, sorting, column visibility, themes,
  water settings, and provider switching.
- Start a query with `>` to search commands only.
- Use `↑` / `↓` to move, `Enter` to open a result or run a command, and `Esc` to close.
- For a file result, opening it jumps that pane to the file's folder and selects it. For a
  folder result, opening it navigates into the folder.
- Commands show a check mark when their setting is already active.

## Filter by status

Use the **Filter** button next to the search scope to tick any number of statuses. The
choices match the pane:

- Provider side: `Same`, `Moved`, `Maybe`, `Partial`, `Missing`.
- Local side: `In Jottacloud` / `In Google Drive`, `Moved match`, `Local only`,
  `Not in …`, `Type differs`.

Clicking a status chip in the bottom margin toggles that status in the filter. **Clear all**
in the menu resets it. Filtering applies to the current folder and to search results, and
stays active while you navigate.

## Details and columns

Right-click a file or folder to open its details sidebar: path, type, size or item count,
modified date, match status, comparison notes, and actions to open the folder or reveal the
counterpart.

Click `Name`, `Type`, `Status`, `Size`, or `Modified` to sort. Right-click a table header (or
empty table space) to open the column sidebar and choose which columns are shown. The choice
is remembered and applies to both panes.

Sizes are byte sizes for files and direct item counts for folders. Jottacloud's listing has
no modification times, so that column shows `—` on that side. Google Drive snapshots include
modification times when rclone provides them.

## Hidden files and theme

- The **Hidden** switch shows dotfiles. It is off by default, like Finder.
- The sun/moon button switches light and dark theme.
- Add `?theme=light` or `?theme=dark` to the URL to force one.

## Provider behavior

When switching providers, the right pane attempts to preserve the current folder path. The
left pane's badges update to reflect the selected provider, because a file can be in
Jottacloud but not in Google Drive.

## HTTP API

The UI is backed by a small JSON API. All endpoints are GET requests.

| Endpoint | Parameters | Returns |
| --- | --- | --- |
| `/api/providers` | none | Provider list, availability, summaries, sources. |
| `/api/meta` | `provider` | Provider metadata and summary. |
| `/api/list` | `provider`, `side` (`local`/`remote`), `path`, `sort`, `dir`, `hidden` | Directory listing. |
| `/api/search` | `provider`, `side`, `q`, `scope` (`all`/`folder`), `path`, `hidden` | Search results. |

`sort` accepts `name`, `type`, `size`, `modified`, or `status`; `dir` accepts `asc` or
`desc`. Unknown providers or sides return an error. The server also serves the static files
in `explorer/web/`.

## Security model

- The default bind address is loopback only.
- SQLite is opened read-only (`mode=ro`, `query_only`).
- Static file resolution rejects paths outside `explorer/web/`.
- API paths are normalized and reject `..` traversal.
- There is **no authentication**. If you use `--host 0.0.0.0`, anyone who can reach the
  port can browse the index and snapshots. Use it only on a trusted network.

## Troubleshooting

See [Troubleshooting](/help/troubleshooting) for slow first starts, port conflicts, stale
caches, and unavailable providers.
