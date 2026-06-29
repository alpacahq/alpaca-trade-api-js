# OpenAPI Regeneration Tooling

This package regenerates the `@alpacahq/alpaca-ts-alpha` REST clients/models from
Alpaca's OpenAPI specs **reproducibly** and **regeneration-safely**. It is a
private, standalone package (not part of the published SDK) with its own
dependencies and tests.

The headline invariant: running the pipeline against the pinned specs reproduces
the committed `src/trading/{apis,models,index.ts}` and
`src/market-data/{apis,models,index.ts}` trees **byte-for-byte** (the
"empty-diff" property). Every hand-required deviation from stock
`typescript-fetch` output is encoded declaratively — in forked Mustache
templates or JSON Patch overlays — never as a hand-edit of generated files.

## Quick start

```bash
# From the SDK repo root:
npm run generate            # interactive: fetch latest specs, show diff, confirm, regenerate
npm run generate:offline    # reproduce trees from the pinned specs (no network)

# Useful flags (after `--`):
npm run generate -- --target trading      # one target only
npm run generate -- --offline --dry-run   # plan without writing anything
npm run generate -- --yes                 # auto-adopt fetched spec changes
```

Requirements: Node ≥ 20 and a **real JDK** (openapi-generator is a Java tool).
The pipeline auto-detects a JDK (`java` on PATH → `/usr/libexec/java_home` →
Homebrew keg-only `openjdk`) and prepends it to PATH for the run only. If none is
found: `brew install openjdk`.

## What the pipeline does (`src/run.ts`)

1. **Ensure toolchain** — download the pinned generator jar (`scripts/ensure-jar.sh`,
   version locked in `openapitools.json`) and locate a working JDK (`src/env.ts`).
2. **Fetch + diff** (skipped with `--offline`) — fetch the latest specs from
   `docs.alpaca.markets`, canonicalize them (`src/jsonCanonical.ts`), and show a
   semantic diff vs the pinned specs (`src/specDiff.ts`: schemas added/removed/
   modified, operations added/removed, plus **operations moved** (first tag
   changed → different generated `Api` class) and **operations renamed**
   (`operationId` changed → different generated method name). Moves/renames are
   the early warning that the hand-written facade/capability map will need
   rewiring — e.g. the clock retag surfaced as
   `GET /v3/clock: "Calendar" -> "Clock"` before any code broke).
3. **Confirm + adopt** — prompt before overwriting the pinned spec (auto-yes with
   `--yes`). Declining keeps the current baseline.
4. **Derive** — apply the per-target JSON Patch overlay to the pinned spec
   (`src/overlay.ts`) to produce the generator input in `.work/derived/`. A stale
   overlay path is a hard failure (`OverlayDriftError`).
5. **Generate** — run `openapi-generator` with the forked templates
   (`templates/typescript-fetch/`) into `../src/<target>`.
6. **Stale-file cleanup** — delete committed `apis/`/`models/` files that the new
   `.openapi-generator/FILES` manifest no longer lists (`src/staleClean.ts`);
   `runtime.ts` is protected.
7. **Safety gate** — run the SDK's `typecheck`, `lint`, `test`, `docs:api`, plus
   the tooling's own `typecheck` + `test`.
8. **Orphan report** — diff `apis/index.ts` + `models/index.ts` exports before/
   after (`src/exportsSnapshot.ts`) and warn about removed generated symbols that
   hand-written code (`client.ts`, `orders.ts`, `marketDataShapes.ts`) may
   reference. Finally print `git status` for the generated trees.

## Durability mechanisms (the regeneration-safe patches)

The generated trees are frozen output; we never hand-edit them. The three classes
of deviation we need are encoded as follows:

### 1. Null-safe required arrays — forked template

Stock `typescript-fetch` deserializes a **required** object array as
`(json['x'] as Array<any>).map(XFromJSON)` with no null guard, so a `null` array
in a payload throws. `templates/typescript-fetch/modelGeneric.mustache` adds a
`json['x'] == null ? [] :` guard for required non-nullable arrays (both the plain
and `Set`/`uniqueItems` forms). This applies to every current and future required
array automatically — no per-model spec changes. Reproduces 15 model files.

### 2. Undocumented-field passthrough — vendor extension + forked template

Six trading models keep unknown fields (`...json` spread + `extends
Record<string, unknown>`) so undocumented API fields survive round-trips. This is
gated on a vendor extension `x-ts-passthrough` (added by the trading overlay) and
emitted by the forked `modelGeneric.mustache` / `modelGenericInterfaces.mustache`.
Models: `Account`, `Order`, `AccountConfigurations`, `OptionContract`, plus the
two inline response-item models `GetAccountActivities200ResponseInner` and
`GetV2CorporateActionsAnnouncements200ResponseInner`.

### 3. Feed enum tightening — spec overlay

The market-data `stock_auction_feed` parameter is an untyped `string` upstream.
`overlays/market-data.patch.json` retargets it to the existing
`stock_historical_feed` enum schema so the two auction operations type `feed?:
StockHistoricalFeed` instead of `feed?: string`.

## Layout

```
tooling/
  config/            generator configs (one per target)
  overlays/          JSON Patch overlays applied to pinned specs before generation
  specs/             pinned, canonicalized OpenAPI specs (the reproducible baseline)
  templates/         forked Mustache templates (only the files we changed)
  scripts/           ensure-jar.sh
  src/               pipeline modules (pure functions + orchestrator)
  test/              vitest unit tests for the pure modules
  .work/             scratch (gitignored): derived specs, generator work dir
  .cache/            generator jar cache (gitignored)
```

## Refreshing the spec / adopting upstream changes

1. `npm run generate` and review the printed spec diff.
2. Confirm to adopt the new pinned spec.
3. If generation fails with `OverlayDriftError`, the upstream spec moved a path an
   overlay targets — update the overlay in `overlays/` and re-run.
4. Review the orphan report; update hand-written references if a symbol was
   removed.
5. Commit the regenerated trees together with the updated pinned spec/overlay.

## Pinning notes

- Generator version is locked in `openapitools.json`; the jar is fetched by digest
  of that version. Bumping it can change formatting — re-verify the empty-diff.
- Specs are stored canonical (sorted keys, 2-space indent) so diffs reflect real
  surface changes, not upstream formatting churn.
