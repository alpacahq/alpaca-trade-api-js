# OpenAPI Regeneration Tooling

This package regenerates the `@alpacahq/alpaca-trade-api` REST clients/models from
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
npm run generate -- --yes                 # auto-adopt only when no schemas/operations were removed
npm run generate -- --yes --allow-breaking-spec-removals
                                          # explicit override after removal review
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
3. **Confirm + adopt** — prompt before overwriting the pinned spec. `--yes`
   auto-adopts additive changes, but a non-interactive real adoption containing
   any removed schema or operation refuses before any spec write unless
   `--allow-breaking-spec-removals` is also supplied. `--dry-run --yes` remains
   fully write-free and does not require the override. Interactive mode lists
   removals and keeps the existing confirmation prompt. Declining keeps the
   current baseline. Every selected candidate is overlaid and its SSE contracts
   are validated before any selected pinned spec is written, so one invalid
   target cannot leave a partially adopted baseline.
4. **Derive** — apply the per-target JSON Patch overlay to the pinned spec
   (`src/overlay.ts`) to produce the generator input in `.work/derived/`. A stale
   overlay path is a hard failure (`OverlayDriftError`). `src/sseContract.ts`
   and `src/travelRuleContract.ts` then validate the narrow template contracts
   before generation.
5. **Generate** — run `openapi-generator` with the forked templates
   (`templates/typescript-fetch/`) into `../src/<target>`.
6. **Stale-file cleanup** — delete committed `apis/`/`models/` files that the new
   `.openapi-generator/FILES` manifest no longer lists (`src/staleClean.ts`);
   `runtime.ts` is protected.
7. **Safety gate** — run the SDK's `typecheck`, `lint`, `test`, `docs:api`
   (generates the documentation site's API reference under `docs/docs/api/` via
   `scripts/gen-docs-api-reference.ts`), plus the tooling's own `typecheck` +
   `test`.
8. **Orphan report** — diff normalized `apis/index.ts` + `models/index.ts`
   snapshots before/after (`src/exportsSnapshot.ts`), including both
   `export * from` modules and named/type/aliased re-exported symbols. Dry runs
   project orphan risks directly from removed schemas and operations. Search all
   hand-written risk surfaces: `src/client.ts`, `src/orders.ts`,
   `src/marketDataShapes.ts`, `src/capabilities.ts`, `src/streaming/`,
   `src/index.ts`, `src/rest.ts`, and `scripts/api-reference/examples.ts`.
   Finally print `git status` for the generated trees.

## Durability mechanisms (the regeneration-safe patches)

The generated trees are frozen output; we never hand-edit them. The eight classes
of deviation we need are encoded as follows:

OpenAPI Generator 7.14 emits trailing spaces where optional Mustache values are
empty. `.gitattributes` excludes only generated API/model files from Git's
`blank-at-eol` warning so stock-compatible output does not create false-positive
release checks; hand-written files remain covered.

### 1. Null-safe required arrays — forked template

Stock `typescript-fetch` deserializes a **required** object array as
`(json['x'] as Array<any>).map(XFromJSON)` with no null guard, so a `null` array
in a payload throws. `templates/typescript-fetch/modelGeneric.mustache` adds a
`json['x'] == null ? [] :` guard for required non-nullable arrays (both the plain
and `Set`/`uniqueItems` forms). This applies to every current and future required
array automatically — no per-model spec changes. Reproduces 15 model files.

### 2. Null-safe required maps — forked template

Alpaca can return `null` for a required symbol-keyed map when no requested
symbols have matching data. Stock `typescript-fetch` either passes that value
through despite a non-nullable type or calls `mapValues(null, ...)` and throws.
`templates/typescript-fetch/modelGeneric.mustache` normalizes required,
non-nullable maps and free-form objects to `{}` before either path. This applies
to every current and future required map automatically and reproduces 27
market-data model files.

### 3. Undocumented-field passthrough — vendor extension + forked template

Six trading models keep unknown fields (`...json` spread + `extends
Record<string, unknown>`) so undocumented API fields survive round-trips. This is
gated on a vendor extension `x-ts-passthrough` (added by the trading overlay) and
emitted by the forked `modelGeneric.mustache` / `modelGenericInterfaces.mustache`.
Models: `Account`, `Order`, `AccountConfigurations`, `OptionContract`,
`GetAccountActivities200ResponseInner`, and `CorporateAnnouncement`.

### 4. Feed enum tightening — spec overlay

The market-data `stock_auction_feed` parameter is an untyped `string` upstream.
`overlays/market-data.patch.json` retargets it to the existing
`stock_historical_feed` enum schema so the two auction operations type `feed?:
StockHistoricalFeed` instead of `feed?: string`.

### 5. Binary logo response — spec overlay

