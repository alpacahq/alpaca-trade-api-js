# AGENTS.md

Instructions for AI agents and contributors working in the `@alpacahq/alpaca-ts-alpha`
package.

## Overview

`@alpacahq/alpaca-ts-alpha` is a TypeScript SDK for the Alpaca **Trading API**
and **Market Data API**. The REST clients/models are generated with OpenAPI
Generator via the **reproducible pipeline in `tooling/`** (`npm run generate`);
they stay a faithful snapshot of Alpaca's OpenAPI spec, and every convenience is
hand-written in separate modules (see the first convention below). Crucially,
the generated trees are **never hand-edited** — every required deviation from
stock generator output is encoded declaratively in forked Mustache templates or
JSON Patch overlays, so regeneration reproduces the committed trees byte-for-byte.
See `tooling/GENERATION.md` for the full design. Notable behaviors to preserve
when editing:

- null-safe array deserialization (no NPE on `null` array fields),
- opt-in retry/backoff (`retry`), request timeouts (`timeoutMs`), default
  `User-Agent`,
- typed `ApiError` parsing the `{ code, message }` envelope,
- undocumented-field passthrough on key trading models,
- a `pagination` helper, and a `vitest` test suite.

## Conventions

- **Generated vs hand-written — never hand-edit the generated trees.** The
  `src/trading/{apis,models,index.ts}` and `src/market-data/{apis,models,index.ts}`
  trees are generator output, reproduced by `npm run generate` (see `tooling/`).
  Treat them as derived artifacts: **never hand-edit them**. If you need to change
  generated output, change the spec/overlay/template in `tooling/` and regenerate
  — `npm run generate:offline` must reproduce the trees byte-for-byte. All
  behavior, ergonomics, and fixes live in hand-written modules outside those trees
  (`src/client.ts`, `src/orders.ts`, `src/marketDataShapes.ts`,
  `src/core/runtime.ts`, `src/streaming/`, ...).
- **Regeneration-safe customizations live in `tooling/`.** Three deviations from
  stock `typescript-fetch` are encoded declaratively so they survive every
  regeneration: (1) null-safe required-array deserialization — forked
  `templates/typescript-fetch/modelGeneric.mustache`; (2) undocumented-field
  passthrough on 6 trading models — `x-ts-passthrough` vendor extension (trading
  overlay) + forked templates; (3) market-data `feed` enum tightening — market-data
  overlay. Add new fixes the same way (template or overlay), never as a hand-edit.
- **The transport is shared.** The HTTP transport (retry/backoff, timeouts,
 rate limiting, typed errors, middleware, querystring, response wrappers) lives
 once in `src/core/runtime.ts`. `src/trading/runtime.ts` and
 `src/market-data/runtime.ts` are thin shims that `export *` from it and only
 add their host constants plus a `Configuration` subclass overriding
 `defaultBasePath()`. Make transport changes in `src/core/runtime.ts`; touch the
 shims only for host/base-path concerns. These shims sit inside the generated
 trees but are hand-maintained transport code, protected from regeneration by
 `.openapi-generator-ignore`; treat them as the hand-written exceptions inside
 those otherwise generator-owned trees.
- **Edit `src/` directly** for behavior changes.
- **Keep the capability maps in sync.** When you add an ergonomic helper to
  `TradingClient` / `MarketDataClient` / `OrdersApi` (`src/client.ts`), add it to
  `ergonomicCapabilities` in `src/capabilities.ts` — a test in
  `test/client.test.ts` asserts every listed helper exists on the facade.
- **Linting is scoped to hand-written code.** Biome (linter only; formatter and
  assist are off) lints the hand-maintained TypeScript. The OpenAPI-generated
  `src/trading/{apis,models,index.ts}` and `src/market-data/{apis,models,index.ts}`
  are excluded in `biome.json` — they're generator output, so don't lint or
  hand-edit them.
- Keep the test suite green and add coverage for new behavior.

## Commands

```bash
npm install            # also builds via the `prepare` script
npm run build          # tsup -> dist/ (dual ESM + CJS)
npm run typecheck      # tsc --noEmit (the type authority)
npm test               # vitest
npm run lint           # biome lint (hand-written code; generated apis/models are ignored)
npm run lint:fix       # biome lint --write (apply safe autofixes)
npm run generate       # regenerate REST trees: fetch latest specs, diff, confirm, generate
npm run generate:offline  # reproduce the trees from pinned specs (no network)
```

Regeneration lives in `tooling/` (a separate private package with its own deps
and tests). It needs a real JDK (auto-detected; `brew install openjdk` if
missing). See `tooling/GENERATION.md` for the pipeline, durability mechanisms,
and how to adopt upstream spec changes.

## Releases & changelog (Changesets)

