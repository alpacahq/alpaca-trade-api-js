# Alpaca JavaScript/TypeScript SDK Docs

Local Docusaurus site for `@alpacahq/alpaca-trade-api`.

Repository documentation tooling requires Node.js 24 (see `../.nvmrc`). The
published SDK continues to support Node.js 20.

## Local setup

Run these commands from the repository root:

```bash
npm --prefix docs install
npm --prefix docs start
```

Open <http://localhost:3000/alpaca-trade-api-js/>. The `prestart` hook
regenerates the API reference, examples, and migration guide before Docusaurus
starts.

## Production build preview

```bash
npm --prefix docs run build
npm --prefix docs run serve
```

Use `npm --prefix docs run clear` to remove Docusaurus caches when troubleshooting
a stale local build.

## Authored and generated pages

Author narrative guides directly under `docs/docs/`. Navigation lives in
`docs/sidebars.ts`, and site configuration lives in
`docs/docusaurus.config.ts`.

Do not edit these generated files directly:

- `docs/docs/api/` comes from SDK capability maps plus
  `scripts/api-reference/examples.ts`, rendered by
  `scripts/gen-docs-api-reference.ts`.
- `docs/docs/examples.md` comes from the runnable files under `examples/`,
  rendered by `scripts/gen-docs-examples.ts`.
- `docs/docs/migration.md` comes from the root `MIGRATION.md`, rendered by
  `scripts/gen-docs-migration.ts`.

Both `npm --prefix docs start` and `npm --prefix docs run build` regenerate
these pages. They are ignored by Git and should remain reproducible from their
source files.

## Validation

The production build treats broken document links, Markdown links, and anchors
as errors:

```bash
npm --prefix docs run build
```

Root verification also checks every Markdown document shipped in the npm
tarball:

```bash
npm run build
npm run verify:package
```

## GitHub Pages deployment

`.github/workflows/docs.yaml` builds and deploys the site on pushes to `master`
that affect documentation or generator inputs, and through
`workflow_dispatch`. The production site is
<https://alpacahq.github.io/alpaca-trade-api-js/>.

The workflow sets `DOCUSAURUS_URL` and `DOCUSAURUS_BASE_URL`; local defaults in
`docs/docusaurus.config.ts` match the GitHub Pages deployment.
