# Contributing

Thanks for helping improve `@alpacahq/alpaca-trade-api`.

## Prerequisites

- **Node.js >= 24** (see `.nvmrc`). The published SDK supports Node >= 20; CI
  verifies the packed package on that floor separately.

## Setup and checks

```bash
npm install            # also builds via the `prepare` script
npm run build          # tsup -> dist/ (dual ESM + CJS)
npm run typecheck      # tsc --noEmit (the type authority)
npm run lint           # biome lint (hand-written code only)
npm run test           # vitest
```

Preview the documentation site locally:

```bash
npm --prefix docs install   # first time only
npm --prefix docs start     # dev server
npm --prefix docs run build # production build (same as CI/docs deploy)
```

## Generated vs hand-written code

REST clients and models under `src/trading/{apis,models,index.ts}` and
`src/market-data/{apis,models,index.ts}` are **OpenAPI Generator output**.
**Never hand-edit those trees.**

To change generated output, update the pinned spec, overlay, or template in
`tooling/` and regenerate:

```bash
npm run generate:offline   # reproduce trees from pinned specs (no network)
npm run generate           # fetch latest specs, preview diff, adopt with care
```

Behavior, ergonomics, streaming, pagination, and shared transport live in
hand-written modules (`src/client.ts`, `src/orders.ts`, `src/core/runtime.ts`,
`src/streaming/`, …). See
[AGENTS.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md)
and
[tooling/GENERATION.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/tooling/GENERATION.md)
for the full rules.

## Documentation

The hosted guides are canonical for workflows, conventions, and safety. The
curated API Reference supports discovery and examples; installed TypeScript
declarations are authoritative for exact signatures and models.

- **Authored guides** live under
  [`docs/docs/`](https://github.com/alpacahq/alpaca-trade-api-js/tree/master/docs/docs/).
- **Generated pages** — API reference, examples, and the migration page — are
  produced during the docs build from the SDK capability maps, repository
  examples, and root [`MIGRATION.md`](./MIGRATION.md).
- **Production build:** `npm --prefix docs run build` (runs generators first,
  then Docusaurus). CI and the GitHub Pages deploy use this path.

See the
[documentation development guide](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/docs/README.md)
for local preview, generated-page boundaries, validation, and deployment.

For AI-consumer guidance, `LLMS.md` is authored and
`skills/alpaca-trade-api-sdk/SKILL.md` is generated. Edit `LLMS.md`, then run:

```bash
npm run agent:skill
npm run agent:skill:check
```

Commit the regenerated Skill with its source.

When you add ergonomic helpers, keep [`src/capabilities.ts`](./src/capabilities.ts)
in sync — a test asserts every listed helper exists on the facade.

## User-facing changes and releases

User-facing changes ship with a [Changesets](https://github.com/changesets/changesets)
entry:

```bash
npm run changeset
```

Pick the semver bump and write a one-line, user-facing summary. Commit the
generated `.changeset/*.md` file with your change. Merging to `master` opens a
version PR; publishing to npm **`latest`** happens after that PR merges. See
[AGENTS.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md)
for the release workflow.
