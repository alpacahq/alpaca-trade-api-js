# Migration guide: `3.x` → `4.0`

This guide moves you from **`@alpacahq/alpaca-trade-api@3.x`** to the rewritten
stable **`4.x`** SDK.

> **TL;DR**
> - The package name is **unchanged** (`@alpacahq/alpaca-trade-api`). Only the
>   API surface changed.
> - One flat client (`alpaca.getAccount()`) became **two namespaces**:
>   `alpaca.trading.*` and `alpaca.marketData.*`.
> - Every call now takes **a single options object** (no positional args) and
>   uses **camelCase** fields (`timeInForce`, not `time_in_force`).
> - There are **two layers**: an **ergonomic layer** that mirrors the old
>   ergonomics (`alpaca.trading.orders.market({...})`, auto-paginating
>   `alpaca.marketData.getStockBars({...})`) and the lower-level **generated
>   layer** (`postOrder({ postOrderRequest })`). **Prefer the ergonomic layer** —
>   this guide leads with it.
> - Errors are now **typed exceptions that are thrown** (not resolved values).
> - A **codemod** (`codemods/alpaca-v3-to-v4.js`) automates the mechanical
>   ~70% and flags the rest with `// TODO(alpaca-codemod)` comments. See
>   [Automated migration](#automated-migration-codemod).

## Contents

- [Before you start](#before-you-start)
- [Install 4.0](#install-40)
- [The five concepts that changed](#the-five-concepts-that-changed)
- [Client construction](#client-construction)
- [Automated migration (codemod)](#automated-migration-codemod)
- [Trading API, endpoint by endpoint](#trading-api-endpoint-by-endpoint)
  - [Account](#account) · [Account configurations](#account-configurations) ·
    [Account activities](#account-activities) ·
    [Portfolio history](#portfolio-history) · [Orders](#orders) ·
    [Positions](#positions) · [Assets](#assets) · [Calendar](#calendar) ·
    [Clock](#clock) · [Watchlists](#watchlists)
- [Market Data API, endpoint by endpoint](#market-data-api-endpoint-by-endpoint)
  - [Timeframes](#timeframes) · [Stocks](#stock-data) · [Crypto](#crypto-data) ·
    [Options](#options-data) · [News](#news) ·
    [Corporate actions](#corporate-actions) · [What's new](#whats-new-in-market-data)
- [Real-time streaming](#real-time-streaming)
- [Error handling](#error-handling)
- [Semantic changes that need manual review](#semantic-changes-that-need-manual-review)
- [End-to-end example](#end-to-end-example)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Rollback](#rollback)
- [Appendix: full method cross-reference](#appendix-full-method-cross-reference)

## Before you start

- **Node.js >= 20 is required.** The new transport uses the platform-global
  `fetch`/`Headers`/`URL`/`AbortController`. Node 16/18 are no longer supported.
- **Streaming runs on Node and Bun only.** REST works on strict Node projects
  without DOM libs, Deno, Cloudflare Workers, Vercel Edge, and browsers via
  export conditions. Those REST runtimes and declarations do not load or
  require Node, `ws`, or msgpack.
- **The dependency surface shrank.** `axios`, `lodash`, `urljoin`, `dotenv`,
  `msgpack5`, `nats`, etc. are gone. If your code imported those *transitively*
  through this package, add them to your own `package.json`. In particular,
  `dotenv` is no longer auto-loaded — call `import "dotenv/config"` yourself if
  you relied on a `.env` file.
## Install 4.0

Install the stable `4.x` line:

```bash
npm install @alpacahq/alpaca-trade-api@^4
```

If you need both major versions temporarily, install the current release under
an alias:

```bash
npm install alpaca-v4@npm:@alpacahq/alpaca-trade-api@^4
```

```ts
import Alpaca from "@alpacahq/alpaca-trade-api"; // old 3.x, default import
import { Alpaca } from "alpaca-v4";              // new 4.x, named import
```

> Note the import style change: `3.x` ships a **default** export
> (`const Alpaca = require("@alpacahq/alpaca-trade-api")`); `4.x` ships a
> **named** export (`import { Alpaca } from "@alpacahq/alpaca-trade-api"`), and
> is authored in TypeScript with first-class ESM + CJS builds.

## The five concepts that changed

Internalize these five and every endpoint below becomes predictable.

### 1. Namespaces instead of one flat client

There is no flat method surface anymore. Every call lives under `trading` or
`marketData`:

```ts
// 3.x
await alpaca.getAccount();
await alpaca.getBarsV2("AAPL", { timeframe: "1Day" });

// 4.x
await alpaca.trading.account.getAccount();
await alpaca.marketData.getStockBarsFor("AAPL", { timeframe: TimeFrame.Day, start });
```

`alpaca.data` is an alias for `alpaca.marketData`.

### 2. A single options object (no positional args)

```ts
// 3.x — positional
await alpaca.getOrder(orderId);
await alpaca.getPosition("AAPL");

// 4.x — one named object
await alpaca.trading.orders.getOrderByOrderID({ orderId });
await alpaca.trading.positions.getOpenPosition({ symbolOrAssetId: "AAPL" });
```

### 3. camelCase fields

Wire bodies were snake_case; the TS surface is camelCase and the SDK maps it for
you:

| 3.x (snake) | 4.x (camel) |
| --- | --- |
| `time_in_force` | `timeInForce` |
| `limit_price` | `limitPrice` |
| `stop_price` | `stopPrice` |
| `client_order_id` | `clientOrderId` |
| `order_class` | `orderClass` |
| `take_profit` / `stop_loss` | `takeProfit` / `stopLoss` |
| `trail_price` / `trail_percent` | `trailPrice` / `trailPercent` |
| `extended_hours` | `extendedHours` |
| `asset_class` | `assetClass` |
| `date_start` / `date_end` | `start` / `end` |

### 4. Two layers — prefer the ergonomic one

The rewrite is a faithful **generated** OpenAPI client *plus* a hand-written
**ergonomic** layer on top. Both reach the same endpoints.

| | Ergonomic layer (prefer this) | Generated layer (fallback / escape hatch) |
| --- | --- | --- |
| Place order | `alpaca.trading.orders.market({ symbol, side, qty })` | `alpaca.trading.orders.postOrder({ postOrderRequest: {...} })` |
| Close all | `alpaca.trading.closeAllPositions()` | `alpaca.trading.positions.deleteAllOpenPositions()` |
| Multi-symbol bars | `alpaca.marketData.getStockBars({ symbols, timeframe })` (auto-paginates → `{ [symbol]: Bar[] }`) | `alpaca.marketData.stocks.stockBars({ symbols, timeframe })` (one page + `nextPageToken`) |
| Latest price | `alpaca.marketData.getLatestPrice("AAPL")` → `number` | `alpaca.marketData.stocks.stockLatestTradeSingle({ symbol: "AAPL" })` |

The ergonomic layer is the closest match to your old code, so the per-endpoint
sections below lead with it. The generated layer always exists when you need a
field the ergonomic helper doesn't expose.

### 5. Errors are thrown, not returned

`3.x` surfaced raw `axios` errors. `4.x` throws a typed hierarchy
(`ApiError` and subclasses `AuthError`, `PermissionError`, `NotFoundError`,
`ValidationError`, `RateLimitError`, plus `FetchError` for network failures). See
[Error handling](#error-handling).

Two more things became built in, so you can delete hand-rolled versions:

- **Pagination** — ergonomic `get*`/`collect*`/`iterate*` helpers walk
  `nextPageToken` for you.
- **Resilience** — retry (with `Retry-After`), per-attempt timeout, and client
  rate limiting are on by default and configurable in the constructor.

## Client construction

```ts
// 3.x
const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca({
  keyId: "AK...",
  secretKey: "...",   // <-- renamed
  paper: true,
});

// 4.x
import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca({
  keyId: "AK...",
  secret: "...",      // <-- was `secretKey`
  paper: true,        // default is now `true`
});
```

### Constructor option changes

| 3.x | 4.x | Notes |
| --- | --- | --- |
| `keyId` | `keyId` | unchanged (env `APCA_API_KEY_ID`) |
| `secretKey` | **`secret`** | renamed (env `APCA_API_SECRET_KEY`) |
| `oauth` | `accessToken` | env renamed `APCA_API_OAUTH` → `APCA_API_OAUTH_TOKEN`; OAuth clients are REST-only (no streaming) |
| `paper` | `paper` | **default flipped to `true`**. Pass `paper: false` for live. |
| `baseUrl` / `dataBaseUrl` | derived from `paper`/`sandbox` | override per-request via `initOverrides` or `headers`/middleware; you rarely set base URLs now |
| `dataStreamUrl` | `stockStream({ url })` etc. | per-stream `url` override (any stream, market-data included) for proxy/gateway routing |
| `apiVersion` | _(removed)_ | endpoints are versioned in the spec |
| `feed` (ctor) | per-call `feed` / `stockStream({ feed })` | the feed is no longer global state on the client |
| `optionFeed` (ctor) | `optionStream({ feed })` / per-call | as above |
| `verbose` | `middleware: [loggingMiddleware()]` | structured logging via middleware |
| — | `timeoutMs` | new: per-attempt timeout (default 30s; `0` disables) |
| — | `retry` | new: auto-retry safe methods + `Retry-After` (default on; `false` to disable) |
| — | `rateLimit` | new: client-side limiter (~200 req/min default; `false` to disable) |
| — | `middleware` | new: `pre`/`post`/`onError` hooks |
| — | `userAgent`, `headers`, `fetchApi`, `credentials` | new transport knobs |
| — | `sandbox` | new: market-data sandbox host |

### Environment variables

`keyId`/`secret` still fall back to `APCA_API_KEY_ID` / `APCA_API_SECRET_KEY`.
The big difference: **`.env` is no longer loaded for you.** Add this once at your
entrypoint if you depend on it:

```ts
import "dotenv/config";
```

## Automated migration (codemod)

A [jscodeshift](https://github.com/facebook/jscodeshift) codemod ships in the npm
package at
[`codemods/alpaca-v3-to-v4.js`](codemods/alpaca-v3-to-v4.js). It rewrites the
**mechanical** parts of the migration and leaves a `// TODO(alpaca-codemod): ...`
comment everywhere a human needs to verify a semantic change.

### Run it

No install needed — `npx` fetches jscodeshift. The parser and extensions differ
by language, so pick the line for your sources (run on a clean git tree):

```bash
# JavaScript sources
npx jscodeshift -t \
  ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js \
  --parser=babel "src/**/*.js"

# TypeScript sources (both flags are required)
npx jscodeshift -t \
  ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v3-to-v4.js \
  --parser=tsx --extensions=ts,tsx "src/**/*.ts"
```

Against a local checkout of the SDK repo, use
`-t ./codemods/alpaca-v3-to-v4.js`.

Preview without writing by adding `--dry --print`. The `--instanceName=foo,bar`
flag registers extra lexically bound identifiers as Alpaca clients. Variables
initialized with `new` using an SDK-imported `Alpaca` constructor are
auto-detected; a variable merely named `alpaca` is not trusted. See
[`codemods/README.md`](codemods/README.md) for the full reference.

> Always run on a clean git tree and review the diff. The codemod is a
> time-saver, not a substitute for reading this guide.

### What it does automatically

- Renames the constructor option `secretKey` → `secret`.
- Converts default ESM imports and CommonJS default bindings to named `Alpaca`
  bindings while preserving aliases.
- Rewrites the flat trading methods to their namespaced homes and wraps
  positional args into the new options object — `getOrder(id)` →
  `trading.orders.getOrderByOrderID({ orderId: id })`,
  `getPosition(s)` → `trading.positions.getOpenPosition({ symbolOrAssetId: s })`,
  `cancelAllOrders()` → `trading.orders.deleteAllOrders()`, watchlist/asset/
  calendar/clock/config methods, etc.
- Maps `createOrder({...})` to the right **ergonomic builder** based on the
  literal `type` (`type: "market"` → `trading.orders.market({...})`, `"limit"` →
  `.limit`, …) and camelCases the body keys. Non-literal `type` falls back to
  `trading.orders.submit({...})`.
- Renames streaming accessors and handlers (`alpaca.data_stream_v2` →
  `alpaca.marketData.stockStream()`, `onStockTrade` → `onTrade`,
  `onStatuses` → `onStatus`, …). `subscribeForTrades`/`Quotes`/`Bars`/… keep
  their names.

These default ESM/CJS rewrites are binding- and flow-safe. The codemod only
rewrites proven SDK constructors, clients, and stream variables with stable
lexical bindings. Ambiguous, reassigned, shadowed, assignment-proven, or dynamic
`require`/receiver flows remain source-unchanged and are reported for manual
review. Trading `subscribe(...)` changes only when the receiver is a proven
trading stream and the literal channel list is exactly `["trade_updates"]`.

### What it flags for you (does not silently rewrite)

These changed **shape or semantics**, so the codemod renames what it safely can
and inserts a `TODO` rather than risk a runtime bug:

- Historical market data: `getBarsV2`/`getMultiBarsV2`/`getTradesV2`/… changed
  from an **AsyncGenerator / `Map`** to an **array / symbol-keyed object** (see
  [Stocks](#stock-data)). Your `for await` / `.get()` consumption must change.
- `getLatest*` and `getSnapshot*` field shapes changed (e.g. `trade.Price` →
  `trade.p`).
- `getNews` / `getCorporateActions` now return a response object with a
  `nextPageToken`, not a bare array.
- Crypto methods need a `loc` (location) parameter.

A summary of every flagged call is printed at the end of the run.

## Trading API, endpoint by endpoint

Throughout, `alpaca` is `new Alpaca({ keyId, secret, paper: true })`. The
**Recommended** column is the ergonomic call; the prose notes the generated
fallback where useful.

### Account

```ts
// 3.x
const account = await alpaca.getAccount();

// 4.x
const account = await alpaca.trading.account.getAccount();
```

### Account configurations

```ts
// 3.x
const cfg = await alpaca.getAccountConfigurations();
await alpaca.updateAccountConfigurations({ no_shorting: true });

// 4.x
const cfg = await alpaca.trading.accountConfigurations.getAccountConfig();
await alpaca.trading.accountConfigurations.patchAccountConfig({
  accountConfigurations: { noShorting: true }, // body is now wrapped + camelCased
});
```

### Account activities

```ts
// 3.x
const acts = await alpaca.getAccountActivities({
  activityTypes: ["FILL"],
  pageSize: 100,
});

// 4.x — same field names, now namespaced
const acts = await alpaca.trading.accountActivities.getAccountActivities({
  activityTypes: ["FILL"],
  pageSize: 100,
});

// 4.x — let the SDK paginate for you
const all = await alpaca.trading.collectActivities({ activityTypes: ["FILL"] });
for await (const act of alpaca.trading.iterateActivities({ activityTypes: ["FILL"] })) {
  // ...
}
```

There's also `getAccountActivitiesByActivityType({ activityType })` and the
`*ByType` iterate/collect variants.

### Portfolio history

```ts
// 3.x
const hist = await alpaca.getPortfolioHistory({
  date_start: "2024-01-01",
  date_end: "2024-02-01",
  period: "1M",
  timeframe: "1D",
  extended_hours: true,
});

// 4.x — namespaced + camelCase keys
const hist = await alpaca.trading.portfolioHistory.getAccountPortfolioHistory({
  start: "2024-01-01",       // was date_start
  end: "2024-02-01",         // was date_end
  period: "1M",
  timeframe: "1D",
  extendedHours: true,       // was extended_hours
});
```

New optional fields are available too: `intradayReporting`, `pnlReset`,
`cashflowTypes`.

### Orders

Order creation is where the ergonomic layer pays off most. Instead of one
loosely typed `createOrder({...})` where `symbol`/`side`/`qty` were all optional
and only failed at request time, there's **one method per order kind** with the
fields that kind actually needs required at compile time. `timeInForce` defaults
to `"day"`. Amounts accept `number | string`.

#### Create order

```ts
// 3.x — market
await alpaca.createOrder({
  symbol: "AAPL",
  qty: 1,
  side: "buy",
  type: "market",
  time_in_force: "day",
  client_order_id: "rebalance-2026-07-16-aapl-1",
});

// 4.x — market (ergonomic)
await alpaca.trading.orders.market({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  clientOrderId: "rebalance-2026-07-16-aapl-1",
});
```

```ts
// 3.x — limit
await alpaca.createOrder({
  symbol: "AAPL", qty: 1, side: "buy", type: "limit",
  time_in_force: "gtc", limit_price: 150,
});

// 4.x — limit (ergonomic)
await alpaca.trading.orders.limit({
  symbol: "AAPL", side: "buy", qty: 1, limitPrice: 150, timeInForce: "gtc",
});
```

Other kinds map the same way:

| Order kind | 4.x ergonomic call |
| --- | --- |
| market | `orders.market({ symbol, side, qty \| notional })` |
| limit | `orders.limit({ symbol, side, qty, limitPrice })` |
| stop | `orders.stop({ symbol, side, qty, stopPrice })` |
| stop-limit | `orders.stopLimit({ symbol, side, qty, stopPrice, limitPrice })` |
| trailing-stop | `orders.trailingStop({ symbol, side, qty, trailPrice \| trailPercent })` |
| bracket | `orders.bracket({ symbol, side, qty, limitPrice?, takeProfit: { limitPrice }, stopLoss: { stopPrice, limitPrice? } })` |
| OCO | `orders.oco({ symbol, side, qty, takeProfit, stopLoss })` |
| OTO | `orders.oto({ symbol, side, qty, limitPrice?, takeProfit \| stopLoss })` |
| anything exotic (e.g. `mleg`) | `orders.submit({ type, ... })` |

Bracket example:

```ts
// 3.x
await alpaca.createOrder({
  symbol: "AAPL", qty: 1, side: "buy", type: "limit", time_in_force: "gtc",
  order_class: "bracket",
  take_profit: { limit_price: 200 },
  stop_loss: { stop_price: 140, limit_price: 138 },
});

// 4.x
await alpaca.trading.orders.bracket({
  symbol: "AAPL", side: "buy", qty: 1, limitPrice: 150, timeInForce: "gtc",
  takeProfit: { limitPrice: 200 },
  stopLoss: { stopPrice: 140, limitPrice: 138 },
});
```

**Generated fallback** (if you need a field the builder doesn't expose):

```ts
await alpaca.trading.orders.postOrder({
  postOrderRequest: {
    symbol: "AAPL", side: "buy", qty: "1", type: "market", timeInForce: "day",
  },
});
```

**Submission recovery:** pass a stable, unique `clientOrderId` in the order
request body. Alpaca rejects a duplicate client ID; it does not return the
original placement response. The transport never auto-retries the placement
`POST`.

```ts
const clientOrderId = `migration-${crypto.randomUUID()}`;
await alpaca.trading.orders.market({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  clientOrderId,
});

// After an ambiguous transport failure, reconcile before another submission:
const order = await alpaca.trading.orders.getOrderByClientOrderId({
  clientOrderId,
});
```

A lookup miss does not prove the placement failed, and the SDK does not promise
that the record will eventually appear. Apply your application's reconciliation
policy before deciding whether to submit anything else.

#### Read / list / modify / cancel

```ts
// 3.x → 4.x
alpaca.getOrders({ status: "open", limit: 50 })
  → alpaca.trading.orders.getAllOrders({ status: "open", limit: 50 })
    // `symbols` accepts string[] here: { symbols: ["AAPL", "MSFT"] }

alpaca.getOrder(id)
  → alpaca.trading.orders.getOrderByOrderID({ orderId: id })

alpaca.getOrderByClientOrderId(cid)
  → alpaca.trading.orders.getOrderByClientOrderId({ clientOrderId: cid })

alpaca.replaceOrder(id, { qty: 2, limit_price: 151 })
  → alpaca.trading.orders.patchOrderByOrderId({
      orderId: id,
      patchOrderRequest: { qty: 2, limitPrice: 151 }, // camelCase
    })

alpaca.cancelOrder(id)
  → alpaca.trading.orders.deleteOrderByOrderID({ orderId: id })

alpaca.cancelAllOrders()
  → alpaca.trading.orders.deleteAllOrders()
```

#### Place-and-wait

New ergonomic helper — wait for the server's trade-updates listening
acknowledgement, submit one order, and resolve once it reaches a terminal state:

```ts
const filled = await alpaca.trading.submitAndWait(
  {
    type: "market",
    symbol: "AAPL",
    side: "buy",
    qty: 1,
    clientOrderId: `migration-workflow-${crypto.randomUUID()}`,
  },
  { timeoutMs: 30_000 },
);
```

One deadline covers connect, authentication, subscription, REST placement, and
terminal-event waiting. The helper preserves the supplied client ID (or creates
one once), issues one placement per invocation, and does not re-place on stream
reconnect. After an ambiguous `FetchError`, it performs one client-ID lookup;
generic order builders do not. A timeout can still leave the outcome ambiguous,
so this is not an exactly-once execution guarantee.

### Positions

```ts
// 3.x → 4.x
alpaca.getPositions()
  → alpaca.trading.positions.getAllOpenPositions()

alpaca.getPosition("AAPL")
  → alpaca.trading.positions.getOpenPosition({ symbolOrAssetId: "AAPL" })

alpaca.closePosition("AAPL")
  → alpaca.trading.positions.deleteOpenPosition({ symbolOrAssetId: "AAPL" })
    // optional: { qty } or { percentage }

alpaca.closeAllPositions()
  → alpaca.trading.closeAllPositions()                 // ergonomic
  // or: alpaca.trading.positions.deleteAllOpenPositions({ cancelOrders: true })
```

Bonus: options exercise lives here too — `positions.optionExercise({ symbolOrContractId })`.

### Assets

```ts
// 3.x → 4.x
alpaca.getAssets({ status: "active", asset_class: "us_equity" })
  → alpaca.trading.assets.getV2Assets({ status: "active", assetClass: "us_equity" })

alpaca.getAsset("AAPL")
  → alpaca.trading.assets.getV2AssetsSymbolOrAssetId({ symbolOrAssetId: "AAPL" })
```

Options-contract discovery also lives under `trading.assets`
(`getOptionsContracts`, `getOptionContractSymbolOrId`), with
`trading.iterateOptionsContracts` / `collectOptionsContracts` for pagination.

### Calendar

```ts
// 3.x
await alpaca.getCalendar({ start: "2024-01-01", end: "2024-01-31" });

// 4.x — drop-in (v2-compatible)
await alpaca.trading.calendar.legacyCalendar({ start: "2024-01-01", end: "2024-01-31" });

// 4.x — newer v3 endpoint (requires a market)
await alpaca.trading.calendar.calendar({ market: "us_equity", start: "2024-01-01", end: "2024-01-31" });
```

### Clock

```ts
// 3.x
await alpaca.getClock();

// 4.x — drop-in
await alpaca.trading.clock.legacyClock();
// or the newer: alpaca.trading.clock.clock()
```

### Watchlists

```ts
// 3.x → 4.x
alpaca.getWatchlists()
  → alpaca.trading.watchlists.getWatchlists()

alpaca.getWatchlist(id)
  → alpaca.trading.watchlists.getWatchlistById({ watchlistId: id })
    // also: getWatchlistByName({ name })

alpaca.addWatchlist("My list", ["AAPL", "MSFT"])
  → alpaca.trading.watchlists.postWatchlist({
      updateWatchlistRequest: { name: "My list", symbols: ["AAPL", "MSFT"] },
    })

alpaca.addToWatchlist(id, "AAPL")
  → alpaca.trading.watchlists.addAssetToWatchlist({
      watchlistId: id, addAssetToWatchlistRequest: { symbol: "AAPL" },
    })

alpaca.updateWatchlist(id, { name: "New", symbols: ["AAPL"] })
  → alpaca.trading.watchlists.updateWatchlistById({
      watchlistId: id, updateWatchlistRequest: { name: "New", symbols: ["AAPL"] },
    })

alpaca.deleteWatchlist(id)
  → alpaca.trading.watchlists.deleteWatchlistById({ watchlistId: id })

alpaca.deleteFromWatchlist(id, "AAPL")
  → alpaca.trading.watchlists.removeAssetFromWatchlist({ watchlistId: id, symbol: "AAPL" })
```

## Market Data API, endpoint by endpoint

This is the area with the **biggest semantic changes**, so read carefully — the
codemod flags these rather than rewriting them blind.

### Timeframes

```ts
// 3.x
alpaca.newTimeframe(30, alpaca.timeframeUnit.MIN); // -> "30Min"

// 4.x
import { timeFrame, TimeFrame, TimeFrameUnit } from "@alpacahq/alpaca-trade-api";
timeFrame(30, TimeFrameUnit.Minute); // -> "30Min" (branded TimeFrameString)
TimeFrame.Day;                       // -> "1Day" preset
```

Unit renames: `MIN → Minute`, `HOUR → Hour`, `DAY → Day`, `WEEK → Week`,
`MONTH → Month`.

### Stock data

The old `getBarsV2`/`getTradesV2`/`getQuotesV2` returned an **AsyncGenerator**;
the `getMulti*V2` returned a **`Map<string, T[]>`**. The new ergonomic helpers
**auto-paginate** and return a plain **symbol-keyed object** (`{ [symbol]: T[] }`)
or, for a single symbol, a plain **array**. This is the most common thing you'll
hand-edit.

#### Bars

```ts
// 3.x — single symbol, async generator
const bars = [];
for await (const b of alpaca.getBarsV2("AAPL", {
  start: "2024-04-01", end: "2024-04-02",
  timeframe: alpaca.newTimeframe(30, alpaca.timeframeUnit.MIN),
})) {
  bars.push(b);
}

// 4.x — single symbol, returns Bar[] (already paginated)
const bars = await alpaca.marketData.getStockBarsFor("AAPL", {
  start: "2024-04-01", end: "2024-04-02",
  timeframe: timeFrame(30, TimeFrameUnit.Minute),
});
```

Single-symbol `*For` helpers read only the exact requested symbol key. If Alpaca
omits that key, array helpers return `[]` and candle helpers return empty
`Candles`; they never substitute another symbol from the response map.

```ts
// 3.x — multi symbol, Map
const map = await alpaca.getMultiBarsV2(["AAPL", "MSFT"], { start, end, timeframe });
const aapl = map.get("AAPL");

// 4.x — multi symbol, symbol-keyed object
const bySymbol = await alpaca.marketData.getStockBars({
  symbols: ["AAPL", "MSFT"], start, end, timeframe: TimeFrame.Day,
});
const aapl = bySymbol["AAPL"];
```

> **Field shapes also changed.** Old bars used PascalCase
> (`OpenPrice`/`ClosePrice`/`Volume`). The normalized `Bar` from the ergonomic
> helpers is the same canonical shape the streaming clients emit (so REST
> backfill + live updates line up). If you need raw wire keys (`o`/`h`/`l`/`c`/
> `v`/`t`), use the generated `marketData.stocks.stockBars(...)`.

For very large pulls, stream instead of buffering:

```ts
for await (const page of alpaca.marketData.iterateStockBars({ symbols, timeframe, start })) {
  // page is one symbol-keyed chunk
}
```

#### Trades, quotes

`getTradesV2`/`getQuotesV2` → `getStockTradesFor` / `getStockTrades` (and the
`*Quotes` equivalents), same generator-→-array/object change as bars.

#### Latest & snapshots

```ts
// 3.x → 4.x
alpaca.getLatestTrade("AAPL")
  → alpaca.marketData.stocks.stockLatestTradeSingle({ symbol: "AAPL" })
  // just the price? -> alpaca.marketData.getLatestPrice("AAPL") -> number

alpaca.getLatestTrades(["AAPL", "MSFT"])      // was Map
  → alpaca.marketData.stocks.stockLatestTrades({ symbols: ["AAPL", "MSFT"] }) // -> { trades: {...} }

alpaca.getLatestQuote / getLatestQuotes
  → stocks.stockLatestQuoteSingle / stockLatestQuotes
alpaca.getLatestBar / getLatestBars
  → stocks.stockLatestBarSingle / stockLatestBars
alpaca.getSnapshot("TSLA")
  → alpaca.marketData.stocks.stockSnapshotSingle({ symbol: "TSLA" })
alpaca.getSnapshots(["TSLA"])
  → alpaca.marketData.stocks.stockSnapshots({ symbols: ["TSLA"] })
```

> The `feed` (`iex`/`sip`/`delayed_sip`) is now a per-call field (e.g.
> `{ symbols, feed: "sip" }`) instead of client-wide constructor state.

### Crypto data

Same generator-→-object change as stocks, **plus** a required `loc` (location,
e.g. `"us"`) parameter on the generated methods.

```ts
// 3.x → 4.x
alpaca.getCryptoBars(["BTC/USD"], { start, end, timeframe })   // AsyncGenerator
  → alpaca.marketData.getCryptoBars({ symbols: ["BTC/USD"], start, end, timeframe })
    // -> { [symbol]: Bar[] }, auto-paginated

alpaca.getLatestCryptoTrades(["BTC/USD"])                      // Map
  → alpaca.marketData.crypto.cryptoLatestTrades({ loc: "us", symbols: ["BTC/USD"] })

alpaca.getLatestCryptoQuotes / getLatestCryptoBars
  → crypto.cryptoLatestQuotes / cryptoLatestBars ({ loc, symbols })
alpaca.getCryptoSnapshots
  → crypto.cryptoSnapshots({ loc, symbols })
alpaca.getCryptoOrderbooks
  → crypto.cryptoLatestOrderbooks({ loc, symbols })
```

### Options data

```ts
// 3.x → 4.x
alpaca.getOptionChain("AAPL", { ... })
  → alpaca.marketData.options.optionChain({ underlyingSymbol: "AAPL", ... })

alpaca.getOptionBars(symbols, opts)      → options.optionBars({ symbols, timeframe, ... })
alpaca.getOptionTrades(symbols, opts)    → options.optionTrades({ symbols, ... })
alpaca.getOptionLatestTrades(symbols)    → options.optionLatestTrades({ symbols })
alpaca.getOptionLatestQuotes(symbols)    → options.optionLatestQuotes({ symbols })
alpaca.getOptionSnapshots(symbols)       → options.optionSnapshots({ symbols })
```

### News

```ts
// 3.x — returned an array
const news = await alpaca.getNews({ symbols: ["AAPL"] });
console.log(news[0]);

// 4.x — returns a response object with pagination
const resp = await alpaca.marketData.news.news({ symbols: ["AAPL"] });
console.log(resp.news[0]);
// or collect across pages:
const all = await alpaca.marketData.collectNews({ symbols: ["AAPL"] });
```

### Corporate actions

```ts
// 3.x → 4.x
alpaca.getCorporateActions(symbols, opts)
  → alpaca.marketData.corporateActions.corporateActions({ symbols, types, start, end, ... })
  // paginate: alpaca.marketData.collectCorporateActions({ ... })
```

### What's new in market data

Endpoints that didn't exist in `3.x` and are now available under
`alpaca.marketData`: **forex** (`rates`, `latestRates`), **indices**
(`indexValues`, `indexLatestValues`), **crypto perpetual futures**, **fixed
income**, a **screener** (`mostActives`, `movers`), and **logos**. Plus
chart-ready reshapers: `getStockCandles` / `getCryptoCandles` and the
`toCandles` / `toCandlestickSeries` / `toLineSeries` helpers.

Market-data timestamps also gained an additive `timestampRaw?: string`
(RFC-3339, **nanosecond** precision) on both the REST canonical `Bar`/`Trade`/
`Quote` shapes and the live stream events. This resolves the `3.x`
nanosecond-truncation issue (timestamps were cast to a millisecond `Date`, losing
precision). `timestamp` remains a millisecond `Date`, so no migration is required
— read `timestampRaw` only when you need the exact instant Alpaca reported. The
canonical **index-value** (`getIndexValues`) and **stock-auction**
(`getStockAuctions`) accessors carry the same `timestampRaw`.

Trade ids are 64-bit integers that can exceed JavaScript's safe integer range
(`2^53`) — notably crypto trade ids. Both the live market-data stream **and** the
REST canonical trade accessors now expose an exact string alongside the numeric
field — additive, so no migration is required:

- REST canonical trades (`getStockTrades`/`getCryptoTrades`): `idRaw?: string`
  next to `id: number`.
- Stream trades / cancel-errors: `idRaw?: string` next to `id: number`.
- Stream corrections: `originalIdRaw?` / `correctedIdRaw?` next to the numeric ids.
- Stream news: `idRaw?: string` next to `id: number`.

Use `idRaw` when you compare, store, or key on an id. The REST market-data
transport now parses JSON losslessly to make this possible; the one runtime
consequence is that on the **raw** generated models an id past `2^53` (in
practice a crypto trade `.i`) surfaces as a `string` rather than a lossy
`number`. Prefer the canonical accessors (both `id` and `idRaw`), or read the raw
`.i` as the exact string; stock/option ids, news ids, sizes, volumes, and counts
are unaffected.

## Real-time streaming

The model is still **EventEmitter-based** (`connect()`, `onConnect`, subscribe,
typed handlers), so the shape of your code barely changes. Two differences:

1. Streams are now **created by a factory method** instead of being pre-built
   properties on the client. (`alpaca.data_stream_v2` →
   `alpaca.marketData.stockStream({ feed })`.)
2. The **per-channel handlers were renamed** to drop the `Stock` prefix and
   singularize (`onStockTrade` → `onTrade`, `onStatuses` → `onStatus`). The
   `subscribeForTrades`/`Quotes`/`Bars`/… names are **unchanged**.

### Market data stream

```ts
// 3.x
const ws = alpaca.data_stream_v2;
ws.onConnect(() => ws.subscribeForTrades(["AAPL"]));
ws.onStockTrade((t) => console.log(t));
ws.onError((e) => console.error(e));
ws.connect();

// 4.x
const ws = alpaca.marketData.stockStream({ feed: "iex" });
ws.onConnect(() => ws.subscribeForTrades(["AAPL"])); // same subscribe names
ws.onTrade((t) => console.log(t));                    // was onStockTrade
ws.onError((e) => console.error(e));
ws.connect();
```

Handler rename table:

| 3.x | 4.x |
| --- | --- |
| `onStockTrade` | `onTrade` |
| `onStockQuote` | `onQuote` |
| `onStockBar` | `onBar` |
| `onStockUpdatedBar` | `onUpdatedBar` |
| `onStockDailyBar` | `onDailyBar` |
| `onStatuses` | `onStatus` |
| `onLulds` | `onLuld` |
| — | `onOrderbook`, `onNews` (new) |

`onConnect` / `onDisconnect` / `onStateChange` / `onError` and
`connect` / `disconnect` are unchanged.

### Crypto / news / options streams

```ts
// 3.x → 4.x (all are factory methods now)
alpaca.crypto_stream_v1beta3 → alpaca.marketData.cryptoStream()
alpaca.news_stream           → alpaca.marketData.newsStream()
alpaca.option_stream         → alpaca.marketData.optionStream({ feed: "indicative" })
```

> Crypto and news streams are **production-only** (no sandbox endpoint). The
> client's `sandbox` flag is not applied to them, and `cryptoStream({ sandbox: true })`
> / `newsStream({ sandbox: true })` throw — pass an explicit `url` to override.

### New streaming capabilities in 4.x

These are additive — existing 3.x-style code keeps working — but worth adopting:

- **Awaitable auth.** `await stream.whenAuthenticated()` resolves with a typed
  `StreamAuthResult` (`{ status, authenticated, code?, message }`); failures use
  a `STREAM_AUTH_STATUS` (`server_rejected` with the server code, `closed`,
  `timeout`). `waitForAuthentication(timeoutMs?)` returns a `boolean`.
- **Reconnect lifecycle.** `onReconnecting((attempt) => …)` (1-based) and
  `onReconnected(() => …)` after re-authentication and re-subscription dispatch,
  distinct from the first `onConnect`. It does not promise server subscription
  acknowledgement.
- **Custom `url`** on any stream and a **`callbackExecutor`** option to offload
  listener work; a throwing listener is logged and can't break the stream.
- **Subscription validation.** Blank/non-string symbols throw at the call site.

Lifecycle work is socket-generation scoped: stale callbacks/timers cannot
mutate a replacement connection, pings start only while open, and manual
disconnect emits once. Malformed/decode/mapper failures and trading
`action: "error"` frames surface through `onError` / `CLIENT_ERROR` without
crashing the process.

### Trade updates (account stream)

```ts
// 3.x
const tws = alpaca.trade_ws;
tws.onConnect(() => tws.subscribe(["trade_updates"]));
tws.onOrderUpdate((u) => console.log(u));
tws.connect();

// 4.x
const tws = alpaca.trading.stream();
tws.onConnect(() => tws.subscribeTradeUpdates());
tws.onTradeUpdate((u) => console.log(u.event, u.order.symbol)); // u.order is a typed Order
tws.connect();
```

> Streaming requires `keyId` + `secret` (OAuth-only clients can't stream), and
> runs on Node/Bun only.

## Error handling

`3.x` rejected with raw `axios` errors (`err.response.status`,
`err.response.data`). `4.x` throws a typed hierarchy you can branch on with
`instanceof`:

```ts
import {
  ApiError, AuthError, PermissionError, NotFoundError,
  ValidationError, RateLimitError, FetchError,
} from "@alpacahq/alpaca-trade-api";

try {
  await alpaca.trading.orders.market({ symbol: "AAPL", side: "buy", qty: 1 });
} catch (err) {
  if (err instanceof RateLimitError) {
    // err.retryAfterMs, err.rateLimit
  } else if (err instanceof ValidationError) {
    // 400/422 — bad order params
  } else if (err instanceof AuthError) {
    // 401 — bad credentials
  } else if (err instanceof ApiError) {
    // any other non-2xx: err.status, err.code, err.requestId
  } else if (err instanceof FetchError) {
    // network/abort, no HTTP response
  }
}
```

| HTTP | Error class |
| --- | --- |
| 400 / 422 | `ValidationError` |
| 401 | `AuthError` |
| 403 | `PermissionError` (adds a SIP/subscription hint where relevant) |
| 404 | `NotFoundError` |
| 429 | `RateLimitError` |
| other non-2xx | `ApiError` |
| network / abort | `FetchError` |

The same error classes are thrown from `trading.*`, `marketData.*`, and the
top-level `errors` namespace — `instanceof` works across all of them.

## Semantic changes that need manual review

A focused checklist of things a find-and-replace (or the codemod) **cannot**
safely do for you:

1. **AsyncGenerator → array/object.** Old `for await (const b of getBarsV2(...))`
   loops must become iteration over the returned `Bar[]` / `{ [symbol]: Bar[] }`.
   If you want streaming semantics back, use `iterateStockBars`.
2. **`Map` → plain object.** `result.get("AAPL")` becomes `result["AAPL"]`.
3. **Bare array → response object.** `getNews(...)` and `getCorporateActions(...)`
   now return `{ news, nextPageToken }` / `{ ..., nextPageToken }`. Use the
   `collect*` helpers if you want the merged array back.
4. **Field shapes.** Latest/snapshot/bar fields moved from PascalCase
   (`trade.Price`) to canonical/wire keys (`trade.p`, or normalized `Bar`).
5. **Crypto `loc`.** Generated crypto methods need `{ loc: "us", ... }`.
6. **Manual retry/backoff/rate-limit code.** Likely now redundant — the client
   does it. Delete or reconcile with the `retry`/`rateLimit` options.
7. **`.env` auto-loading.** Add `import "dotenv/config"` if you relied on it.
8. **Pagination loops.** All token/cursor helpers now stop before refetching any
   previously visited value (including longer cycles), after yielding valid
   pages already fetched.
9. **Timeout scope.** `timeoutMs` is a fresh per-attempt budget covering
   rate-limit wait, middleware, fetch, and success/error body reads. Retry
   backoff is outside that budget, while caller cancellation spans the whole
   operation/backoff; all cancellation phases throw `FetchError` with an
   `AbortError`/`TimeoutError` cause. `POST` remains non-retryable.

## End-to-end example

A small "buy and watch" script, before and after.

```js
// ===== 3.x =====
const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca({ keyId: K, secretKey: S, paper: true });

(async () => {
  const account = await alpaca.getAccount();
  console.log("buying power", account.buying_power);

  const order = await alpaca.createOrder({
    symbol: "AAPL", qty: 1, side: "buy", type: "market", time_in_force: "day",
    client_order_id: "buy-and-watch-aapl-1",
  });

  const ws = alpaca.trade_ws;
  ws.onConnect(() => ws.subscribe(["trade_updates"]));
  ws.onOrderUpdate((u) => {
    if (u.order.id === order.id && u.event === "fill") {
      console.log("filled at", u.order.filled_avg_price);
    }
  });
  ws.connect();
})();
```

```ts
// ===== 4.x =====
import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca({ keyId: K, secret: S, paper: true });

const account = await alpaca.trading.account.getAccount();
console.log("buying power", account.buyingPower);

// submit and wait for a terminal state in one call:
const filled = await alpaca.trading.submitAndWait({
  type: "market", symbol: "AAPL", side: "buy", qty: 1,
  clientOrderId: "buy-and-watch-aapl-1",
});
console.log("filled at", filled.filledAvgPrice);
```

## Troubleshooting & FAQ

**`TypeError: Alpaca is not a constructor`** — you're using the old default
import. Switch to the named import: `import { Alpaca } from "@alpacahq/alpaca-trade-api"`
(or `const { Alpaca } = require(...)`).

**`alpaca.getAccount is not a function`** — flat methods are gone; use
`alpaca.trading.account.getAccount()`. See the [appendix](#appendix-full-method-cross-reference).

**My credentials stopped working / `AuthError`** — you probably still pass
`secretKey`. It's `secret` now.

**`undefined` reading my `.env` values** — `.env` is no longer auto-loaded; add
`import "dotenv/config"`.

**`for await` no longer works on bars** — historical data is no longer an async
generator. Iterate the returned array/object, or use `iterateStockBars`.

**`result.get(...)` is not a function** — multi-symbol results are plain objects
now: `result["AAPL"]`.

**Streaming throws on Deno/Edge/browser** — streaming is Node/Bun only; REST
still works on those runtimes.

**Where did method X go?** — call `findCapabilities("getAccount")` or
`findErgonomic("market")` from the `capabilities` namespace at runtime, or check
the appendix.

## Rollback

If you need to roll back during migration, install the previous major
explicitly:

```bash
npm install @alpacahq/alpaca-trade-api@^3
```

Pin exact versions in `package.json` when your deployment process requires
fully deterministic dependency upgrades.

## Appendix: full method cross-reference

Ergonomic call is listed where one exists; otherwise the generated method.

### Trading

| 3.x | 4.x |
| --- | --- |
| `getAccount()` | `trading.account.getAccount()` |
| `getAccountConfigurations()` | `trading.accountConfigurations.getAccountConfig()` |
| `updateAccountConfigurations(c)` | `trading.accountConfigurations.patchAccountConfig({ accountConfigurations: c })` |
| `getAccountActivities(o)` | `trading.accountActivities.getAccountActivities(o)` |
| `getPortfolioHistory(o)` | `trading.portfolioHistory.getAccountPortfolioHistory(o')` (rename `date_start`/`date_end`/`extended_hours`) |
| `createOrder({type:"market",...})` | `trading.orders.market({...})` |
| `createOrder({type:"limit",...})` | `trading.orders.limit({...})` |
| `createOrder({type:"stop",...})` | `trading.orders.stop({...})` |
| `createOrder({type:"stop_limit",...})` | `trading.orders.stopLimit({...})` |
| `createOrder({type:"trailing_stop",...})` | `trading.orders.trailingStop({...})` |
| `createOrder({order_class:"bracket",...})` | `trading.orders.bracket({...})` |
| `getOrders(o)` | `trading.orders.getAllOrders(o)` |
| `getOrder(id)` | `trading.orders.getOrderByOrderID({ orderId: id })` |
| `getOrderByClientOrderId(c)` | `trading.orders.getOrderByClientOrderId({ clientOrderId: c })` |
| `replaceOrder(id, b)` | `trading.orders.patchOrderByOrderId({ orderId: id, patchOrderRequest: b' })` |
| `cancelOrder(id)` | `trading.orders.deleteOrderByOrderID({ orderId: id })` |
| `cancelAllOrders()` | `trading.orders.deleteAllOrders()` |
| `getPositions()` | `trading.positions.getAllOpenPositions()` |
| `getPosition(s)` | `trading.positions.getOpenPosition({ symbolOrAssetId: s })` |
| `closePosition(s)` | `trading.positions.deleteOpenPosition({ symbolOrAssetId: s })` |
| `closeAllPositions()` | `trading.closeAllPositions()` |
| `getAssets(o)` | `trading.assets.getV2Assets(o')` (`asset_class`→`assetClass`) |
| `getAsset(s)` | `trading.assets.getV2AssetsSymbolOrAssetId({ symbolOrAssetId: s })` |
| `getCalendar(o)` | `trading.calendar.legacyCalendar(o)` |
| `getClock()` | `trading.clock.legacyClock()` |
| `getWatchlists()` | `trading.watchlists.getWatchlists()` |
| `getWatchlist(id)` | `trading.watchlists.getWatchlistById({ watchlistId: id })` |
| `addWatchlist(n, s)` | `trading.watchlists.postWatchlist({ updateWatchlistRequest: { name: n, symbols: s } })` |
| `addToWatchlist(id, sym)` | `trading.watchlists.addAssetToWatchlist({ watchlistId: id, addAssetToWatchlistRequest: { symbol: sym } })` |
| `updateWatchlist(id, b)` | `trading.watchlists.updateWatchlistById({ watchlistId: id, updateWatchlistRequest: b })` |
| `deleteWatchlist(id)` | `trading.watchlists.deleteWatchlistById({ watchlistId: id })` |
| `deleteFromWatchlist(id, sym)` | `trading.watchlists.removeAssetFromWatchlist({ watchlistId: id, symbol: sym })` |

### Market data

| 3.x | 4.x |
| --- | --- |
| `getBarsV2(s, o)` | `marketData.getStockBarsFor(s, o')` → `Bar[]` |
| `getMultiBarsV2(ss, o)` | `marketData.getStockBars({ symbols: ss, ...o' })` → `{ [sym]: Bar[] }` |
| `getMultiBarsAsyncV2(ss, o)` | `marketData.iterateStockBars({ symbols: ss, ...o' })` |
| `getTradesV2(s, o)` | `marketData.getStockTradesFor(s, o')` |
| `getMultiTradesV2(ss, o)` | `marketData.getStockTrades({ symbols: ss, ...o' })` |
| `getQuotesV2` / `getMultiQuotesV2` | `marketData.getStockQuotesFor` / `getStockQuotes` |
| `getLatestTrade(s)` | `marketData.stocks.stockLatestTradeSingle({ symbol: s })` / `getLatestPrice(s)` |
| `getLatestTrades(ss)` | `marketData.stocks.stockLatestTrades({ symbols: ss })` |
| `getLatestQuote(s)` / `getLatestQuotes(ss)` | `stocks.stockLatestQuoteSingle` / `stockLatestQuotes` |
| `getLatestBar(s)` / `getLatestBars(ss)` | `stocks.stockLatestBarSingle` / `stockLatestBars` |
| `getSnapshot(s)` / `getSnapshots(ss)` | `stocks.stockSnapshotSingle` / `stockSnapshots` |
| `getCryptoBars(ss, o)` | `marketData.getCryptoBars({ symbols: ss, ...o' })` |
| `getLatestCryptoTrades(ss)` | `marketData.crypto.cryptoLatestTrades({ loc, symbols: ss })` |
| `getLatestCryptoQuotes` / `getLatestCryptoBars` | `crypto.cryptoLatestQuotes` / `cryptoLatestBars` |
| `getCryptoSnapshots(ss)` | `crypto.cryptoSnapshots({ loc, symbols: ss })` |
| `getCryptoOrderbooks(ss)` | `crypto.cryptoLatestOrderbooks({ loc, symbols: ss })` |
| `getOptionChain(u, o)` | `marketData.options.optionChain({ underlyingSymbol: u, ...o })` |
| `getOptionBars` / `getOptionTrades` | `options.optionBars` / `options.optionTrades` |
| `getOptionLatestTrades` / `getOptionLatestQuotes` | `options.optionLatestTrades` / `optionLatestQuotes` |
| `getOptionSnapshots` | `options.optionSnapshots` |
| `getNews(o)` | `marketData.news.news(o)` / `marketData.collectNews(o)` |
| `getCorporateActions(ss, o)` | `marketData.corporateActions.corporateActions({ symbols: ss, ...o })` |
| `newTimeframe(n, u)` | `timeFrame(n, u')` |
| `timeframeUnit` | `TimeFrameUnit` |

### Streaming

| 3.x | 4.x |
| --- | --- |
| `alpaca.data_stream_v2` | `alpaca.marketData.stockStream({ feed })` |
| `alpaca.crypto_stream_v1beta3` | `alpaca.marketData.cryptoStream()` |
| `alpaca.news_stream` | `alpaca.marketData.newsStream()` |
| `alpaca.option_stream` | `alpaca.marketData.optionStream({ feed })` |
| `alpaca.trade_ws` | `alpaca.trading.stream()` |
| `.onStockTrade` / `onStockQuote` / `onStockBar` | `.onTrade` / `onQuote` / `onBar` |
| `.onStockUpdatedBar` / `onStockDailyBar` | `.onUpdatedBar` / `onDailyBar` |
| `.onStatuses` / `onLulds` | `.onStatus` / `onLuld` |
| `.onOrderUpdate` (trade_ws) | `.onTradeUpdate` |
| `.subscribe(["trade_updates"])` | `.subscribeTradeUpdates()` |

---

Questions or a gap in this guide? Open an issue on
[alpaca-trade-api-js](https://github.com/alpacahq/alpaca-trade-api-js).