The OpenAPI 3.1 logo response declares `type: string` with
`contentMediaType: image/png`, but OpenAPI Generator 7.14 ignores
`contentMediaType` and emits a text response. The market-data overlay adds the
equivalent `format: binary` hint to the derived generator input so `LogosApi`
continues to return a `Blob` without modifying the pinned upstream spec.

### 6. Complete `oneOf` output — forked template

OpenAPI Generator 7.14 omits imports for discriminator-mapped `oneOf` models and
does not emit an `instanceOfX` guard for `oneOf` aliases. The former makes
market-data `CorporateActionEvent` uncompilable; the latter breaks a nested
Trading activity union that imports `instanceOfActivityV2DetailNTA`.
`templates/typescript-fetch/modelOneOf.mustache` adds the missing discriminator
imports and reusable guards, and returns `value` (rather than the generator's
undefined `json` identifier) for an unknown discriminator during serialization.
For undiscriminated unions it converts wire JSON before applying generated model
guards, because those guards use camelCase TypeScript property names while the
wire payload uses snake_case. Structural variants can overlap, so conversion and
serialization evaluate every valid candidate and select the one retaining the
most defined properties instead of silently dropping fields through the first,
less-specific match. Discriminator guards read the typed property name while
serialization emits only the wire property name.

### 7. Typed Server-Sent Events — vendor extension + validator + forked template

OpenAPI 3.0/3.1 can declare `text/event-stream` but cannot describe the schema of
each independently framed `data:` item, and `typescript-fetch` otherwise buffers
the body and calls `response.json()`. Approved operations carry
`x-typescript-fetch-sse` in the target overlay; optional companion extensions
declare reconnect behavior and the sandbox operation-server index. Terminal
query parameters and the Last-Event-ID header are marked on their actual
Parameter Objects, allowing the template to use OpenAPI Generator's resolved
`paramName` rather than guessing wire-to-TypeScript names. The pinned upstream
specs remain unchanged.

`src/sseContract.ts` fails generation when an SSE response is unmarked, a marker
is stale or malformed, path/response references are unresolved or cyclic,
successful media types are ambiguous, parameter locations are invalid, or
operation-server metadata is unsafe. `templates/typescript-fetch/apis.mustache` is the exact
pinned 7.14 template with a narrow marked-operation branch that emits
`SSEApiResponse<T>` / `SseSubscription<T>`, operation servers, and the generated
item transformer. Generated authentication is evaluated inside the connector so
function-backed credentials refresh on every initial or reconnect attempt.
Credential resolution is covered by the same cancellation and connection
deadline as the fetch, and an explicit per-call authentication header bypasses
its corresponding provider. All unmarked API output must remain byte-identical
to the stock template.

When upgrading OpenAPI Generator, extract the new stock `apis.mustache`, inspect
the marked operation context with `debugOperations`, reapply the narrow branch,
and A/B-generate from the same derived specs. Every API file without an SSE
operation must compare byte-for-byte with stock output.

### 8. Valid Travel Rule combinations — vendor extension + forked template

The upstream `TravelRuleInfo` description requires at least one destination
identifier and either an entity name or both natural-person names, but its
schema marks every field optional. The trading overlay adds
`x-ts-travel-rule-info`; the forked generic model templates emit an intersection
type representing those alternatives and reject incomplete JavaScript values
during serialization. The customization is limited to that marked schema and
does not add validation to other generated models. `src/travelRuleContract.ts`
fails generation if the marker moves, is duplicated, appears outside trading,
or any hardcoded field/type/reference assumption drifts.

### Credential-gated SSE smoke

The deterministic suite validates framing, hosts, cancellation, reconnects, and
model conversion without credentials. Before a release, optionally validate the
real services with bounded replay windows known to contain data:

```bash
APCA_API_KEY_ID=... \
APCA_API_SECRET_KEY=... \
APCA_SSE_ACTIVITY_SINCE=2026-09-24T00:00:00Z \
APCA_SSE_ACTIVITY_UNTIL=2026-09-25T00:00:00Z \
APCA_SSE_CORPORATE_ACTIONS_SINCE=2026-09-24T00:00:00Z \
APCA_SSE_CORPORATE_ACTIONS_UNTIL=2026-09-25T00:00:00Z \
npm run smoke:sse
```

Set `APCA_PAPER=false` for live trading or
`APCA_MARKET_DATA_SANDBOX=true` for the market-data sandbox. The smoke logs only
event ids; it never logs credentials or payloads. It fails if either bounded
window has no event, so choose windows appropriate to the test account.

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

1. Run `npm run generate -- --dry-run --yes` and review the write-free spec diff,
   overlay projection, and projected orphan risks.
2. Run `npm run generate` and confirm interactively to adopt the new pinned spec.
   For automation, `--yes` is allowed only when no schemas/operations were
   removed; after explicit owner approval of removals, add
   `--allow-breaking-spec-removals`.
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
