# Codemods

Automated migration helpers for `@alpacahq/alpaca-trade-api`, built on
[jscodeshift](https://github.com/facebook/jscodeshift).

Choose the transform for the SDK version currently installed. To move from
`3.x` to `5.x`, run the `3.x` → `4.0` migration and verify it before running the
`4.x` → `5.0` migration. See the [migration guide index](../MIGRATIONS.md).

## `alpaca-v3-to-v4.js`

Migrates source from the stable `3.x` SDK to the `4.0` rewrite. It performs the
**mechanical** transforms and inserts `// TODO(alpaca-codemod): ...` comments
where a change is **semantic** and needs a human. Read
[`../MIGRATION.md`](../MIGRATION.md) alongside it. Both this guide and the
codemod are included in the published npm package.

### Run

```bash
# JavaScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js --parser=babel --extensions=js,jsx,mjs,cjs src

# TypeScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js --parser=tsx --extensions=ts,tsx,mts,cts src

# Preview without writing
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js --parser=babel --dry --print src/bot.js
```

When running from a checkout of this SDK repository, shorten the transform path
to `-t ./codemods/alpaca-v3-to-v4.js`.

### Options

- `--instanceName=foo,bar` — additional identifiers to treat as an Alpaca
  client. The identifier must resolve to a real lexical binding; an unbound or
  shadowed name is not trusted. The codemod otherwise auto-detects bindings
  initialized with `new` using an SDK-imported `Alpaca` constructor. A variable
  merely named `alpaca` is never automatically rewritten.

### What it rewrites automatically

- Default ESM imports and CommonJS default bindings become named `Alpaca`
  bindings, preserving local aliases (`import Legacy from ...` →
  `import { Alpaca as Legacy } from ...`).
- Constructor option `secretKey` → `secret`.
- Flat trading methods → namespaced (`getAccount` →
  `trading.account.getAccount`, `getOrder(id)` →
  `trading.orders.getOrderByOrderID({ orderId: id })`, positions, assets,
  calendar, clock, watchlists, account config/activities, …).
- `createOrder({ type: "market", ... })` → the matching ergonomic builder
  (`trading.orders.market({ ... })`, `.limit`, `.bracket`, …) with body keys
  camelCased. A non-literal `type` falls back to `trading.orders.submit({...})`
  (flagged).
- Streaming accessors assigned to a variable
  (`const ws = alpaca.data_stream_v2` → `alpaca.marketData.stockStream()`) and
  handler renames (`onStockTrade` → `onTrade`, `onStatuses` → `onStatus`,
  `onOrderUpdate` → `onTradeUpdate`), plus
  `subscribe(["trade_updates"])` → `subscribeTradeUpdates()`. Handler and
  subscription renames are limited to variables traced to a stream factory on
  a known Alpaca instance (including simple instance/stream aliases). The
  subscription rewrite applies only to a proven trading stream and an array
  containing exactly `"trade_updates"`. Provenance follows lexical bindings,
  so a nested parameter/local/class that shadows a known constructor, client,
  alias, or stream name is never rewritten. Constructor, client, alias, and
  stream provenance is deliberately conservative: only declaration
  initializers with no other writes qualify. Assignment-proven bindings,
  bindings used before a proving assignment, and bindings later reassigned
  (even to another proven value) stay unchanged and emit a manual-review
  diagnostic.

### What it flags (does not silently rewrite)

- All historical market-data reads (`getBarsV2`, `getMultiBarsV2`, `getTradesV2`,
  …) — return type changed from AsyncGenerator/`Map` to array/object.
- `getLatest*` / `getSnapshot*` — field shapes changed.
- `getNews` / `getCorporateActions` — now return a paginated response object.
- Crypto reads — generated methods need a `loc` parameter.
- `replaceOrder` / `getAssets` / `getPortfolioHistory` bodies — residual
  snake_case keys to camelCase.

Ambiguous binding and receiver patterns are intentionally left unchanged,
including dynamic or member-based `require` wrappers, constructor values passed
through function calls, stream values returned by arbitrary functions, and
handlers called on untraced receivers. Refactor those to a local
`new Alpaca(...)`/stream variable first, or use `--instanceName` when an
identifier is known to be an Alpaca client. Recognized-but-ambiguous `alpaca`
stream accessors/handlers and every unsupported trading-stream
`subscribe(...)` shape (zero/dynamic/spread/
non-trade/multi-channel), plus market-data `subscribe(...)` calls, are left
source-unchanged and reported for manual review in the jscodeshift output.

### After running

1. Review the diff (`git diff`) and resolve every `TODO(alpaca-codemod)`.
2. `grep -rn "alpaca-codemod" src/` to find remaining manual items.
3. Run your type-checker / tests. Remaining references to removed `3.x`
   methods will surface as errors — that's expected and guides the rest.

> The codemod is a starting point, not a guarantee. Always run it on a clean
> git tree.

## `alpaca-v4-to-v5.js`

Migrates the mechanical generated-contract changes from `4.x` to `5.0` and
reports semantic changes that need review. It is intentionally smaller than the
`3.x` transform because the ergonomic client surface is largely stable. Read
the [`4.x` → `5.0` guide](../MIGRATION_V5.md) alongside it.

### Run

```bash
# JavaScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v4-to-v5.js --parser=babel --extensions=js,jsx,mjs,cjs src

# TypeScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v4-to-v5.js --parser=tsx --extensions=ts,tsx,mts,cts src

# Preview without writing
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v4-to-v5.js --parser=tsx --dry --print src/bot.ts
```

When running from a checkout of this repository, use
`-t ./codemods/alpaca-v4-to-v5.js`.

### Options

- `--instanceName=foo,bar` — additional dependency-injected Alpaca client
  identifiers to trust. Each requested name must resolve to exactly one lexical
  binding in a source file; reassigned, shadowed, or otherwise ambiguous
  bindings are ignored. Function parameters are eligible and stable aliases are
  followed. No identifier is trusted from its name unless this option is
  supplied.

### What it rewrites automatically

- Proven generated order body/helper names to `CreateOrderRequest*` and the
  operation wrapper to `PostOrderRequest`.
- `postOrderRequest` to `createOrderRequest` in inline generated order calls,
  preserving shorthand values.
- Generated option-contract, corporate-announcement, position-close response,
  and tokenization issuer symbol names.
- Literal `caTypes: "Dividend,Merger"` CSV values to canonical arrays such as
  `["Dividend", "Merger"]` in announcement calls. Matching is
  case-insensitive; empty or unknown values are left for review.

The old `PostOrderRequest` name is ambiguous: in version 4 it names the order
body, while in version 5 it names the operation wrapper. The transform rewrites
it only when surrounding request syntax proves which meaning is intended and
reports uncertain references for manual review.

### What it flags without silently rewriting

- Removed index-value and crypto perpetual-futures APIs, including the
  generated API constructors (including proven destructuring from the
  `marketData` namespace) and every generated operation / `Raw` sibling.
- `Assets.easyToBorrow` and changed corporate-announcement fields/dates.
- Activity SSE calls, whose return value is now an async subscription with an
  explicit lifecycle rather than an array.
- Trading dividend activity flags used as booleans when their provenance is
  provable; their wire values are the strings `"true"` and `"false"`. Market
  Data corporate-action flags remain booleans and are not flagged.
- `REORG`/`REO` references. Persisted historical `REORG` values are never
  rewritten automatically.
- Variable-backed order and corporate-action request objects. They may be
  shared with non-SDK consumers or modified through property writes, so the
  transform leaves their runtime shape unchanged and marks each SDK call for
  review.

### After running

1. Review the diff and jscodeshift report.
2. Resolve every `TODO(alpaca-codemod)` and any ambiguous generated-type report.
3. Run the type-checker and tests against version 5.

The transform is a safety aid, not a complete semantic migration. Always run it
on a clean version-control branch.

JavaScript users must manually audit response consumers that static provenance
cannot prove. Search for `CorporateAnnouncement` date string operations and its
removed `corporateActionsId` / `expirationDate` fields,
`Assets.easyToBorrow`, and truthiness checks on Trading dividend
`foreign` / `special` string flags. TypeScript users receive compiler
diagnostics for these response-shape changes. The transform intentionally does
not match those property names globally because they may belong to unrelated
application objects.
