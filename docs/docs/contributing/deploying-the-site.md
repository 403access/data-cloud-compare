---
title: Deploying the site
sidebar_position: 2
description: How the marketing site and these docs are built and deployed together with GitHub Actions and GitHub Pages.
---

# Deploying the site

The marketing site and the documentation are two static sites deployed together as **one
GitHub Pages artifact**:

| Path | Source | Served at |
| --- | --- | --- |
| `/` | `marketing/` | The marketing landing page. |
| `/docs/` | `docs/` (Docusaurus build) | This documentation. |

For a project repository named `data-cloud-compare` under the `403access` account, the
deployed URLs are:

- Marketing: `https://403access.github.io/data-cloud-compare/`
- Docs: `https://403access.github.io/data-cloud-compare/docs/`

For a `<user>.github.io` repository or a custom domain, the repository segment disappears
and the docs stay at `/docs/`.

## Workflow

The deployment is defined in `.github/workflows/pages.yml`. It runs on pushes to `main` that
touch `marketing/`, `docs/`, the assembly script, the workflow itself, or the root
`package.json`. It can also be started manually with **Run workflow**.

Steps:

1. Check out the repository.
2. Set up Node 22 and restore the npm cache for `docs/package-lock.json`.
3. Set up Bun for the TypeScript assembly step.
4. Run `actions/configure-pages@v5` to discover the Pages origin and base path.
5. Derive `SITE_URL`, `DOCS_BASE_URL`, and `MARKETING_URL` from those outputs.
6. Install docs dependencies with `npm ci`.
7. Build Docusaurus with the derived base URL.
8. Assemble `dist/`: copy the marketing files, compile `marketing/main.ts` to
   `dist/main.js`, and copy `docs/build/` to `dist/docs/`.
9. Upload the Pages artifact and deploy it.

The assembly script also writes `.nojekyll` so Pages serves the files directly.

### URL derivation

A project site is served under `/<repository>/`, while a user or organization site is
served at the root. The workflow normalizes
`actions/configure-pages`'s `base_path` and builds:

```text
DOCS_BASE_URL   = ${BASE_PATH}/docs/     e.g. /data-cloud-compare/docs/
MARKETING_URL   = ${BASE_PATH}/          e.g. /data-cloud-compare/
SITE_URL        = configure-pages origin e.g. https://403access.github.io
```

Docusaurus is configured with `trailingSlash: true`, so documentation URLs end in `/` and
resolve predictably on Pages.

## One-time Pages setup

GitHub Pages must be enabled for the repository before the first deployment. In the GitHub
UI:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow manually.

With the GitHub CLI and appropriate permissions:

```bash
gh api -X POST repos/403access/data-cloud-compare/pages \
  -f build_type=workflow
```

If Pages is already enabled, use `PUT` instead of `POST`, or update the setting in the UI.

:::note
The workflow's `configure-pages` step does not silently enable Pages on every repository.
If the deploy job fails before building, confirm the Pages source is set to **GitHub
Actions**.
:::

## Build locally

Install docs dependencies once:

```bash
npm --prefix docs ci
```

Build both sites and assemble the same artifact the workflow uses:

```bash
npm run build
```

The default `DOCS_BASE_URL` is `/docs/`, so this works without any environment variables.
Preview the assembled site:

```bash
npm run preview
```

Then open [http://localhost:4173/](http://localhost:4173/). The marketing site is at `/` and the docs at `/docs/`.
This is the closest local approximation of the deployed layout.

For documentation-only development with hot reload:

```bash
npm run dev:docs
```

Docusaurus serves at [http://localhost:3000/docs/](http://localhost:3000/docs/). Marketing pages are not part of that dev
server; use the full build to preview the combined site.

## Custom domains

1. Add the domain in **Settings → Pages → Custom domain** and configure DNS as GitHub
   documents.
2. `actions/configure-pages` will report the custom origin and an empty base path.
3. Re-run the workflow. The docs will be built for `https://your-domain.example/docs/` and
   the marketing site for the domain root.

No hardcoded repository name exists in the marketing pages: internal links are relative.
Docusaurus URLs are generated from the workflow inputs. If you deploy outside GitHub
Actions, set the three environment variables yourself:

```bash
SITE_URL=https://example.com \
DOCS_BASE_URL=/docs/ \
MARKETING_URL=/ \
npm run build
```

## Manual deployment without Actions

The artifact is just a directory. You can build `dist/` and upload it to any static host:

```bash
npm --prefix docs ci
npm run build
```

Keep the root and `docs/` subdirectory structure intact.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 404 on every docs asset | Wrong `DOCS_BASE_URL` | Rebuild with the correct `/<repo>/docs/` path. |
| Docs load but styles are missing | Asset directory was not copied under `docs/` | Use `scripts/assemble-site.ts`. |
| Deploy fails at configure-pages | Pages is not enabled or source is not GitHub Actions | Enable it in Settings → Pages. |
| `onBrokenLinks` build failure | A Markdown link points to a missing route | Fix the link; Docusaurus fails builds on broken internal links. |
| `npm ci` fails | Missing or stale `docs/package-lock.json` | Run `npm install` in `docs/` and commit the lockfile. |
| Marketing links to docs 404 | Docs not built or copied | Confirm `dist/docs/index.html` exists. |

## Updating content

- Edit marketing pages in `marketing/` (`index.html`, `styles.css`, `main.ts`).
- Edit docs in `docs/docs/`. The sidebar is autogenerated from the folder structure and
  `sidebar_position` front matter.
- Commit and push to `main`; the workflow rebuilds and redeploys automatically.

Run `npm run build` before pushing to catch broken links, because the workflow uses
`onBrokenLinks: 'throw'`.
