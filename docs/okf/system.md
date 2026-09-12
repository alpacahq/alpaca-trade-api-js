---
type: System
title: Alpaca Trade API JS SDK
description: Node.js TypeScript SDK for the Alpaca Trading API and Market Data API, published to npm for application developers.
resource: likec4://alpacahq/alpaca_trade_api_js
tags: [alpacahq, sdk, typescript, generated]
status: active
owners: ["@Azein"]
timestamp: 2026-09-12T00:00:00+00:00
generated_by: claude-opus-5 / layered-docs 2026-09
source_commit: d9bf929886238c16dc790501432c9e3cd7c0f8e2
source_branch: docs/layered-2026-09
generated_at: 2026-09-12T00:00:00+00:00
confidence: medium
review_status: draft-needs-review
links:
  repository: https://github.com/alpacahq/alpaca-trade-api-js
  architecture: ../architecture/alpaca_trade_api_js.c4
---

# Alpaca Trade API JS SDK

## Purpose

The repository builds and publishes `@alpacahq/alpaca-trade-api`, a single Node.js
TypeScript SDK covering both the Alpaca **Trading API** and the **Market Data API**
(`package.json`, `README.md`). Each API keeps its own namespace (`trading` /
`marketData`) inside one package, fronted by a unified `Alpaca` client with typed
errors, retry/timeout/rate limiting, pagination helpers, ergonomic order builders
and real-time streaming (`README.md`, `src/client.ts`).

Its audience is application developers integrating with Alpaca from Node.js
(`README.md`, `examples/`). The repository also ships the assets that surround the
package: a Docusaurus documentation site (`docs/`), a migration guide plus codemod
for the 3.x to 4.x upgrade (`MIGRATION.md`, `codemods/alpaca-v3-to-v4.js`), and a
reproducible OpenAPI regeneration pipeline (`tooling/GENERATION.md`).

## Capabilities

- Trading REST access — accounts, orders, positions, assets, calendar, clock, activities, watchlists and more — evidence: `src/trading/apis/`
- Market Data REST access — stocks, options, crypto, crypto perpetual futures, forex, fixed income, indices, news, logos, screener and corporate actions — evidence: `src/market-data/apis/`
- Real-time streaming for trade updates and market data over WebSocket — evidence: `src/streaming/tradingStream.ts`, `src/streaming/marketDataStream.ts`
- Shared HTTP transport with opt-in retry/backoff, request timeouts, rate limiting, middleware and a typed `ApiError` — evidence: `src/core/runtime.ts`, `src/rate-limit.ts`, `src/errors.ts`
- Ergonomic layer over the generated clients: order builders, pagination, normalized market-data shapes, capability map — evidence: `src/client.ts`, `src/orders.ts`, `src/pagination.ts`, `src/capabilities.ts`
- Reproducible regeneration of the generated REST trees from pinned specs — evidence: `tooling/GENERATION.md`, `tooling/src/run.ts`
- Automated 3.x to 4.x migration codemod — evidence: `codemods/alpaca-v3-to-v4.js`, `MIGRATION.md`
- Generated documentation site published to GitHub Pages on pushes to the default branch that touch `docs/`, `src/`, `examples/`, `scripts/` or the workflow file itself, and on manual dispatch — evidence: `docs/package.json`, `.github/workflows/docs.yaml` (`on.push.paths`, `workflow_dispatch`)

## Interfaces

**Inbound:** none at runtime — this is a library, not a service. Its public surface is
the npm package entrypoints `.`, `./rest` and `./testing` declared in `package.json`
`exports`, plus the `Alpaca` client and namespace exports in `src/index.ts` and
`src/rest.ts`. Developer-facing entry points are the npm scripts in `package.json`
(`build`, `test`, `typecheck`, `lint`, `generate`, `docs:*`, `release`).

**Outbound:** the Alpaca Trading REST hosts `paper-api.alpaca.markets` and
`api.alpaca.markets` and the trading-updates WebSocket (`src/trading/runtime.ts`,
`src/streaming/tradingStream.ts`); the Market Data hosts `data.alpaca.markets` and
`data.sandbox.alpaca.markets` plus their streaming counterparts
(`src/market-data/runtime.ts`, `src/streaming/marketDataStream.ts`); the OpenAPI spec
source `docs.alpaca.markets/us/openapi` used only by the regeneration pipeline
(`tooling/src/fetchSpecs.ts`); the npm registry for publication (`.npmrc`,
`.github/workflows/release.yaml`); GitHub Actions and Pages for CI, release
automation and docs hosting (`.github/workflows/`).

## Dependencies

- `ws` — WebSocket transport for the streaming clients — evidence `package.json`, `src/streaming/websocket.ts`
- `@msgpack/msgpack` — msgpack decoding of market-data stream frames — evidence `package.json`, `src/streaming/marketDataStream.ts`
- `lossless-json` — precision-preserving JSON handling — evidence `package.json`
- Platform-global `fetch`, `Headers`, `URL`, `AbortController` — the REST transport uses no HTTP client dependency, which sets the Node 20 floor — evidence `README.md`, `package.json` `engines`
- `tsup` / `esbuild` and `@microsoft/api-extractor` — dual CJS and ESM build plus declaration emit — evidence `tsup.config.ts`, `package.json`
- `vitest`, `biome`, `typescript` — test, lint and typecheck toolchain — evidence `package.json`, `biome.json`, `vitest.config.ts`
- `openapi-generator` with a JDK — client generation in the tooling package — evidence `tooling/GENERATION.md`, `tooling/openapitools.json`, `.github/workflows/ci.yaml`
- Changesets — versioning, changelog and publish flow — evidence `.changeset/config.json`, `.github/workflows/release.yaml`

