# AGENTS.md

Instructions for AI agents and contributors working in the `@alpacahq/alpaca-trade-api`
package.

## Overview

`@alpacahq/alpaca-trade-api` is a TypeScript SDK for the Alpaca **Trading API**
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

Repository development, documentation, generation, and release tooling require
Node.js 24 (see `.nvmrc`). The published SDK remains compatible with Node.js 20
and CI verifies the packed package on that minimum version.

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

Stable releases are published from `master` to the npm **`latest`** dist-tag.
The repository uses the standard Changesets flow; release publishing is
performed by GitHub Actions, not from a contributor laptop.

```bash
npm run changeset          # add a changeset: pick patch/minor/major + write the summary
npm run changeset:version  # consume changesets -> bump version + update CHANGELOG.md
npm run release            # build, then `changeset publish`
```

Workflow:

1. **Per change**: run `npm run changeset`, choose the bump (patch/minor/major), and
   write a one-line, user-facing summary. Commit the generated `.changeset/*.md`
   file alongside the code change. Internal-only changes (CI, tooling, refactors
   with no consumer impact) need no changeset.
2. **Merge to `master`**: `.github/workflows/release.yaml` opens or updates the
   dedicated **"chore: version packages"** PR when unreleased changesets exist.
3. **Publish**: merging the version PR runs `npm run release` and publishes the
   new version to the **`latest`** dist-tag.
4. **Local dry run**: `npm run changeset:version` then inspect the computed version
   and `CHANGELOG.md` before discarding (the release workflow is the source of
   truth for real publishes).

Notes:

- `@changesets/changelog-github` (configured in `.changeset/config.json`, repo
  `alpacahq/alpaca-trade-api-js`, `baseBranch: master`) needs a `GITHUB_TOKEN`
  env var when running `changeset:version` so it can resolve PR/commit/author
  links — e.g. `GITHUB_TOKEN=… npm run changeset:version`. The release workflow
  provides this automatically.
- `access` is `public` in `.changeset/config.json` (the package is scoped
  `@alpacahq/*`).

### Automated release flow on `master`

Releases are automated by GitHub Actions:

- **`.github/workflows/release.yaml`** runs on every push to `master` via the
  [`changesets/action`](https://github.com/changesets/action). When unreleased
  changesets exist it opens/updates a **"chore: version packages"** PR (bumping
  the version + `CHANGELOG.md`). Merging that PR triggers `npm run release`
  (build → `changeset publish`) to the **`latest`** dist-tag, with npm
  **provenance** enabled (`id-token: write` + `NPM_CONFIG_PROVENANCE`). Requires
  the `NPM_KEY` repo secret.
- **`.github/workflows/ci.yaml`** runs on PRs and pushes to `master`: typecheck,
  lint, test, build; a docs build (`onBrokenLinks: "throw"`); and a
  regeneration-invariant job that runs `npm run generate:offline` and asserts the
  generated trees are byte-for-byte unchanged (`git diff --exit-code`).
- **`.github/workflows/docs.yaml`** builds and deploys the Docusaurus site to
  GitHub Pages on push to `master` (and `workflow_dispatch`), publishing to
  <https://alpacahq.github.io/alpaca-trade-api-js/>.

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
    (prints the spec diff, overlay projection, and projected orphan risks;
    `--dry-run` guards every write, and removed schemas/operations do not require
    an override in preview mode).
  - Reproduce/verify from pinned specs: `npm run generate:offline` then
    `git diff -- src/trading src/market-data`.
  - Iterate on one API: add `--target trading` or `--target market-data`.
  - Only run an adopting generation (`npm run generate`, or `… -- --yes`) after
    the human approves the diff. Non-interactive real adoption with any removed
    schema or operation is blocked before spec writes unless the explicit
    `--allow-breaking-spec-removals` flag is supplied.
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
    `src/capabilities.ts`, `src/streaming/`, `src/index.ts`, `src/rest.ts`, and
    `scripts/api-reference/examples.ts`, and fix references before committing.
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