Releases and `CHANGELOG.md` are managed with [Changesets](https://github.com/changesets/changesets).
Changelog entries are **human-authored**, decoupled from commit messages — every
user-facing change ships with a changeset file describing it and its semver bump.

```bash
npm run changeset          # add a changeset: pick patch/minor/major + write the summary
npm run changeset:version  # consume changesets -> bump version + update CHANGELOG.md
npm run release            # build, then `changeset publish` (npm publish + git tag)
```

Workflow:

1. **Per change**: run `npm run changeset`, choose the bump (patch/minor/major), and
   write a one-line, user-facing summary. Commit the generated `.changeset/*.md`
   file alongside the code change. Internal-only changes (CI, tooling, refactors
   with no consumer impact) need no changeset.
2. **At release time**: run `npm run changeset:version`. This applies all pending
   changesets, bumps `version` in `package.json`, regenerates `CHANGELOG.md` with
   GitHub PR/commit links (via `@changesets/changelog-github`), and deletes the
   consumed changeset files. Review and commit the result.
3. **Publish**: run `npm run release` to build and publish to npm, then push the
   commit and the tag (`git push --follow-tags`).

Notes:

- `@changesets/changelog-github` (configured in `.changeset/config.json`) needs a
  `GITHUB_TOKEN` env var when running `changeset:version` so it can resolve
  PR/commit/author links — e.g. `GITHUB_TOKEN=… npm run changeset:version`.
- `access` is `public` in `.changeset/config.json` (the package is scoped
  `@alpacahq/*`).
- The existing `v0.1.0`–`v0.2.0` releases predate this setup and are intentionally
  **not** backfilled; the changelog starts from the next release.

## Assisted regeneration (agent helping a human run `npm run generate`)

The pipeline is interactive and has a few human-judgment gates. When assisting,
act as the **analyst between steps**: run observable previews, interpret each
output, recommend a decision, and let the human own the irreversible calls.

- **Division of labor.** Human owns: adopting a fetched spec as the new baseline,
  accepting API surface changes, and the final commit. Agent owns: running
  previews, classifying the spec diff, proposing overlay/template fixes, mapping
  orphaned exports to hand-written references, and verifying the byte-for-byte
  invariant.
- **Don't block on the prompt.** The confirm step reads stdin and will hang a
  non-interactive shell. Gather context non-interactively instead:
  - Preview live changes without writing: `npm run generate -- --dry-run --yes`
    (prints the spec diff + plan; `--dry-run` guards every write, `--yes` only
    skips the prompt).
  - Reproduce/verify from pinned specs: `npm run generate:offline` then
    `git diff -- src/trading src/market-data`.
  - Iterate on one API: add `--target trading` or `--target market-data`.
  - Only run an adopting generation (`npm run generate`, or `… -- --yes`) after
    the human approves the diff.
- **Interpret each output and surface it.**
  - *Spec diff* (`schemas +/-/~`, `operations +/-`): classify additive vs
    breaking. Removed/renamed schemas or operations, or modified shapes on models
    the facade wraps, are potentially breaking — name them. Pure additions are
    low-risk.
  - *`OverlayDriftError … <op> <path>`*: an overlay target moved upstream. Locate
    where the field/parameter went in `tooling/specs/<api>.json` and propose the
    updated op in `tooling/overlays/<api>.patch.json`; re-run `--offline` to
    confirm.
  - *`removed stale …`*: a schema/operation disappeared; confirm it's intended and
    grep the symbol in hand-written code.
  - *Orphan report (`exports removed`)*: for each removed symbol, search
    `src/client.ts`, `src/orders.ts`, `src/marketDataShapes.ts`,
    `src/capabilities.ts`, and `src/streaming/` and fix references before
    committing.
  - *Final `git status` on the trees*: the target is **no diff** except deliberate
    changes. Unexpected `apis/`/`models/` churn means a spec change was adopted —
    confirm it's intended and reflected in tests/ergonomics.
- **Failure playbook.**
  - *No JDK*: `brew install openjdk` (keg-only; the pipeline finds it).
  - *Non-empty diff after `--offline` with no spec change*: a template/overlay
    regression — reconcile the template/overlay, never the generated file.
  - *Safety gate fails (typecheck/lint/test/docs)*: a real regression; new API
    surface usually means new ergonomics, an out-of-date capability map
    (`src/capabilities.ts`), or stale docs.
- **After a successful adopt.** For new operations/models, consider ergonomic
  helpers on `TradingClient`/`MarketDataClient`/`OrdersApi` and keep
  `ergonomicCapabilities` (`src/capabilities.ts`) in sync. Commit the regenerated
  trees together with the updated `tooling/specs/*` and any `tooling/overlays/*`
  so the baseline stays reproducible.