## Data & storage

No datastores, queues or persistent state are evidenced in the repository. The only
persisted artefacts are the pinned, canonicalized OpenAPI specs used as the
regeneration baseline (`tooling/specs/trading-api.json`,
`tooling/specs/market-data-api.json`) and the JSON Patch overlays applied to them
(`tooling/overlays/`). Credentials are supplied by the consumer through constructor
options or the `APCA_API_KEY_ID` / `APCA_API_SECRET_KEY` / `APCA_API_OAUTH_TOKEN`
environment variables (`.env.example`, `src/auth.ts`); no secrets are stored in the
repository.

## Operations

No Dockerfile, compose file, Kubernetes manifest or Terraform configuration exists in
the repository, so there is no deployment model — the artefact is an npm package and a
static documentation site.

- Build: `npm run build` runs `tsup`, emitting dual CJS and ESM bundles plus declarations into `dist/` (`package.json`, `tsup.config.ts`).
- CI: `.github/workflows/ci.yaml` runs changeset validation, typecheck, lint, tests, the codemod verification and the build on Node 24, then executes the packed package on Node 20 to defend the consumer floor; a `regen-invariant` job runs `npm run generate:offline` and asserts the generated trees are byte-for-byte unchanged; a third `docs` job builds the Docusaurus site on every pull request and default-branch push, independently of the Pages deploy workflow, so a broken link or anchor fails CI (`onBrokenLinks: "throw"`).
- Release: `.github/workflows/release.yaml` uses the Changesets action on pushes to the default branch to open or update a version PR, and on merge runs `npm run release` to publish to the `latest` dist-tag with npm provenance; it needs the `NPM_KEY` repository secret.
- Docs: `.github/workflows/docs.yaml` builds the Docusaurus site and deploys it to GitHub Pages — but only on pushes to the default branch that touch `docs/**`, `src/**`, `examples/**`, `scripts/**` or the workflow file, plus manual `workflow_dispatch`; a push touching only, say, `tooling/`, `test/` or `package.json` deploys nothing.
- Contributor toolchain: Node 24 per `.nvmrc`; published SDK supports Node 20 and above per `package.json` `engines`.

## Behaviour (Allium)

none — the repository contains no `.allium` specification files at this commit
(`git ls-files`), and no accepted spec exists for it.

## Decisions

- [ADR-0001 Generated REST clients are never hand-edited](decisions/ADR-0001-generated-trees-never-hand-edited.md)
- [ADR-0002 One shared transport behind thin per-API shims](decisions/ADR-0002-shared-transport-with-thin-shims.md)
- [ADR-0003 Dual CJS and ESM build with a REST-only entrypoint](decisions/ADR-0003-dual-build-rest-only-entrypoint.md)
- [ADR-0004 Releases managed with Changesets and published from CI](decisions/ADR-0004-changesets-release-flow.md)

## Evidence

- `package.json`, `.npmrc`, `.nvmrc`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`
- `README.md`, `AGENTS.md`, `MIGRATION.md`, `CODEOWNERS`, `.env.example`
- `src/client.ts`, `src/index.ts`, `src/rest.ts`, `src/core/runtime.ts`, `src/capabilities.ts`
- `src/trading/runtime.ts`, `src/market-data/runtime.ts`, `src/streaming/tradingStream.ts`, `src/streaming/marketDataStream.ts`
- `tooling/GENERATION.md`, `tooling/package.json`, `tooling/config/trading.yaml`, `tooling/config/market-data.yaml`, `tooling/src/fetchSpecs.ts`
- `docs/package.json`, `codemods/README.md`, `skills/alpaca-trade-api-sdk/SKILL.md`
- `.github/workflows/ci.yaml`, `.github/workflows/docs.yaml`, `.github/workflows/release.yaml`

## Open questions

- Ownership is taken from `CODEOWNERS`, which names a single GitHub handle and no team; the owning team is not stated anywhere in the repository. Unverified.
- `status: active` is inferred from recent dependency-bump commits and live CI/release workflows rather than from an explicit statement. Unverified.
- The externals `ext_alpaca_trading_api`, `ext_alpaca_market_data_api`, `ext_alpaca_openapi_specs` and `ext_npm` are not yet in the organisation external dictionary and are declared new here. Unverified.
- Whether the Trading and Market Data APIs should be modelled as externals or as sibling internal systems in the organisation-level model is a merge-step question this repository cannot answer. Unverified.
- This repository's `docs/` is the Docusaurus site root (`docs/package.json`, `docs/docusaurus.config.ts`), not a generic documentation folder. Committing this generated bundle under `docs/okf/` and `docs/architecture/` therefore matches the `docs/**` path filter in `.github/workflows/docs.yaml` and fires a Pages build and deploy even though the site content does not change (the preset's `docs` entry has no `path` override, so rendered content resolves to `docs/docs`). The RULE-mandated paths are kept as they are.
- The `examples/` and `migrated_examples/` trees are evidenced artefacts (`tsconfig.examples.json`, `package.json` `typecheck:examples`, `scripts/gen-docs-examples.ts`, the `examples/**` trigger in `.github/workflows/docs.yaml`) but are not modelled as their own LikeC4 container; they are recorded instead as generated input to the `docs_site` container. Whether they deserve a container of their own is left to review. Confidence: low.
