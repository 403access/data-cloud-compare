# Data Cloud Compare

Local-first verification for cloud archives. Compare an rclone JSON listing against a
SQLite file index, find what is missing, moved, or possible, and browse both sides in a
virtual two-pane explorer.

The repository also contains the product's public sites:

- **Marketing site:** [`marketing/`](marketing/) — static, no build step.
- **Documentation:** [`docs/`](docs/) — Docusaurus, deployed under `/docs/`.

Both are assembled into one GitHub Pages artifact by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## What it does

- Compares a full cloud listing with `file_indexer.db`.
- Matches exact paths, case-insensitive paths, moved files (name + size), and possible
  matches (name only).
- Rolls folder status up from children instead of guessing.
- Writes a self-contained HTML report, CSV exports, and a JSON dataset.
- Serves a read-only, virtual Finder-style explorer over the results.
- Ships provider definitions for Jottacloud and Google Drive.

Nothing is uploaded, moved, or deleted. The explorer binds to `127.0.0.1` and opens SQLite
read-only.

## Quickstart

Requirements: Bun 1.3+, Python 3.10+ (comparison scripts only), rclone, an index
database, and a provider snapshot.

```bash
# Snapshot the cloud listing
rclone lsjson jotta:Archive -R > archive.json

# Compare with the local index
python3 scripts/compare.py \
  --db file_indexer.db \
  --archive archive.json \
  --out report

# Browse the virtual explorer (Bun + React)
bun install --cwd app
bun run --cwd app start --open
```

Google Drive:

```bash
rclone config                 # create a remote named "gdrive"
scripts/fetch_google_drive.sh
bun run --cwd app start --open
```

See the [documentation](docs/docs/intro.md) for the matching model, explorer guide, reports,
provider setup, and troubleshooting.

## Sites

| Site | Source | Local command |
| --- | --- | --- |
| Marketing | `marketing/` | `npm run build && npm run preview` |
| Docs | `docs/docs/` | `npm run dev:docs` |

Build the combined Pages artifact:

```bash
npm --prefix docs ci
npm run build
npm run preview   # http://localhost:4173/
```

## Deploying

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` or run the **Deploy site** workflow manually.

The workflow derives the Pages origin and base path, builds Docusaurus with the correct
`baseUrl`, copies the marketing site to the artifact root, and deploys the docs under
`/docs/`.

## Repository layout

```text
scripts/compare.py               comparison engine + report writer
scripts/fetch_google_drive.sh    Google Drive snapshot + comparison
scripts/assemble-site.mjs        combined Pages artifact builder
app/                             virtual two-pane explorer (Bun + React + TypeScript)
explorer/                        original Python explorer, kept as the rendering reference
tools/screenshots/               baseline/after screenshot harness
report/                          generated comparison outputs (git-ignored by default)
marketing/                       static marketing site
docs/                            Docusaurus documentation site
```

## Notes

- Generated snapshots (`archive.json`, `google_drive.json`), the index database, reports,
  explorer caches, and screenshot captures are git-ignored. The reference run is summarised in
  [`report/SUMMARY.md`](report/SUMMARY.md); treat your own data as private.
- The reference comparison was performed against an index snapshot dated 2026-08-25.
- "Missing" means absent from the index after all matching passes, not proof of deletion.
  See [What "missing" means](docs/docs/concepts/matching.md#what-missing-means).
- The explorer is now `app/` (Bun + React + TypeScript). `bun run screenshots` renders
  both implementations and compares them pixel by pixel; see [app/README.md](app/README.md).
