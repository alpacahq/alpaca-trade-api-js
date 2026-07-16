# Codemods

Automated migration helpers for `@alpacahq/alpaca-trade-api`, built on
[jscodeshift](https://github.com/facebook/jscodeshift).

## `alpaca-v3-to-v4.js`

Migrates source from the stable `3.x` SDK to the `4.0` rewrite. It performs the
**mechanical** transforms and inserts `// TODO(alpaca-codemod): ...` comments
where a change is **semantic** and needs a human. Read
[`../MIGRATION.md`](../MIGRATION.md) alongside it. Both this guide and the
codemod are included in the published npm package.

### Run

```bash
# JavaScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js --parser=babel "src/**/*.js"

# TypeScript sources
npx jscodeshift -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js --parser=tsx --extensions=ts,tsx "src/**/*.ts"

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
