# Codemods

Automated migration helpers for `@alpacahq/alpaca-trade-api`, built on
[jscodeshift](https://github.com/facebook/jscodeshift).

## `alpaca-v3-to-v4.js`

Migrates source from the stable `3.x` SDK to the `4.0` rewrite. It performs the
**mechanical** transforms and inserts `// TODO(alpaca-codemod): ...` comments
where a change is **semantic** and needs a human. Read
[`../MIGRATION.md`](../MIGRATION.md) alongside it.

### Run

```bash
# JavaScript sources
npx jscodeshift -t codemods/alpaca-v3-to-v4.js --parser=babel "src/**/*.js"

# TypeScript sources
npx jscodeshift -t codemods/alpaca-v3-to-v4.js --parser=tsx --extensions=ts,tsx "src/**/*.ts"

# Preview without writing
npx jscodeshift -t codemods/alpaca-v3-to-v4.js --parser=babel --dry --print src/bot.js
```

You can also point `-t` at the raw file on GitHub instead of a local checkout:

```bash
npx jscodeshift -t \
  https://raw.githubusercontent.com/alpacahq/alpaca-trade-api-js/ts-alpha/codemods/alpaca-v3-to-v4.js \
  --parser=babel "src/**/*.js"
```

### Options

- `--instanceName=foo,bar` — additional identifiers to treat as an Alpaca
  client. The codemod already auto-detects variables initialized with
  `new Alpaca(...)` and the name `alpaca`.

### What it rewrites automatically

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
  `subscribe(["trade_updates"])` → `subscribeTradeUpdates()`.

### What it flags (does not silently rewrite)

- All historical market-data reads (`getBarsV2`, `getMultiBarsV2`, `getTradesV2`,
  …) — return type changed from AsyncGenerator/`Map` to array/object.
- `getLatest*` / `getSnapshot*` — field shapes changed.
- `getNews` / `getCorporateActions` — now return a paginated response object.
- Crypto reads — generated methods need a `loc` parameter.
- `replaceOrder` / `getAssets` / `getPortfolioHistory` bodies — residual
  snake_case keys to camelCase.

### After running

1. Review the diff (`git diff`) and resolve every `TODO(alpaca-codemod)`.
2. `grep -rn "alpaca-codemod" src/` to find remaining manual items.
3. Run your type-checker / tests. Remaining references to removed `3.x`
   methods will surface as errors — that's expected and guides the rest.

> The codemod is a starting point, not a guarantee. Always run it on a clean
> git tree.
