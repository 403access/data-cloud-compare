# Data Cloud Compare

Local-first verification for cloud archives. Compare an rclone JSON listing against a
SQLite file index, find what is missing, moved, or possible, and browse both sides in a
virtual two-pane explorer.

The repository also contains the product's public sites:

- **Marketing site:** [`marketing/`](marketing/) — static HTML/CSS with TypeScript interactions.
- **Documentation:** [`docs/`](docs/) — Docusaurus, deployed under `/docs/`.
- **Design system:** [`design-system/`](design-system/) — the water theme's tokens,
  components, effects, and an interactive component gallery at `/design-system/`.

All three are assembled into one GitHub Pages artifact by
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

Requirements: Bun 1.3+, rclone, an index database, and a provider snapshot.

```bash
# Snapshot the cloud listing
rclone lsjson jotta:Archive -R > archive.json

# Compare with the local index
bun scripts/compare.ts \
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
| Design system | `design-system/` | `npm run preview` (after a build) |

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
`baseUrl`, copies the marketing site to the artifact root, copies the design system to
`/design-system/`, and deploys the docs under `/docs/`.

## Repository layout

```text
scripts/compare.ts               comparison engine + report writer
scripts/fetch_google_drive.sh    Google Drive snapshot + comparison
scripts/assemble-site.ts         combined Pages artifact builder
app/                             virtual two-pane explorer (Bun + React + TypeScript)
run.command                      macOS double-click launcher
tools/screenshots/               reference screenshots + comparison harness
report/                          generated comparison outputs (git-ignored by default)
marketing/                       static marketing site (water theme)
docs/                            Docusaurus documentation site
design-system/                   shared water tokens, components, and gallery
```

## Notes

- Generated snapshots (`archive.json`, `google_drive.json`), the index database, reports,
  explorer caches, and screenshot captures are git-ignored. The reference run is summarised in
  [`report/SUMMARY.md`](report/SUMMARY.md); treat your own data as private.
- The reference comparison was performed against an index snapshot dated 2026-08-25.
- "Missing" means absent from the index after all matching passes, not proof of deletion.
  See [What "missing" means](docs/docs/concepts/matching.md#what-missing-means).
- Everything runs on Bun: the comparator (`scripts/compare.ts`), snapshot helpers, and the
  explorer (`app/`, Bun + React + TypeScript). `bun run screenshots` captures the app and
  compares it with the checked-in reference images; see [app/README.md](app/README.md).
