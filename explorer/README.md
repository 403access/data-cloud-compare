# Tank ⇄ cloud explorer

A Finder-style, two-pane explorer for the comparison data in this repository.
It is **virtual**: neither pane touches a live filesystem.

| Pane | Source | What it shows |
|---|---|---|
| Left | `file_indexer.db` | the indexed `/mnt/tank` snapshot |
| Right | a provider snapshot | Jottacloud `archive.json` or Google Drive `google_drive.json` |

Use the segmented switch in the top bar to choose which cloud the right pane
compares against. The left pane is the same local index in both cases; its
badges update to reflect the selected provider.

Every row is annotated with the result of `scripts/compare.py`:
`Same`, `Moved`, `Maybe`, `Partial`, `Missing`, and on the local side
`In Jottacloud` / `In Google Drive`, `Moved match`, `Local only`,
`Not in Jottacloud` / `Not in Google Drive`, `Type differs`.
The margin at the bottom of each pane summarises the visible statuses.

## Start

```bash
python3 explorer/server.py --open
```

Then open <http://127.0.0.1:8787/> if the browser did not open by itself.

On macOS you can also double-click `explorer/run.command`.

The first start builds a cache per available provider (about 30s each) and a
compact search index (about 20s each). Later starts are instant. The generated
files live in `explorer/.cache/` and are git-ignored.

Useful flags:

```bash
python3 explorer/server.py --port 9000        # different port
python3 explorer/server.py --host 0.0.0.0    # expose on the LAN
python3 explorer/server.py --rebuild         # rebuild all provider caches
```

If a comparison's inputs change, its cache detects it automatically from the
snapshot, `report_data.json`, `local_only.csv` and the local index. Force a
rebuild with `--rebuild` (or delete the provider's cache in `explorer/.cache`).

## Google Drive

Google Drive uses an rclone remote named `gdrive`:

```bash
rclone config                 # create a Google Drive remote called "gdrive"
scripts/fetch_google_drive.sh # list the drive, then compare with the local DB
python3 explorer/server.py --open
```

The script writes `google_drive.json` and `report/google_drive/`, then the
explorer shows a **Google Drive** button in the top bar. If the remote has a
different name:

```bash
GDRIVE_REMOTE=my-drive scripts/fetch_google_drive.sh
```

Optional: list a subfolder instead of the whole drive, or use a non-default
rclone config:

```bash
GDRIVE_PATH=Backup \
RCLONE_CONFIG=/path/to/rclone.conf \
  scripts/fetch_google_drive.sh
```

Set `SKIP_COMPARE=1` to only refresh the snapshot. Re-run the script whenever
you want a fresh Google Drive comparison.

If Google Drive has not been fetched yet, its button is dimmed and the tooltip
explains what to run. Jottacloud keeps working independently.

## Using it

- **Switch provider**: use the `Jottacloud` / `Google Drive` switch in the top
  bar. The right pane tries to stay in the same folder; if that folder does not
  exist in the other provider it starts at the root. The left pane stays put but
  its status badges are recalculated.
- **Open a folder**: double-click it, or select it and press `Enter`.
- **Navigate**: `Backspace` goes up; `←` / `→` move selection; toolbar
  buttons provide Back, Forward and Up.
- **Breadcrumbs**: click any segment to jump.
- **Same path**: the `⇄ Same path` button moves the *other* pane to the folder
  currently shown, so both sides line up.
- **Search**: type in a pane's search field. By default it searches
  everywhere; switch the dropdown to `This folder` to search only the current
  subtree. `Cmd/Ctrl+F` focuses the active pane's search. `Esc` clears it.
- **Filter by status**: use the `Filter` button next to the search scope to tick
  any number of statuses (`Same`, `Missing`, `Partial`, etc.). The choices match
  the pane: the local side offers `In Jottacloud`, `Local only`, `Type differs`,
  and so on. Clicking a status chip in the bottom margin toggles that status in
  the filter; `Clear all` in the menu resets it. Filtering applies to the current
  folder and to search results, and stays active while you navigate.
- **Reveal counterpart**: select a row and press `Enter` on a file, or use the
  bottom bar. It jumps the other pane to the matching item — the other path
  for a moved file, the same path for an exact match. `Partial` folders jump to
  the same path; `Missing`/`Local only` items have no counterpart.
- **Columns**: click `Name`, `Status`, `Size` or `Modified` to sort.
- **Hidden files**: the `Hidden` switch shows dotfiles (off by default, like
  Finder).
- **Theme**: the sun/moon button switches light/dark. Add `?theme=light` or
  `?theme=dark` to the URL to force one.

Lists are virtualised, so folders with tens of thousands of entries stay
responsive. Sizes are byte sizes for files and direct item counts for folders.
Jottacloud's listing has no modification times, so that column shows `—` on
that side. Google Drive snapshots include modification times when rclone
provides them.

## Status meanings

Provider side (the right pane):

| Badge | Meaning |
|---|---|
| `Same` | Same path exists in the local index. |
| `Moved` | Same basename + size found elsewhere in the local index. |
| `Maybe` | Same basename locally, but the size differs. |
| `Partial` | Folder has a mix of present and missing children. |
| `Missing` | Not found by path, name or name+size. |

Local side (the left pane):

| Badge | Meaning |
|---|---|
| `In Jottacloud` / `In Google Drive` | Same path exists in the selected provider. |
| `Moved match` | This is the local match for a provider item marked moved. |
| `Local only` | Present in the index, not found anywhere in the provider. |
| `Not in Jottacloud` / `Not in Google Drive` | No same-path counterpart (it may still have matched elsewhere). |
| `Type differs` | Same name, but file vs. folder differs. |

The exact filtering caveats (ignored `node_modules`, `.next`, etc.) are
documented in `report/SUMMARY.md`. This explorer does not re-run the
comparison; it visualises the selected provider's report results.

## Layout

```
explorer/
  server.py          HTTP server + JSON API (stdlib only)
  providers.py       provider definitions (Jottacloud, Google Drive)
  cache.py           builds explorer/.cache/explorer*.db per provider
  search_index.py    compact name index for fast substring search
  web/
    index.html       two-pane shell + provider switch
    style.css        Finder-like light/dark theme
    app.js           virtual list, navigation, search, reveal, provider switch
  run.command        macOS double-click launcher
scripts/
  compare.py         snapshot vs local DB comparison + report
  fetch_google_drive.sh
                     rclone Google Drive snapshot + comparison
```

No Python packages are required; only the standard library, `file_indexer.db`,
and at least one provider snapshot in the repository root.
