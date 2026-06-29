# @alpacahq/alpaca-ts-alpha

A single Node.js TypeScript SDK for the Alpaca **Trading API** and **Market Data
API**. Both APIs live under their own namespace (`trading` / `marketData`) in one
package, fronted by a unified `Alpaca` client with typed errors, resilience
(retry / timeout / rate limiting), pagination helpers, ergonomic order builders,
and real-time streaming.

## Requirements

- **Node.js** >= 20 (developed against v24) — the REST transport uses the
  platform-global `fetch`, `Headers`, `URL`, and `AbortController`. (Node 18
  reached end-of-life in April 2025; the package declares `engines.node >=20`.)

## Runtime compatibility

| Runtime | REST | Streaming | Notes |
| --- | :---: | :---: | --- |
| **Node.js** >= 20 | ✅ | ✅ | Primary target. |
| **Bun** | ✅ | ✅ | Node-compatible (`ws` runs). |
| **Deno** | ✅ | ❌ | Root auto-resolves to the REST build via the `deno` export condition. |
| **Cloudflare Workers** / `workerd` | ✅ | ❌ | Root auto-resolves to the REST build (`workerd` / `worker`). |
| **Vercel Edge** | ✅ | ❌ | Root auto-resolves to the REST build (`edge-light`). |
| **Browser** | ✅ | ❌ | Resolves to the REST build (`browser`). Not recommended — see caveat. |

Legend: ✅ supported · ❌ not supported.

- **Streaming is Node/Bun only.** The WebSocket clients depend on
  [`ws`](https://github.com/websockets/ws) and `node:events`, which don't run on
  edge or in the browser. On those targets the package's
  [export conditions](#edge--browser-runtimes) transparently resolve the root
  import to the streaming-free [REST build](#rest-only-entrypoint), so REST works
  and the stream factories (`stockStream`, `stream`, ...) plus `submitAndWait`
  throw if called. For real-time streaming, run on Node or Bun.
- **Browser: technically works, but discouraged.** Calling Alpaca directly from a
  browser ships your `APCA_API_SECRET_KEY` to the client. Prefer a server or
  proxy (see [`examples/marketdata-backend.ts`](./examples/marketdata-backend.ts))
  rather than embedding credentials in front-end code.

## Install

```bash
npm install @alpacahq/alpaca-ts-alpha
```

## Install the agent skill

Building on this SDK with an AI coding agent? This repo ships an
[Agent Skill](https://agentskills.io) that teaches agents the SDK's mental
model, idioms, and where to look. Install it with the open `skills` CLI — it
auto-detects your agent (Claude Code, Cursor, Codex, …) and installs there:

```bash
npx skills add alpacahq/alpaca-ts-alpha
```

The skill lives at
[`skills/alpaca-ts-alpha-sdk/SKILL.md`](./skills/alpaca-ts-alpha-sdk/SKILL.md).


## Quick start: the `Alpaca` client

The SDK ships ~16 trading and ~11 market-data `Api` classes. The `Alpaca` client
bundles all of them (plus the real-time streams) behind a single constructor:
pass credentials once and reach everything through the `.trading` and
`.marketData` namespaces. Sub-APIs are created lazily and memoized.

```ts
import { Alpaca } from "@alpacahq/alpaca-ts-alpha";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
  paper: true, // default; set false for live trading
});

// REST — no manual Configuration / Api wiring
const account = await alpaca.trading.account.getAccount();
const positions = await alpaca.trading.positions.getAllOpenPositions();

// Ergonomic order placement (see "Placing orders")
await alpaca.trading.orders.market({ symbol: "AAPL", qty: 1, side: "buy" });

// Streaming — shares the same credentials (market data ignores paper/live)
const bars = alpaca.marketData.stockStream({ feed: "iex" });
bars.onBar((b) => console.log(b.symbol, b.close));
bars.onConnect(() => bars.subscribeForBars(["AAPL", "MSFT"]));
bars.connect();
```

The `paper` flag controls the trading REST host (`paper-api` vs `api`) and the
default trading-updates stream endpoint; market data always uses
`data.alpaca.markets`. The `trading` / `marketData` namespaces remain available
if you prefer to construct `Api` classes yourself:

```ts
import { trading, marketData } from "@alpacahq/alpaca-ts-alpha";

const orders = new trading.OrdersApi(new trading.Configuration({ keyId, secret }));
const stocks = new marketData.StockApi(new marketData.Configuration({ keyId, secret }));
```

## How the facade is organized

The `Alpaca` client is **two layers**, and knowing the rule is the whole mental
model:

1. **Generated (always present, uniform).** Every generated REST method is
   reachable raw at `alpaca.<group>.<resource>.<method>(...)` — e.g.
   `alpaca.trading.assets.getV2Assets()` or `alpaca.marketData.stocks.stockBars(...)`.
   Nothing is ever hidden or removed.
2. **Ergonomic (additive, never replaces layer 1).** A curated set of
   hand-written conveniences sits on top: order builders, normalized
   market-data accessors, pagination, and workflow helpers. They are *additions*
   — the raw method each one builds on is still there.

So the rule you can rely on: **if there's no ergonomic helper for what you need,
the raw generated method is always available.** You never have to guess whether
a resource is "ergonomic" or "raw" — it's both.

Three maps make this queryable (each also has a lookup):

| Layer | Map | Lookup |
| --- | --- | --- |
| Generated methods | `capabilities` | `findCapabilities("getAccount")` |
| Ergonomic helpers | `ergonomicCapabilities` | `findErgonomic("market")` |
| Real-time streams | `streamingCapabilities` | — |

The ergonomic layer follows predictable naming conventions, so helpers are
guessable:

- **Order builders:** one verb method per kind on `trading.orders` (`market`,
  `limit`, `stop`, `stopLimit`, `trailingStop`, `bracket`, `oco`, `oto`), plus a
  generic `submit` escape hatch.
- **Normalized REST:** `get<Asset><Thing>` returns canonical, symbol-keyed
  shapes (`getStockBars`, `getCryptoTrades`, ...); `get<Asset>Candles` returns
  the chart-ready columnar form. Each has a single-symbol `get<Asset><Thing>For(symbol)`
  variant (`getStockBarsFor`, `getStockCandlesFor`, ...) that returns the
  unwrapped value instead of a `{ [symbol]: ... }` map.
- **Pagination:** `iterate<X>` lazily yields across pages; `collect<X>` /
  `collect<X>BySymbol` eagerly returns them.
- **Workflow:** verb-named one-offs (`submitAndWait`, `closeAllPositions`,
  `getLatestPrice`).

## Authentication

Alpaca authenticates with two distinct headers (`APCA-API-KEY-ID` and
`APCA-API-SECRET-KEY`). Pass `keyId` and `secret` directly.

```ts
const alpaca = new Alpaca({ keyId, secret });
```

### Environment variables

Any credential may be omitted and resolved from the standard Alpaca environment
variables; explicitly-passed values always win.

| Option        | Environment variable    |
| ------------- | ----------------------- |
| `keyId`       | `APCA_API_KEY_ID`       |
| `secret`      | `APCA_API_SECRET_KEY`   |
| `accessToken` | `APCA_API_OAUTH_TOKEN`  |

```ts
// With APCA_API_KEY_ID and APCA_API_SECRET_KEY set in the environment:
const alpaca = new Alpaca();
```

### OAuth

Pass an `accessToken` to authenticate via OAuth2; it is sent as
`Authorization: Bearer <token>`. OAuth is mutually exclusive with `keyId`/`secret`
and takes precedence over them.

```ts
const alpaca = new Alpaca({ accessToken });
```

> Real-time streaming authenticates with a key/secret pair, so OAuth-only
> clients cannot open WebSocket streams.

> Do **not** pass `apiKey` as a plain string — it would send the same value for
> both headers and Alpaca would reject it. The SDK throws a guided error if you
> try. To compute credentials lazily (e.g. from a vault), use the helper:
>
> ```ts
> import { trading, auth } from "@alpacahq/alpaca-ts-alpha";
> const config = new trading.Configuration({ apiKey: auth.apiKeyAuth({ keyId, secret }) });
> ```

## Paper vs live

Trading defaults to **paper**. Switching to live is a deliberate flag, never an
accidental missing host:

```ts
const live = new Alpaca({ keyId, secret, paper: false });
```

Named hosts are exported too: `trading.TRADING_PAPER_HOST`,
`trading.TRADING_LIVE_HOST`, `marketData.MARKET_DATA_HOST`.

## Resilience & configuration

All options below are optional and conservative by default. On the `Alpaca`
client they are passed at the top level; on a raw `Configuration` they are
identical fields.

```ts
const alpaca = new Alpaca({
  keyId,
  secret,

  // Abort a stalled request after N ms (default: 30000; set 0 to disable).
  timeoutMs: 10_000,

  // Use the market-data sandbox host (default false; market data only).
  sandbox: false,

  // Automatic retry. The Alpaca client enables this by default (3 attempts);
  // pass a config to tune it or `retry: false` to disable.
  retry: {
    maxRetries: 2,            // 1 initial + 2 retries = 3 attempts (default)
    retryDelayMs: 250,        // base for exponential backoff (default 250)
    maxDelayMs: 5_000,        // cap per delay (default 5000)
    retryableStatuses: [408, 425, 429, 500, 502, 503, 504], // default
    respectRetryAfter: true,  // honor a Retry-After header (default true)
  },

  // Proactive client-side rate limiting (the Alpaca client enables a safe
  // default; pass a config to tune or `false` to disable). See below.
  rateLimit: { maxRequests: 200, intervalMs: 60_000, maxConcurrent: 16 },

  userAgent: "my-app/1.0", // default `@alpacahq/alpaca-ts-alpha/<version>`; "" disables
});
```

### Retry semantics

- **On by default on the `Alpaca` client** (3 attempts = 1 initial + 2 retries);
  pass a `retry` config to tune it or `retry: false` to disable. Raw `Api`
  classes built from a bare `Configuration` are **off** unless you set `retry`
  (same opt-in model as the rate limiter).
- The `retryableStatuses` (`408, 425, 429, 500, 502, 503, 504` by default) are
  retried **only for safe/idempotent verbs** (`GET/HEAD/OPTIONS/TRACE`). A
  non-idempotent `POST`/`PUT`/`PATCH`/`DELETE` is **never** auto-retried (even on
  `429`), so an order can't be silently duplicated — pass an `Idempotency-Key`
  to make a `POST` safely retryable yourself (see below).
- **Transient network failures** (DNS, connection reset, TLS — surfaced as a
  `FetchError`) are also retried, again **only for the safe verbs**. A
  deliberate abort (caller `AbortSignal` or the `timeoutMs` deadline) is *not*
  retried.
- Backoff is exponential (doubling per attempt) from `retryDelayMs` (250ms) up
  to `maxDelayMs` (5s), with `±20%` jitter. A `Retry-After` header (seconds or
  HTTP-date) is honored over the computed delay when present.

### Idempotency keys

The ergonomic order methods accept an `idempotencyKey` that is sent as the
`Idempotency-Key` header. Replaying the same key with the same parameters within
Alpaca's 24h window returns the original response instead of creating a duplicate
order, which makes the `POST` safe for you to retry:

```ts
await alpaca.trading.orders.market(
  { symbol: "AAPL", qty: 1, side: "buy" },
  { idempotencyKey: "client-generated-uuid" },
);
```

### Timeouts

`timeoutMs` wires an `AbortController` into the underlying `fetch` and defaults to
`30000` (30s); pass `0` to disable the deadline. A per-call `AbortSignal` (passed
via `initOverrides`) still works and composes with the timeout — whichever aborts
first wins.

### Rate limiting

Alpaca enforces roughly 200 requests/minute per host. The `Alpaca` client
enables a safe default token bucket (~200/min, applied independently to the
trading and market-data hosts) so burst workloads self-throttle instead of
tripping 429s. Tune it with a `rateLimit` config or pass `rateLimit: false` to
opt out. When constructing raw `Api` classes the limiter is **off** unless you
set `rateLimit` on the `Configuration`.

### Typed errors

Non-2xx responses reject with an `ApiError` (a `ResponseError` subclass) exposing
`status`, `code`, and `message` parsed from Alpaca's `{ code, message }` error
envelope; the raw `Response` stays on `.response`. Branch on the status-specific
subclasses instead of magic numbers:

```ts
import { RateLimitError, NotFoundError, ApiError } from "@alpacahq/alpaca-ts-alpha";

try {
  await alpaca.trading.orders.getOrderByOrderID({ orderId });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.warn(`rate limited; retry in ${err.retryAfterMs}ms`, err.rateLimit);
  } else if (err instanceof NotFoundError) {
    console.warn("no such order");
  } else if (err instanceof ApiError) {
    console.error(err.status, err.code, err.message);
  }
}
```

Subclasses: `AuthError` (401), `PermissionError` (403), `NotFoundError` (404),
`ValidationError` (400/422), `RateLimitError` (429). Every `ApiError` also
surfaces `rateLimit` (`X-RateLimit-*`), `retryAfterMs`, and `requestId` —
Alpaca's `X-Request-ID` for the failed call. That id can't be looked up after
the fact, so log it (or include it in a support ticket) when something fails:

```ts
catch (err) {
  if (err instanceof ApiError) {
    console.error(`request ${err.requestId} failed`, err.status, err.message);
  }
}
```

A failed `fetch` itself (network/abort) rejects with `FetchError`.

## Placing orders

`alpaca.trading.orders` is the generated `OrdersApi` plus one ergonomic method
per common order kind that drops the `postOrder({ postOrderRequest })` wrapper,
accepts `number | string` amounts, and enforces the required fields per kind at
compile time. Each returns the created `Order`; `timeInForce` defaults to
`"day"`.

```ts
await alpaca.trading.orders.market({ symbol: "AAPL", qty: 1, side: "buy" });
await alpaca.trading.orders.limit({ symbol: "AAPL", qty: 1, side: "buy", limitPrice: 150 });
await alpaca.trading.orders.stop({ symbol: "AAPL", qty: 1, side: "sell", stopPrice: 140 });
await alpaca.trading.orders.stopLimit({ symbol: "AAPL", qty: 1, side: "sell", stopPrice: 140, limitPrice: 139.5 });
await alpaca.trading.orders.trailingStop({ symbol: "AAPL", qty: 1, side: "sell", trailPercent: 5 });

await alpaca.trading.orders.bracket({
  symbol: "AAPL", qty: 10, side: "buy", limitPrice: 150,
  takeProfit: { limitPrice: 155 },
  stopLoss: { stopPrice: 145, limitPrice: 144.5 },
});
```

For shapes the typed methods don't cover (e.g. multi-leg `mleg`), use
`alpaca.trading.orders.submit(input)` or the raw `postOrder`. The pure builders
are also exported under the `orders` namespace.

## Workflow helpers

A few high-level flows that would otherwise be boilerplate:

```ts
// Latest trade price as a number (undefined if unavailable).
const price = await alpaca.marketData.getLatestPrice("AAPL");

// Close every open position (optionally cancelling open orders first).
await alpaca.trading.closeAllPositions({ cancelOrders: true });

// Place an order and await its terminal state over the trading-updates stream
// (resolves on fill/canceled/rejected/expired/done_for_day; rejects on timeout).
const filled = await alpaca.trading.submitAndWait(
  { type: "market", symbol: "AAPL", qty: 1, side: "buy" },
  { timeoutMs: 30_000 },
);
console.log(filled.status, filled.filledAvgPrice);
```

## Pagination

Every paginated endpoint is iterable out of the box on the `Alpaca` client — you
never thread page tokens or merge per-symbol arrays. `iterate*` lazily yields
items across all pages; `collect*` eagerly returns them.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateStockBars({
  symbols: ["AAPL", "MSFT"],
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
})) {
  // value is a StockBar for symbol
}

const bars = await alpaca.marketData.collectStockBarsBySymbol({
  symbols: "AAPL,MSFT",
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
});
bars.AAPL; // StockBar[]

const articles = await alpaca.marketData.collectNews({ symbols: "AAPL" });

for await (const activity of alpaca.trading.iterateActivities({ activityTypes: ["FILL"] })) {
  // ...
}
```

The same pattern exists for stock/crypto/option trades, quotes, bars and
auctions, `indexValues`, forex `rates`, option `snapshots`/`chain`,
`iterateOptionsContracts`, and `collectCorporateActions`. For custom cases the
lower-level `pagination` namespace exposes the building blocks: `paginate`/
`collect`, `paginateSymbolMap`/`collectBySymbol`, `paginateSymbolObjects`/
`collectSymbolObjects`, and `paginateCursor`/`collectCursor`.

### Bounding large fetches

A multi-symbol `collect*BySymbol` (and the normalized `get*` accessors) accept a
`SymbolCollectOptions` to keep big back-fills cheap. By default every symbol is
multiplexed into one request whose page token is followed to exhaustion; pass
options to bound memory and parallelize:

```ts
// Cap each symbol's history (stops paging once every symbol is full).
const recent = await alpaca.marketData.getStockBars(
  { symbols: ["AAPL", "MSFT"], timeframe: TimeFrame.Minute, start },
  { maxPerSymbol: 1_000 },
);

// Fetch a large basket in parallel: split into one request per symbol,
// up to 4 in flight. The client-side rate limiter still applies.
const basket = await alpaca.marketData.getStockBars(
  { symbols: bigList, timeframe: TimeFrame.Day, start },
  { concurrency: 4, chunkSize: 1, maxPerSymbol: 5_000 },
);
```

`concurrency` defaults to `1` (the single combined request); `chunkSize`
(default `1`) controls how many symbols share each parallel request. The generic
`pagination.collect`/`collectCursor` take a `maxItems` cap, and
`pagination.collectBySymbol` takes `maxPerSymbol`; `pagination.mapConcurrent` and
`pagination.chunk` are exposed for custom fan-out.

## Values & types

Money/quantities are wire-truthful numeric `string`s (no float64 precision
loss). Parse or format with the `values` helpers; for exact arithmetic keep the
string and feed a decimal library (`big.js`/`decimal.js`, not bundled).

```ts
import { values } from "@alpacahq/alpaca-ts-alpha";

values.toNumber(account.buyingPower);          // number | undefined
values.toNumberOr(account.cash, 0);            // number with fallback
values.formatMoney(account.equity);            // "$12,345.67" (display only)
```

Build timeframes with the validated builders instead of hand-writing strings
like `"1minute"` (which the API rejects); the facade bar methods require the
branded `TimeFrameString` these return:

```ts
import { TimeFrame, TimeFrameUnit, timeFrame } from "@alpacahq/alpaca-ts-alpha";

timeFrame(15, TimeFrameUnit.Minute); // "15Min"
TimeFrame.Day;                       // preset "1Day"
```

Multi-symbol market-data methods accept a comma-separated `string` or a
`string[]`. Time fields: trading models parse timestamps to `Date`, and
market-data models also **type** them as `Date`. Note that the multi-symbol/list
responses deserialize their symbol-keyed maps verbatim, so nested timestamps can
still arrive as ISO `string`s at runtime despite that type. The fix is to prefer
the normalized accessors below (`getStockBars`, the single-symbol `getStockBarsFor`,
etc.), which always hand back real `Date`s; only the **raw** generated map
responses (e.g. `alpaca.marketData.stocks.stockBars`) carry the caveat, and there
you can normalize with `values.toDate` / `values.toISO`.

## Normalized market-data shapes (REST + streaming unified)

The generated REST models keep Alpaca's compact wire keys (`StockBar` is
`{ o, h, l, c, v, vw, n, t }`), while the real-time stream surfaces readable
camelCase. The `marketDataShapes` namespace bridges them onto one canonical
`Bar` / `Trade` / `Quote` shape — the *same* type the streaming clients emit —
so you can backfill history over REST and append live updates over the
WebSocket without reconciling two shapes.

The `Alpaca` client exposes normalized accessors (auto-paginated, keyed by
symbol) alongside the raw `collect*`/`iterate*` ones:

```ts
import { Alpaca, marketDataShapes, TimeFrame } from "@alpacahq/alpaca-ts-alpha";

const alpaca = new Alpaca({ keyId, secret });

// REST history as canonical Bars: { [symbol]: Bar[] }
const history = await alpaca.marketData.getStockBars({
  symbols: ["AAPL"], timeframe: TimeFrame.Day, start: new Date("2024-01-01"),
});

// Live bars arrive in the SAME shape - just append them.
const stream = alpaca.marketData.stockStream({ feed: "iex" });
stream.onBar((bar) => history.AAPL?.push(bar)); // bar is a Bar
stream.onConnect(() => stream.subscribeForBars(["AAPL"]));
stream.connect();
```

Normalized accessors: `getStockBars`/`getCryptoBars`/`getOptionBars`,
`getStockTrades`/`getCryptoTrades`, `getStockQuotes`/`getCryptoQuotes`, and the
chart-ready `getStockCandles`/`getCryptoCandles`. Each returns a `{ [symbol]: T }`
map; for a single symbol, the `*For(symbol)` variants
(`getStockBarsFor`, `getStockCandlesFor`, ... one per accessor) return the
unwrapped value directly so you skip the `result[symbol]` step. For any other
endpoint, normalize a raw response yourself with the pure mappers:
`marketDataShapes.toBar`, `toStockTrade`/`toCryptoTrade`/`toOptionTrade`,
`toStockQuote`/`toCryptoQuote`/`toOptionQuote`, and the `*BySymbol` helpers.

### Chart-ready helpers

Reshape a `Bar[]` into the forms plotting libraries expect:

```ts
import { toCandles, toCandlestickSeries, toLineSeries } from "@alpacahq/alpaca-ts-alpha";

toCandles(history.AAPL);              // { time[], open[], high[], low[], close[], volume[] }
toCandles(history.AAPL, { time: "seconds" }); // unix seconds instead of epoch ms
toCandlestickSeries(history.AAPL);    // [{ time, open, high, low, close }]
toLineSeries(history.AAPL, "close");  // [{ time, value }]
```

These live in the `marketDataShapes` namespace too and are re-exported at the top
level. Everything here is REST-only (no `ws`/`msgpack`), so it is available from
the `@alpacahq/alpaca-ts-alpha/rest` entrypoint as well.

### Data feeds & the free-tier 15-minute delay

A few market-data gotchas are worth knowing before your first request — they
come from Alpaca's data plans, not the SDK:

- **Feeds.** US-equity endpoints take a `feed` parameter: `iex` (free), `sip`
  (all US exchanges, paid), plus `otc`/`boats`. The SDK does **not** force a
  default for REST — when you omit `feed`, Alpaca picks the *best feed your
  subscription allows* (`iex` on the free plan), so a free key won't 403 on a
  default request. The streaming helpers default to `feed: "iex"` so a free key
  connects out of the box; pass `{ feed: "sip" }` explicitly once you have a
  subscription.
- **The 15-minute rule.** On the free plan, SIP data for the **last 15 minutes**
  is restricted. Two consequences:
  - Explicitly requesting `feed: "sip"` with `end` defaulting to *now* fails
    with `403 subscription does not permit querying recent SIP data`. The SDK
    detects this 403 and appends guidance to the error message (pass
    `{ feed: "iex" }`, move `end` back ≥15 min, or upgrade).
  - With `iex`, recent bars exist but the trailing ~15 minutes can be sparse or
    empty, so `end: new Date()` may look like it "returns nothing". If you need
    a guaranteed-populated window on the free tier, set `end` ~15 minutes in the
    past yourself.

  The SDK deliberately does **not** clamp `end` for you — doing so silently
  would hide data that paid subscribers are entitled to.
- **`paper` is irrelevant to market data.** The `paper` flag only switches the
  *trading* host (`paper-api` vs `api`); every market-data REST/stream call goes
  to `data.alpaca.markets` regardless. Free vs paid *data* is governed by your
  subscription and the `feed` parameter, not by `paper`.

## Real-time streaming

WebSocket clients for a market-data stream (stocks, crypto, options, news) and a
trading stream (order/account updates). Both authenticate automatically,
reconnect with backoff, re-subscribe after a reconnect, and ping/pong. The API
is a typed `EventEmitter`: register listeners, then `connect()`.

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" }); // "iex" | "sip" | "delayed_sip"
stocks.onBar((bar) => pushToClients(bar)); // typed StreamBar
stocks.onError((msg) => console.error("stream error:", msg));
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();

const updates = alpaca.trading.stream();
updates.onTradeUpdate((u) => console.log(u.event, u.order.symbol, u.order.clientOrderId));
updates.onConnect(() => updates.subscribeTradeUpdates());
updates.connect();
```

`cryptoStream()`, `optionStream()`, and `newsStream()` share the same surface.

## Capability map (which method lives where)

The `capabilities` namespace maps each **generated** facade accessor to its
underlying `Api` class and common methods; `findCapabilities(name)` answers
"where does this method live?":

```ts
import { capabilities, findCapabilities } from "@alpacahq/alpaca-ts-alpha";

findCapabilities("getAccount");
// [{ accessor: "trading.account", api: "AccountsApi", group: "trading", ... }]
```

The **ergonomic** (layer 2) helpers have their own map, `ergonomicCapabilities`,
with a matching `findErgonomic(name)` lookup — so "is there a helper for this,
and where?" is answerable the same way:

```ts
import { ergonomicCapabilities, findErgonomic } from "@alpacahq/alpaca-ts-alpha";

findErgonomic("market");
// [{ accessor: "trading.orders", kind: "orderBuilder", wraps: "OrdersApi.postOrder", ... }]
findErgonomic("getStockBars");
// [{ accessor: "marketData", kind: "normalized", ... }]
```

For the full, per-method listing of both layers (description + example for every
method), see the generated [API reference](#api-reference) below.

## Observability

Built-in middleware for logging and metrics, layered on the transport's
`pre`/`post`/`onError` hooks. Pass them via `middleware`; they observe only
(never alter the request), so they compose with retries and with each other.

```ts
import { Alpaca, middleware } from "@alpacahq/alpaca-ts-alpha";

const alpaca = new Alpaca({
  keyId,
  secret,
  middleware: [
    // One log line per request attempt: method, url, status, duration, requestId.
    middleware.loggingMiddleware({ logger: console, level: "info" }),
    // A metric per request attempt for Prometheus / StatsD / OpenTelemetry.
    middleware.metricsMiddleware({
      onRequest: (m) =>
        statsd.timing("alpaca.request", m.durationMs, { method: m.method, status: m.status }),
    }),
  ],
});
```

`loggingMiddleware` redacts the `APCA-*` and `Authorization` headers by default
(and only includes headers at all when `logHeaders: true`). Both accept a
`genRequestId` to supply your own correlation ids.

## Dependencies

The REST client needs nothing beyond the Node platform globals. The **streaming**
clients (WebSockets) pull in two small runtime dependencies — [`ws`](https://github.com/websockets/ws)
and [`@msgpack/msgpack`](https://github.com/msgpack/msgpack-javascript). At
runtime the `Alpaca` facade only constructs them when you actually open a stream,
but the **root entrypoint's module graph statically includes them** (it
re-exports the `streaming` namespace), so a bundler resolving
`@alpacahq/alpaca-ts-alpha` will see `ws` / `@msgpack/msgpack` / `node:events`.
If you only use REST — or you target an edge/browser runtime where `ws` cannot
run — import from the [`@alpacahq/alpaca-ts-alpha/rest`](#rest-only-entrypoint)
subpath (or rely on the automatic edge resolution described in
[Module formats](#module-formats-esm--cjs)) and they are never pulled in.

## REST-only entrypoint

If you never open a stream, import from `@alpacahq/alpaca-ts-alpha/rest` to keep the `ws` /
`@msgpack/msgpack` dependencies out of your module graph (smaller bundles,
faster cold starts). It re-exports everything except the `streaming` namespace.
The `Alpaca` facade is the same class, so all REST methods work unchanged; the
stream factories (`stockStream`, `stream`, ...) and `submitAndWait` throw if
called from this entrypoint — import from `@alpacahq/alpaca-ts-alpha` when you need streams.

```ts
import { Alpaca } from "@alpacahq/alpaca-ts-alpha/rest";
```

On edge and browser runtimes you usually don't need to reach for this subpath
explicitly — the root entrypoint resolves here automatically (see
[Module formats](#module-formats-esm--cjs)).

## Testing your integration

`@alpacahq/alpaca-ts-alpha/testing` provides a network-free harness so your unit tests don't
hit Alpaca. `mockFetch` answers canned responses by method + path; `createMockAlpaca`
wires one into a ready `Alpaca` client (dummy credentials, rate limiting off).

```ts
import { createMockAlpaca } from "@alpacahq/alpaca-ts-alpha/testing";

const alpaca = createMockAlpaca([
  { method: "GET", path: "/v2/account", body: { account_number: "PA42", status: "ACTIVE" } },
  { path: /\/v2\/stocks\/[A-Z]+\/trades\/latest$/, respond: ({ url }) => ({
      symbol: url.pathname.split("/")[3],
      trade: { p: 99.5 },
    }) },
]);

const account = await alpaca.trading.account.getAccount(); // { accountNumber: "PA42", ... }
const price = await alpaca.marketData.getLatestPrice("AAPL"); // 99.5
```

Routes match the first entry whose `path` (exact string or RegExp) and optional
`method` match; unmatched requests get your `fallback` or a descriptive 404. A
route's `body` is JSON-encoded automatically (objects) or sent verbatim
(strings); `respond` is the dynamic escape hatch.

## Module formats (ESM & CJS)

The package ships both native ESM (`dist/index.mjs`) and CommonJS
(`dist/index.js`), selected via conditional `exports`, with per-format type
declarations and `sideEffects: false` for tree-shaking.

```ts
import { Alpaca } from "@alpacahq/alpaca-ts-alpha";       // ESM
```
```js
const { Alpaca } = require("@alpacahq/alpaca-ts-alpha");  // CJS
```

> Dual-package caveat: don't load the SDK through *both* `import` and `require`
> in the same process if you rely on `instanceof` against its exported classes
> (e.g. `ApiError`), or you may compare against two copies.

### Edge & browser runtimes

The streaming clients depend on `ws` and `node:events`, which don't run on edge
runtimes (Cloudflare Workers / `workerd`, Vercel Edge, Deno) or in the browser.
To keep the root import working there, the package `exports` map declares
`workerd`, `worker`, `edge-light`, `deno`, and `browser` conditions that resolve
`@alpacahq/alpaca-ts-alpha` to the streaming-free
[REST-only build](#rest-only-entrypoint) automatically — so a plain
`import { Alpaca } from "@alpacahq/alpaca-ts-alpha"` builds and runs on those
targets without the `Class extends value [object Module]` failure that comes
from a bundler trying to load `ws` / `node:events` on a runtime that lacks them.

The trade-off is the same as importing `/rest` directly: REST works unchanged,
but the stream factories (`stockStream`, `stream`, ...) and `submitAndWait`
throw. For real-time streaming, run on Node and import the root entry there.

## Development

```bash
npm install      # also builds via the `prepare` script
npm run build    # tsup (esbuild) -> dual ESM+CJS + types in dist/
npm run typecheck # tsc --noEmit (type authority; does not emit)
npm test         # vitest
```

`dist/` is git-ignored and produced by the build (and automatically on
`npm publish` / `npm pack` via `prepare`). Runnable end-to-end examples live in
[`examples/`](./examples).

This SDK was originally scaffolded with
[OpenAPI Generator](https://openapi-generator.tech), but it is now **fully
hand-maintained** — there are no further regenerations. The generated REST
clients and models under `src/trading/{apis,models}` and
`src/market-data/{apis,models}` are left untouched so they remain a faithful
snapshot of Alpaca's OpenAPI spec; everything else — the `Alpaca` facade, order
builders, normalized market-data shapes, pagination, streaming, and the shared
transport — is hand-written in separate modules. When contributing, edit the
hand-written modules and don't hand-edit the generated `apis`/`models` trees.

## Background

- **One package, two namespaces.** The Trading and Market Data APIs are exposed
  as the `trading` and `marketData` namespaces of a single package. This avoids
  collisions between the two specs, which both define a `CorporateActionsApi`
  and overlapping model names.

## API reference

Every method on the facade — all generated REST methods, the real-time streaming
factories, and the ergonomic helpers — with a one-line description and a short
example. This section is **generated** from [`src/capabilities.ts`](src/capabilities.ts)
plus a hand-maintained examples map; run `npm run docs:api` to regenerate it (a
test fails the build if it drifts out of sync). Headings are the real facade call
paths, so every entry is individually anchor-linkable.

<!-- API-REFERENCE:START -->

### Trading API

<details>
<summary><strong>Operations</strong> (68)</summary>

- `account` — [getAccount](#alpacatradingaccountgetaccount)
- `accountActivities` — [getAccountActivities](#alpacatradingaccountactivitiesgetaccountactivities), [getAccountActivitiesByActivityType](#alpacatradingaccountactivitiesgetaccountactivitiesbyactivitytype)
- `accountConfigurations` — [getAccountConfig](#alpacatradingaccountconfigurationsgetaccountconfig), [patchAccountConfig](#alpacatradingaccountconfigurationspatchaccountconfig)
- `assets` — [getV2Assets](#alpacatradingassetsgetv2assets), [getV2AssetsSymbolOrAssetId](#alpacatradingassetsgetv2assetssymbolorassetid), [getOptionsContracts](#alpacatradingassetsgetoptionscontracts), [getOptionContractSymbolOrId](#alpacatradingassetsgetoptioncontractsymbolorid), [usCorporates](#alpacatradingassetsuscorporates), [usTreasuries](#alpacatradingassetsustreasuries)
- `calendar` — [calendar](#alpacatradingcalendarcalendar), [legacyCalendar](#alpacatradingcalendarlegacycalendar)
- `clock` — [clock](#alpacatradingclockclock), [legacyClock](#alpacatradingclocklegacyclock)
- `corporateActions` — [getV2CorporateActionsAnnouncements](#alpacatradingcorporateactionsgetv2corporateactionsannouncements), [getV2CorporateActionsAnnouncementsId](#alpacatradingcorporateactionsgetv2corporateactionsannouncementsid)
- `cryptoFunding` — [createCryptoTransferForAccount](#alpacatradingcryptofundingcreatecryptotransferforaccount), [getCryptoFundingTransfer](#alpacatradingcryptofundinggetcryptofundingtransfer), [listCryptoFundingTransfers](#alpacatradingcryptofundinglistcryptofundingtransfers), [getCryptoTransferEstimate](#alpacatradingcryptofundinggetcryptotransferestimate), [listCryptoFundingWallets](#alpacatradingcryptofundinglistcryptofundingwallets), [createWhitelistedAddress](#alpacatradingcryptofundingcreatewhitelistedaddress), [deleteWhitelistedAddress](#alpacatradingcryptofundingdeletewhitelistedaddress), [listWhitelistedAddress](#alpacatradingcryptofundinglistwhitelistedaddress)
- `cryptoPerpetualsAccountVitals` — [getCryptoPerpAccountVitals](#alpacatradingcryptoperpetualsaccountvitalsgetcryptoperpaccountvitals)
- `cryptoPerpetualsFunding` — [createCryptoPerpTransferForAccount](#alpacatradingcryptoperpetualsfundingcreatecryptoperptransferforaccount), [getCryptoPerpFundingTransfer](#alpacatradingcryptoperpetualsfundinggetcryptoperpfundingtransfer), [getCryptoPerpTransferEstimate](#alpacatradingcryptoperpetualsfundinggetcryptoperptransferestimate), [listCryptoPerpFundingTransfers](#alpacatradingcryptoperpetualsfundinglistcryptoperpfundingtransfers), [listCryptoPerpFundingWallets](#alpacatradingcryptoperpetualsfundinglistcryptoperpfundingwallets), [createWhitelistedPerpAddress](#alpacatradingcryptoperpetualsfundingcreatewhitelistedperpaddress), [deleteWhitelistedPerpAddress](#alpacatradingcryptoperpetualsfundingdeletewhitelistedperpaddress), [listWhitelistedPerpAddress](#alpacatradingcryptoperpetualsfundinglistwhitelistedperpaddress)
- `cryptoPerpetualsLeverage` — [getCryptoPerpAccountLeverage](#alpacatradingcryptoperpetualsleveragegetcryptoperpaccountleverage), [setCryptoPerpAccountLeverage](#alpacatradingcryptoperpetualsleveragesetcryptoperpaccountleverage)
- `events` — [subscribeToActivitiesSSE](#alpacatradingeventssubscribetoactivitiessse)
- `locates` — [createLocates](#alpacatradinglocatescreatelocates), [getLocate](#alpacatradinglocatesgetlocate), [listLocateQuotes](#alpacatradinglocateslistlocatequotes), [listLocates](#alpacatradinglocateslistlocates)
- `orders` — [getAllOrders](#alpacatradingordersgetallorders), [postOrder](#alpacatradingorderspostorder), [getOrderByOrderID](#alpacatradingordersgetorderbyorderid), [getOrderByClientOrderId](#alpacatradingordersgetorderbyclientorderid), [patchOrderByOrderId](#alpacatradingorderspatchorderbyorderid), [deleteOrderByOrderID](#alpacatradingordersdeleteorderbyorderid), [deleteAllOrders](#alpacatradingordersdeleteallorders)
- `portfolioHistory` — [getAccountPortfolioHistory](#alpacatradingportfoliohistorygetaccountportfoliohistory)
- `positions` — [getAllOpenPositions](#alpacatradingpositionsgetallopenpositions), [getOpenPosition](#alpacatradingpositionsgetopenposition), [deleteAllOpenPositions](#alpacatradingpositionsdeleteallopenpositions), [deleteOpenPosition](#alpacatradingpositionsdeleteopenposition), [optionExercise](#alpacatradingpositionsoptionexercise), [optionDoNotExercise](#alpacatradingpositionsoptiondonotexercise)
- `tokenization` — [getTokenizationRequests](#alpacatradingtokenizationgettokenizationrequests), [postTokenizationMint](#alpacatradingtokenizationposttokenizationmint)
- `watchlists` — [getWatchlists](#alpacatradingwatchlistsgetwatchlists), [getWatchlistById](#alpacatradingwatchlistsgetwatchlistbyid), [getWatchlistByName](#alpacatradingwatchlistsgetwatchlistbyname), [postWatchlist](#alpacatradingwatchlistspostwatchlist), [updateWatchlistById](#alpacatradingwatchlistsupdatewatchlistbyid), [updateWatchlistByName](#alpacatradingwatchlistsupdatewatchlistbyname), [addAssetToWatchlist](#alpacatradingwatchlistsaddassettowatchlist), [addAssetToWatchlistByName](#alpacatradingwatchlistsaddassettowatchlistbyname), [removeAssetFromWatchlist](#alpacatradingwatchlistsremoveassetfromwatchlist), [deleteWatchlistById](#alpacatradingwatchlistsdeletewatchlistbyid), [deleteWatchlistByName](#alpacatradingwatchlistsdeletewatchlistbyname)

</details>

#### `alpaca.trading.account` — AccountsApi

Account details, balances, buying power and status.

##### `alpaca.trading.account.getAccount`

Account details, balances, buying power and status.

```ts
await alpaca.trading.account.getAccount();
```

#### `alpaca.trading.accountActivities` — AccountActivitiesApi

Account activity history (fills, fees, dividends, transfers).

##### `alpaca.trading.accountActivities.getAccountActivities`

List account activities (fills, fees, dividends, transfers), newest first.

```ts
await alpaca.trading.accountActivities.getAccountActivities({
  activityTypes: ["FILL"],
  pageSize: 50,
});
```

##### `alpaca.trading.accountActivities.getAccountActivitiesByActivityType`

List activities of a single type (e.g. only fills).

```ts
await alpaca.trading.accountActivities.getAccountActivitiesByActivityType({
  activityType: "FILL",
});
```

#### `alpaca.trading.accountConfigurations` — AccountConfigurationsApi

Read and update trading account configuration.

##### `alpaca.trading.accountConfigurations.getAccountConfig`

Read the account's trading configuration.

```ts
await alpaca.trading.accountConfigurations.getAccountConfig();
```

##### `alpaca.trading.accountConfigurations.patchAccountConfig`

Update trading configuration (e.g. block short selling).

```ts
await alpaca.trading.accountConfigurations.patchAccountConfig({
  accountConfigurations: { noShorting: true },
});
```

#### `alpaca.trading.assets` — AssetsApi

Tradable assets, option contracts and instrument reference data.

##### `alpaca.trading.assets.getV2Assets`

List tradable assets, filterable by class, status and exchange.

```ts
await alpaca.trading.assets.getV2Assets({
  status: "active",
  assetClass: "us_equity",
});
```

##### `alpaca.trading.assets.getV2AssetsSymbolOrAssetId`

Fetch a single asset by symbol or asset id.

```ts
await alpaca.trading.assets.getV2AssetsSymbolOrAssetId({
  symbolOrAssetId: "AAPL",
});
```

##### `alpaca.trading.assets.getOptionsContracts`

List option contracts for underlying symbols (paginated).

```ts
await alpaca.trading.assets.getOptionsContracts({
  underlyingSymbols: "AAPL",
  limit: 100,
});
```

##### `alpaca.trading.assets.getOptionContractSymbolOrId`

Fetch a single option contract by symbol or id.

```ts
await alpaca.trading.assets.getOptionContractSymbolOrId({
  symbolOrId: "AAPL250117C00150000",
});
```

##### `alpaca.trading.assets.usCorporates`

Reference data for US corporate bonds (by ISIN, CUSIP or ticker).

```ts
await alpaca.trading.assets.usCorporates({ tickers: "AAPL" });
```

##### `alpaca.trading.assets.usTreasuries`

Reference data for US Treasury instruments.

```ts
await alpaca.trading.assets.usTreasuries({ cusips: "912797JL3" });
```

#### `alpaca.trading.calendar` — CalendarApi

Market calendar (trading days, open/close sessions).

##### `alpaca.trading.calendar.calendar`

Market calendar (sessions) for a market and date range.

```ts
await alpaca.trading.calendar.calendar({
  market: "us_equity",
  start: new Date("2024-01-01"),
  end: new Date("2024-01-31"),
});
```

##### `alpaca.trading.calendar.legacyCalendar`

Legacy market-calendar endpoint (prefer `calendar`).

```ts
await alpaca.trading.calendar.legacyCalendar({
  start: new Date("2024-01-01"),
  end: new Date("2024-01-31"),
});
```

#### `alpaca.trading.clock` — ClockApi

Market clock (current time, next open/close).

##### `alpaca.trading.clock.clock`

Current market clock: open/closed and next open/close.

```ts
await alpaca.trading.clock.clock();
```

##### `alpaca.trading.clock.legacyClock`

Legacy market-clock endpoint (prefer `clock`).

```ts
await alpaca.trading.clock.legacyClock();
```

#### `alpaca.trading.corporateActions` — CorporateActionsApi

Corporate-action announcements (splits, dividends, mergers).

##### `alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements`

Deprecated: corporate-action announcements over a date range.

```ts
await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({
  caTypes: "dividend",
  since: "2024-01-01",
  until: "2024-01-31",
});
```

##### `alpaca.trading.corporateActions.getV2CorporateActionsAnnouncementsId`

Deprecated: a single corporate-action announcement by id.

```ts
await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncementsId({
  id: "be3c368a-4c7c-4384-808e-f02c9f5a8afe",
});
```

#### `alpaca.trading.cryptoFunding` — CryptoFundingApi

Crypto wallets, transfers and whitelisted withdrawal addresses.

##### `alpaca.trading.cryptoFunding.createCryptoTransferForAccount`

Initiate a crypto withdrawal/transfer for the account.

```ts
await alpaca.trading.cryptoFunding.createCryptoTransferForAccount({
  createCryptoTransferRequest: {
    amount: "0.5",
    address: "0xabc...",
    asset: "ETH",
  },
});
```

##### `alpaca.trading.cryptoFunding.getCryptoFundingTransfer`

Fetch a single crypto transfer by id.

```ts
await alpaca.trading.cryptoFunding.getCryptoFundingTransfer({
  transferId: "f1...e9",
});
```

##### `alpaca.trading.cryptoFunding.listCryptoFundingTransfers`

List crypto transfers for the account.

```ts
await alpaca.trading.cryptoFunding.listCryptoFundingTransfers();
```

##### `alpaca.trading.cryptoFunding.getCryptoTransferEstimate`

Estimate fees for a crypto transfer.

```ts
await alpaca.trading.cryptoFunding.getCryptoTransferEstimate({
  asset: "ETH",
  fromAddress: "0xabc...",
  toAddress: "0xdef...",
  amount: "0.5",
});
```

##### `alpaca.trading.cryptoFunding.listCryptoFundingWallets`

List the account's crypto wallets.

```ts
await alpaca.trading.cryptoFunding.listCryptoFundingWallets({
  asset: "ETH",
});
```

##### `alpaca.trading.cryptoFunding.createWhitelistedAddress`

Whitelist a crypto withdrawal address.

```ts
await alpaca.trading.cryptoFunding.createWhitelistedAddress({
  createWhitelistedAddressRequest: { address: "0xabc...", asset: "ETH" },
});
```

##### `alpaca.trading.cryptoFunding.deleteWhitelistedAddress`

Remove a whitelisted crypto address.

```ts
await alpaca.trading.cryptoFunding.deleteWhitelistedAddress({
  whitelistedAddressId: "a1...c2",
});
```

##### `alpaca.trading.cryptoFunding.listWhitelistedAddress`

List whitelisted crypto withdrawal addresses.

```ts
await alpaca.trading.cryptoFunding.listWhitelistedAddress();
```

#### `alpaca.trading.cryptoPerpetualsAccountVitals` — CryptoPerpetualsAccountVitalsBetaApi

Crypto perpetual-futures account vitals (beta).

##### `alpaca.trading.cryptoPerpetualsAccountVitals.getCryptoPerpAccountVitals`

Crypto perpetual-futures account vitals: margin, collateral, P&L (beta).

```ts
await alpaca.trading.cryptoPerpetualsAccountVitals.getCryptoPerpAccountVitals();
```

#### `alpaca.trading.cryptoPerpetualsFunding` — CryptoPerpetualsFundingBetaApi

Crypto perpetual-futures wallets and transfers (beta).

##### `alpaca.trading.cryptoPerpetualsFunding.createCryptoPerpTransferForAccount`

Initiate a crypto perpetual-futures transfer (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.createCryptoPerpTransferForAccount({
  createCryptoTransferRequest: { amount: "100", asset: "USDT" },
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpFundingTransfer`

Fetch a single perpetual-futures transfer by id (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpFundingTransfer({
  transferId: "f1...e9",
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpTransferEstimate`

Estimate fees for a perpetual-futures transfer (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpTransferEstimate({
  asset: "USDT",
  amount: "100",
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingTransfers`

List perpetual-futures transfers (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingTransfers();
```

##### `alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingWallets`

List perpetual-futures wallets (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingWallets({
  asset: "USDT",
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.createWhitelistedPerpAddress`

Whitelist a perpetual-futures withdrawal address (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.createWhitelistedPerpAddress({
  createWhitelistedPerpAddressRequest: {
    address: "0xabc...",
    asset: "USDT",
  },
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.deleteWhitelistedPerpAddress`

Remove a whitelisted perpetual-futures address (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.deleteWhitelistedPerpAddress({
  whitelistedAddressId: "a1...c2",
});
```

##### `alpaca.trading.cryptoPerpetualsFunding.listWhitelistedPerpAddress`

List whitelisted perpetual-futures addresses (beta).

```ts
await alpaca.trading.cryptoPerpetualsFunding.listWhitelistedPerpAddress();
```

#### `alpaca.trading.cryptoPerpetualsLeverage` — CryptoPerpetualsLeverageBetaApi

Read/set crypto perpetual-futures account leverage (beta).

##### `alpaca.trading.cryptoPerpetualsLeverage.getCryptoPerpAccountLeverage`

Read crypto perpetual-futures account leverage (beta).

```ts
await alpaca.trading.cryptoPerpetualsLeverage.getCryptoPerpAccountLeverage({
  symbol: "BTC-PERP",
});
```

##### `alpaca.trading.cryptoPerpetualsLeverage.setCryptoPerpAccountLeverage`

Set crypto perpetual-futures account leverage (beta).

```ts
await alpaca.trading.cryptoPerpetualsLeverage.setCryptoPerpAccountLeverage({
  symbol: "BTC-PERP",
  leverage: 5,
});
```

#### `alpaca.trading.events` — EventsApi

Server-sent event streams for account activity.

##### `alpaca.trading.events.subscribeToActivitiesSSE`

Server-sent event stream of account activities.

```ts
await alpaca.trading.events.subscribeToActivitiesSSE({
  sinceId: "20240101000000000::...",
});
```

#### `alpaca.trading.locates` — LocatesApi

Easy-to-borrow locate requests, listings and quotes.

##### `alpaca.trading.locates.createLocates`

Create an easy-to-borrow locate request for a short sale.

```ts
await alpaca.trading.locates.createLocates({
  createLocateRequest: { symbol: "AAPL", qty: 100 },
});
```

##### `alpaca.trading.locates.getLocate`

Fetch a single locate request by id.

```ts
await alpaca.trading.locates.getLocate({ locateId: "loc_123" });
```

##### `alpaca.trading.locates.listLocateQuotes`

Locate availability and pricing for one or more symbols.

```ts
await alpaca.trading.locates.listLocateQuotes({ symbols: "AAPL,TSLA" });
```

##### `alpaca.trading.locates.listLocates`

List locate requests, filtered by status, symbol or date range.

```ts
await alpaca.trading.locates.listLocates({ status: "active" });
```

#### `alpaca.trading.orders` — OrdersApi

Place, read, replace and cancel orders.

##### `alpaca.trading.orders.getAllOrders`

List orders, filterable by status, side and symbol.

```ts
await alpaca.trading.orders.getAllOrders({ status: "open", limit: 100 });
```

##### `alpaca.trading.orders.postOrder`

Place an order (raw). Prefer the typed builders under Ergonomic helpers.

```ts
await alpaca.trading.orders.postOrder({
  postOrderRequest: {
    symbol: "AAPL",
    qty: "1",
    side: "buy",
    type: "market",
    timeInForce: "day",
  },
});
```

##### `alpaca.trading.orders.getOrderByOrderID`

Fetch a single order by its order id.

```ts
await alpaca.trading.orders.getOrderByOrderID({ orderId: "f1...e9" });
```

##### `alpaca.trading.orders.getOrderByClientOrderId`

Fetch a single order by your client order id.

```ts
await alpaca.trading.orders.getOrderByClientOrderId({
  clientOrderId: "my-order-1",
});
```

##### `alpaca.trading.orders.patchOrderByOrderId`

Replace (amend) an open order.

```ts
await alpaca.trading.orders.patchOrderByOrderId({
  orderId: "f1...e9",
  patchOrderRequest: { qty: "2" },
});
```

##### `alpaca.trading.orders.deleteOrderByOrderID`

Cancel a single open order.

```ts
await alpaca.trading.orders.deleteOrderByOrderID({ orderId: "f1...e9" });
```

##### `alpaca.trading.orders.deleteAllOrders`

Cancel all open orders.

```ts
await alpaca.trading.orders.deleteAllOrders();
```

#### `alpaca.trading.portfolioHistory` — PortfolioHistoryApi

Time series of account equity / P&L.

##### `alpaca.trading.portfolioHistory.getAccountPortfolioHistory`

Time series of account equity and profit/loss.

```ts
await alpaca.trading.portfolioHistory.getAccountPortfolioHistory({
  period: "1M",
  timeframe: "1D",
});
```

#### `alpaca.trading.positions` — PositionsApi

Open positions; close positions; exercise options.

##### `alpaca.trading.positions.getAllOpenPositions`

List all open positions.

```ts
await alpaca.trading.positions.getAllOpenPositions();
```

##### `alpaca.trading.positions.getOpenPosition`

Fetch a single open position by symbol or asset id.

```ts
await alpaca.trading.positions.getOpenPosition({ symbolOrAssetId: "AAPL" });
```

##### `alpaca.trading.positions.deleteAllOpenPositions`

Liquidate every open position (optionally cancel orders first).

```ts
await alpaca.trading.positions.deleteAllOpenPositions({
  cancelOrders: true,
});
```

##### `alpaca.trading.positions.deleteOpenPosition`

Close a position: whole, partial qty, or a percentage.

```ts
await alpaca.trading.positions.deleteOpenPosition({
  symbolOrAssetId: "AAPL",
  percentage: 50,
});
```

##### `alpaca.trading.positions.optionExercise`

Exercise a held option position.

```ts
await alpaca.trading.positions.optionExercise({
  symbolOrContractId: "AAPL250117C00150000",
});
```

##### `alpaca.trading.positions.optionDoNotExercise`

Submit a do-not-exercise instruction for an option position.

```ts
await alpaca.trading.positions.optionDoNotExercise({
  symbolOrContractId: "AAPL250117C00150000",
});
```

#### `alpaca.trading.tokenization` — TokenizationApi

Tokenization requests and minting.

##### `alpaca.trading.tokenization.getTokenizationRequests`

List tokenization (mint/redeem) requests.

```ts
await alpaca.trading.tokenization.getTokenizationRequests({
  status: "completed",
});
```

##### `alpaca.trading.tokenization.postTokenizationMint`

Submit a tokenization mint request.

```ts
await alpaca.trading.tokenization.postTokenizationMint({
  tokenizationMintRequest: { underlyingSymbol: "AAPL", quantity: "1" },
});
```

#### `alpaca.trading.watchlists` — WatchlistsApi

Create and manage watchlists and their assets.

##### `alpaca.trading.watchlists.getWatchlists`

List all watchlists.

```ts
await alpaca.trading.watchlists.getWatchlists();
```

##### `alpaca.trading.watchlists.getWatchlistById`

Fetch a single watchlist by id.

```ts
await alpaca.trading.watchlists.getWatchlistById({
  watchlistId: "f1...e9",
});
```

##### `alpaca.trading.watchlists.getWatchlistByName`

Fetch a single watchlist by name.

```ts
await alpaca.trading.watchlists.getWatchlistByName({ name: "My List" });
```

##### `alpaca.trading.watchlists.postWatchlist`

Create a watchlist with an initial set of symbols.

```ts
await alpaca.trading.watchlists.postWatchlist({
  updateWatchlistRequest: { name: "Tech", symbols: ["AAPL", "MSFT"] },
});
```

##### `alpaca.trading.watchlists.updateWatchlistById`

Update a watchlist (name and/or symbols) by id.

```ts
await alpaca.trading.watchlists.updateWatchlistById({
  watchlistId: "f1...e9",
  updateWatchlistRequest: { name: "Renamed" },
});
```

##### `alpaca.trading.watchlists.updateWatchlistByName`

Update a watchlist (name and/or symbols) by name.

```ts
await alpaca.trading.watchlists.updateWatchlistByName({
  name: "Tech",
  updateWatchlistRequest: { symbols: ["AAPL"] },
});
```

##### `alpaca.trading.watchlists.addAssetToWatchlist`

Add an asset to a watchlist by id.

```ts
await alpaca.trading.watchlists.addAssetToWatchlist({
  watchlistId: "f1...e9",
  addAssetToWatchlistRequest: { symbol: "NVDA" },
});
```

##### `alpaca.trading.watchlists.addAssetToWatchlistByName`

Add an asset to a watchlist by name.

```ts
await alpaca.trading.watchlists.addAssetToWatchlistByName({
  name: "Tech",
  addAssetToWatchlistRequest: { symbol: "NVDA" },
});
```

##### `alpaca.trading.watchlists.removeAssetFromWatchlist`

Remove an asset from a watchlist by id.

```ts
await alpaca.trading.watchlists.removeAssetFromWatchlist({
  watchlistId: "f1...e9",
  symbol: "NVDA",
});
```

##### `alpaca.trading.watchlists.deleteWatchlistById`

Delete a watchlist by id.

```ts
await alpaca.trading.watchlists.deleteWatchlistById({
  watchlistId: "f1...e9",
});
```

##### `alpaca.trading.watchlists.deleteWatchlistByName`

Delete a watchlist by name.

```ts
await alpaca.trading.watchlists.deleteWatchlistByName({ name: "Tech" });
```

### Market Data API

<details>
<summary><strong>Operations</strong> (42)</summary>

- `stocks` — [stockBars](#alpacamarketdatastocksstockbars), [stockTrades](#alpacamarketdatastocksstocktrades), [stockQuotes](#alpacamarketdatastocksstockquotes), [stockAuctions](#alpacamarketdatastocksstockauctions), [stockSnapshots](#alpacamarketdatastocksstocksnapshots), [stockLatestBars](#alpacamarketdatastocksstocklatestbars), [stockLatestQuotes](#alpacamarketdatastocksstocklatestquotes), [stockLatestTrades](#alpacamarketdatastocksstocklatesttrades), [stockMetaConditions](#alpacamarketdatastocksstockmetaconditions), [stockMetaExchanges](#alpacamarketdatastocksstockmetaexchanges)
- `crypto` — [cryptoBars](#alpacamarketdatacryptocryptobars), [cryptoTrades](#alpacamarketdatacryptocryptotrades), [cryptoQuotes](#alpacamarketdatacryptocryptoquotes), [cryptoSnapshots](#alpacamarketdatacryptocryptosnapshots), [cryptoLatestBars](#alpacamarketdatacryptocryptolatestbars), [cryptoLatestQuotes](#alpacamarketdatacryptocryptolatestquotes), [cryptoLatestTrades](#alpacamarketdatacryptocryptolatesttrades), [cryptoLatestOrderbooks](#alpacamarketdatacryptocryptolatestorderbooks)
- `cryptoPerpetualFutures` — [cryptoPerpLatestBars](#alpacamarketdatacryptoperpetualfuturescryptoperplatestbars), [cryptoPerpLatestQuotes](#alpacamarketdatacryptoperpetualfuturescryptoperplatestquotes), [cryptoPerpLatestTrades](#alpacamarketdatacryptoperpetualfuturescryptoperplatesttrades), [cryptoPerpLatestOrderbooks](#alpacamarketdatacryptoperpetualfuturescryptoperplatestorderbooks), [cryptoPerpLatestFuturesPricing](#alpacamarketdatacryptoperpetualfuturescryptoperplatestfuturespricing)
- `fixedIncome` — [fixedIncomeLatestPrices](#alpacamarketdatafixedincomefixedincomelatestprices), [fixedIncomeLatestQuotes](#alpacamarketdatafixedincomefixedincomelatestquotes)
- `forex` — [rates](#alpacamarketdataforexrates), [latestRates](#alpacamarketdataforexlatestrates)
- `indices` — [indexValues](#alpacamarketdataindicesindexvalues), [indexLatestValues](#alpacamarketdataindicesindexlatestvalues)
- `logos` — [logos](#alpacamarketdatalogoslogos)
- `news` — [news](#alpacamarketdatanewsnews)
- `options` — [optionBars](#alpacamarketdataoptionsoptionbars), [optionTrades](#alpacamarketdataoptionsoptiontrades), [optionChain](#alpacamarketdataoptionsoptionchain), [optionSnapshots](#alpacamarketdataoptionsoptionsnapshots), [optionLatestQuotes](#alpacamarketdataoptionsoptionlatestquotes), [optionLatestTrades](#alpacamarketdataoptionsoptionlatesttrades), [optionMetaConditions](#alpacamarketdataoptionsoptionmetaconditions), [optionMetaExchanges](#alpacamarketdataoptionsoptionmetaexchanges)
- `screener` — [mostActives](#alpacamarketdatascreenermostactives), [movers](#alpacamarketdatascreenermovers)
- `corporateActions` — [corporateActions](#alpacamarketdatacorporateactionscorporateactions)

</details>

#### `alpaca.marketData.stocks` — StockApi

US-equity bars, trades, quotes, auctions and snapshots.

##### `alpaca.marketData.stocks.stockBars`

Historical bars for one or more stocks (paginated).

```ts
await alpaca.marketData.stocks.stockBars({
  symbols: "AAPL,MSFT",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.stocks.stockTrades`

Historical trades for one or more stocks (paginated).

```ts
await alpaca.marketData.stocks.stockTrades({
  symbols: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.stocks.stockQuotes`

Historical quotes for one or more stocks (paginated).

```ts
await alpaca.marketData.stocks.stockQuotes({
  symbols: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.stocks.stockAuctions`

Historical opening/closing auctions for stocks (paginated).

```ts
await alpaca.marketData.stocks.stockAuctions({
  symbols: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.stocks.stockSnapshots`

Latest snapshot (trade, quote, bars) for one or more stocks.

```ts
await alpaca.marketData.stocks.stockSnapshots({ symbols: "AAPL,MSFT" });
```

##### `alpaca.marketData.stocks.stockLatestBars`

Latest minute bar for one or more stocks.

```ts
await alpaca.marketData.stocks.stockLatestBars({ symbols: "AAPL,MSFT" });
```

##### `alpaca.marketData.stocks.stockLatestQuotes`

Latest quote for one or more stocks.

```ts
await alpaca.marketData.stocks.stockLatestQuotes({ symbols: "AAPL,MSFT" });
```

##### `alpaca.marketData.stocks.stockLatestTrades`

Latest trade for one or more stocks.

```ts
await alpaca.marketData.stocks.stockLatestTrades({ symbols: "AAPL,MSFT" });
```

##### `alpaca.marketData.stocks.stockMetaConditions`

Trade/quote condition-code mappings for a tape.

```ts
await alpaca.marketData.stocks.stockMetaConditions({
  ticktype: "trade",
  tape: "A",
});
```

##### `alpaca.marketData.stocks.stockMetaExchanges`

Exchange-code mappings.

```ts
await alpaca.marketData.stocks.stockMetaExchanges();
```

#### `alpaca.marketData.crypto` — CryptoApi

Crypto bars, trades, quotes, orderbooks and snapshots.

##### `alpaca.marketData.crypto.cryptoBars`

Historical crypto bars (paginated); `loc` selects the data region.

```ts
await alpaca.marketData.crypto.cryptoBars({
  loc: "us",
  symbols: "BTC/USD,ETH/USD",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.crypto.cryptoTrades`

Historical crypto trades (paginated).

```ts
await alpaca.marketData.crypto.cryptoTrades({
  loc: "us",
  symbols: "BTC/USD",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.crypto.cryptoQuotes`

Historical crypto quotes (paginated).

```ts
await alpaca.marketData.crypto.cryptoQuotes({
  loc: "us",
  symbols: "BTC/USD",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.crypto.cryptoSnapshots`

Latest snapshot for one or more crypto pairs.

```ts
await alpaca.marketData.crypto.cryptoSnapshots({
  loc: "us",
  symbols: "BTC/USD,ETH/USD",
});
```

##### `alpaca.marketData.crypto.cryptoLatestBars`

Latest bar for one or more crypto pairs.

```ts
await alpaca.marketData.crypto.cryptoLatestBars({
  loc: "us",
  symbols: "BTC/USD",
});
```

##### `alpaca.marketData.crypto.cryptoLatestQuotes`

Latest quote for one or more crypto pairs.

```ts
await alpaca.marketData.crypto.cryptoLatestQuotes({
  loc: "us",
  symbols: "BTC/USD",
});
```

##### `alpaca.marketData.crypto.cryptoLatestTrades`

Latest trade for one or more crypto pairs.

```ts
await alpaca.marketData.crypto.cryptoLatestTrades({
  loc: "us",
  symbols: "BTC/USD",
});
```

##### `alpaca.marketData.crypto.cryptoLatestOrderbooks`

Latest order book for one or more crypto pairs.

```ts
await alpaca.marketData.crypto.cryptoLatestOrderbooks({
  loc: "us",
  symbols: "BTC/USD",
});
```

#### `alpaca.marketData.cryptoPerpetualFutures` — CryptoPerpetualFuturesApi

Crypto perpetual-futures latest market data.

##### `alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestBars`

Latest bar for one or more crypto perpetual-futures contracts.

```ts
await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestBars({
  loc: "global",
  symbols: "BTC-PERP",
});
```

##### `alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestQuotes`

Latest quote for one or more perpetual-futures contracts.

```ts
await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestQuotes({
  loc: "global",
  symbols: "BTC-PERP",
});
```

##### `alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestTrades`

Latest trade for one or more perpetual-futures contracts.

```ts
await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestTrades({
  loc: "global",
  symbols: "BTC-PERP",
});
```

##### `alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestOrderbooks`

Latest order book for one or more perpetual-futures contracts.

```ts
await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestOrderbooks({
  loc: "global",
  symbols: "BTC-PERP",
});
```

##### `alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestFuturesPricing`

Latest funding/mark pricing for perpetual-futures contracts.

```ts
await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestFuturesPricing({
  loc: "global",
  symbols: "BTC-PERP",
});
```

#### `alpaca.marketData.fixedIncome` — FixedIncomeApi

Fixed-income latest prices and quotes.

##### `alpaca.marketData.fixedIncome.fixedIncomeLatestPrices`

Latest fixed-income prices by ISIN.

```ts
await alpaca.marketData.fixedIncome.fixedIncomeLatestPrices({
  isins: "US0378331005",
});
```

##### `alpaca.marketData.fixedIncome.fixedIncomeLatestQuotes`

Latest fixed-income quotes by ISIN.

```ts
await alpaca.marketData.fixedIncome.fixedIncomeLatestQuotes({
  isins: "US0378331005",
  tradeSize: 100,
});
```

#### `alpaca.marketData.forex` — ForexApi

Foreign-exchange historical and latest rates.

##### `alpaca.marketData.forex.rates`

Historical forex rates for currency pairs (paginated).

```ts
await alpaca.marketData.forex.rates({
  currencyPairs: "EUR/USD",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.forex.latestRates`

Latest forex rates for one or more currency pairs.

```ts
await alpaca.marketData.forex.latestRates({
  currencyPairs: "EUR/USD,GBP/USD",
});
```

#### `alpaca.marketData.indices` — IndexApi

Index historical and latest values.

##### `alpaca.marketData.indices.indexValues`

Historical index values (paginated).

```ts
await alpaca.marketData.indices.indexValues({
  symbols: "SPX",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.indices.indexLatestValues`

Latest values for one or more indices.

```ts
await alpaca.marketData.indices.indexLatestValues({ symbols: "SPX" });
```

#### `alpaca.marketData.logos` — LogosApi

Company logo images.

##### `alpaca.marketData.logos.logos`

Company logo image bytes for a symbol.

```ts
await alpaca.marketData.logos.logos({ symbol: "AAPL" });
```

#### `alpaca.marketData.news` — NewsApi

Market news articles.

##### `alpaca.marketData.news.news`

Latest news articles across stocks and crypto (paginated).

```ts
await alpaca.marketData.news.news({ symbols: "AAPL,TSLA", limit: 10 });
```

#### `alpaca.marketData.options` — OptionApi

Options bars, trades, chains and snapshots.

##### `alpaca.marketData.options.optionBars`

Historical option bars (paginated).

```ts
await alpaca.marketData.options.optionBars({
  symbols: "AAPL250117C00150000",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.options.optionTrades`

Historical option trades (paginated).

```ts
await alpaca.marketData.options.optionTrades({
  symbols: "AAPL250117C00150000",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.options.optionChain`

Snapshots for an underlying's full option chain (paginated).

```ts
await alpaca.marketData.options.optionChain({
  underlyingSymbol: "AAPL",
  type: "call",
});
```

##### `alpaca.marketData.options.optionSnapshots`

Latest snapshots for one or more option contracts.

```ts
await alpaca.marketData.options.optionSnapshots({
  symbols: "AAPL250117C00150000",
});
```

##### `alpaca.marketData.options.optionLatestQuotes`

Latest quotes for one or more option contracts.

```ts
await alpaca.marketData.options.optionLatestQuotes({
  symbols: "AAPL250117C00150000",
});
```

##### `alpaca.marketData.options.optionLatestTrades`

Latest trades for one or more option contracts.

```ts
await alpaca.marketData.options.optionLatestTrades({
  symbols: "AAPL250117C00150000",
});
```

##### `alpaca.marketData.options.optionMetaConditions`

Option trade/quote condition-code mappings.

```ts
await alpaca.marketData.options.optionMetaConditions({ ticktype: "trade" });
```

##### `alpaca.marketData.options.optionMetaExchanges`

Option exchange-code mappings.

```ts
await alpaca.marketData.options.optionMetaExchanges();
```

#### `alpaca.marketData.screener` — ScreenerApi

Market movers and most-active screeners.

##### `alpaca.marketData.screener.mostActives`

Most-active stocks by volume or trade count.

```ts
await alpaca.marketData.screener.mostActives({ by: "volume", top: 10 });
```

##### `alpaca.marketData.screener.movers`

Top market gainers and losers.

```ts
await alpaca.marketData.screener.movers({ marketType: "stocks", top: 10 });
```

#### `alpaca.marketData.corporateActions` — CorporateActionsApi

Historical corporate-action data.

##### `alpaca.marketData.corporateActions.corporateActions`

Historical corporate-action data by symbol and type (paginated).

```ts
await alpaca.marketData.corporateActions.corporateActions({
  symbols: "AAPL",
  types: "cash_dividend",
  start: new Date("2024-01-01"),
});
```

### Real-time streaming

#### `alpaca.trading.stream` — TradingStream

Open the trading-updates WebSocket (order/account events, JSON).

```ts
const updates = alpaca.trading.stream();
updates.onTradeUpdate((u) => console.log(u.event, u.order.symbol));
updates.onConnect(() => updates.subscribeTradeUpdates());
updates.connect();
```

#### `alpaca.marketData.stockStream` — StockDataStream

Open the US-equity market-data WebSocket (msgpack).

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" });
stocks.onBar((bar) => console.log(bar.symbol, bar.close));
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();
```

#### `alpaca.marketData.cryptoStream` — CryptoDataStream

Open the crypto market-data WebSocket (msgpack).

```ts
const crypto = alpaca.marketData.cryptoStream();
crypto.onTrade((t) => console.log(t.symbol, t.price));
crypto.onConnect(() => crypto.subscribeForTrades(["BTC/USD"]));
crypto.connect();
```

#### `alpaca.marketData.optionStream` — OptionDataStream

Open the options market-data WebSocket (msgpack).

```ts
const opts = alpaca.marketData.optionStream();
opts.onTrade((t) => console.log(t.symbol, t.price));
opts.onConnect(() => opts.subscribeForTrades(["AAPL250117C00150000"]));
opts.connect();
```

#### `alpaca.marketData.newsStream` — NewsStream

Open the real-time news-headline WebSocket.

```ts
const news = alpaca.marketData.newsStream();
news.onNews((n) => console.log(n.headline));
news.onConnect(() => news.subscribeForNews(["AAPL", "TSLA"]));
news.connect();
```

### Ergonomic helpers

#### `alpaca.trading.orders` — order builders

One typed builder per order kind; drops the postOrder wrapper and enforces required fields at compile time.

##### `alpaca.trading.orders.market`

Place a market order (exactly one of `qty`/`notional`).

```ts
await alpaca.trading.orders.market({ symbol: "AAPL", side: "buy", qty: 1 });
```

##### `alpaca.trading.orders.limit`

Place a limit order.

```ts
await alpaca.trading.orders.limit({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  limitPrice: 150,
});
```

##### `alpaca.trading.orders.stop`

Place a stop (stop-market) order.

```ts
await alpaca.trading.orders.stop({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  stopPrice: 140,
});
```

##### `alpaca.trading.orders.stopLimit`

Place a stop-limit order.

```ts
await alpaca.trading.orders.stopLimit({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  stopPrice: 140,
  limitPrice: 139,
});
```

##### `alpaca.trading.orders.trailingStop`

Place a trailing-stop order (one of `trailPrice`/`trailPercent`).

```ts
await alpaca.trading.orders.trailingStop({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  trailPercent: 5,
});
```

##### `alpaca.trading.orders.bracket`

Place a bracket order: entry plus take-profit and stop-loss legs.

```ts
await alpaca.trading.orders.bracket({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  takeProfit: { limitPrice: 160 },
  stopLoss: { stopPrice: 140 },
});
```

##### `alpaca.trading.orders.oco`

Place a one-cancels-other order (take-profit + stop-loss on a held position).

```ts
await alpaca.trading.orders.oco({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  takeProfit: { limitPrice: 160 },
  stopLoss: { stopPrice: 140 },
});
```

##### `alpaca.trading.orders.oto`

Place a one-triggers-other order (entry that triggers a single leg).

```ts
await alpaca.trading.orders.oto({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  limitPrice: 150,
  takeProfit: { limitPrice: 160 },
});
```

##### `alpaca.trading.orders.submit`

Generic builder escape hatch for shapes the typed builders don't cover (e.g. `mleg`).

```ts
await alpaca.trading.orders.submit({
  type: "market",
  symbol: "AAPL",
  side: "buy",
  qty: 1,
});
```

#### `alpaca.trading` — workflow helpers

High-level trading flows that would otherwise be boilerplate.

##### `alpaca.trading.submitAndWait`

Place an order and resolve once it reaches a terminal state, observed over the trading stream.

```ts
const filled = await alpaca.trading.submitAndWait({
  type: "market",
  symbol: "AAPL",
  side: "buy",
  qty: 1,
}, { timeoutMs: 30_000 });
```

##### `alpaca.trading.closeAllPositions`

Close every open position (optionally cancel open orders first).

```ts
await alpaca.trading.closeAllPositions({ cancelOrders: true });
```

#### `alpaca.trading` — pagination helpers

Auto-paginated iterate/collect helpers for option contracts and account activities.

##### `alpaca.trading.iterateOptionsContracts`

Lazily yield option contracts across all pages.

```ts
for await (const contract of alpaca.trading.iterateOptionsContracts({
  underlyingSymbols: "AAPL",
})) console.log(contract.symbol);
```

##### `alpaca.trading.collectOptionsContracts`

Eagerly collect all option contracts across pages into one array.

```ts
const contracts = await alpaca.trading.collectOptionsContracts({
  underlyingSymbols: "AAPL",
});
```

##### `alpaca.trading.iterateActivities`

Lazily yield account activities across all pages.

```ts
for await (const activity of alpaca.trading.iterateActivities({
  activityTypes: ["FILL"],
})) console.log(activity.id);
```

##### `alpaca.trading.collectActivities`

Eagerly collect all account activities across pages into one array.

```ts
const activities = await alpaca.trading.collectActivities({
  activityTypes: ["FILL"],
});
```

##### `alpaca.trading.iterateActivitiesByType`

Lazily yield activities of a single type across all pages.

```ts
for await (const fill of alpaca.trading.iterateActivitiesByType({
  activityType: "FILL",
})) console.log(fill.id);
```

##### `alpaca.trading.collectActivitiesByType`

Eagerly collect activities of a single type into one array.

```ts
const fills = await alpaca.trading.collectActivitiesByType({
  activityType: "FILL",
});
```

#### `alpaca.marketData` — workflow helpers

High-level market-data flows that would otherwise be boilerplate.

##### `alpaca.marketData.getLatestPrice`

Latest trade price for a symbol as a `number` (or `undefined`).

```ts
const price = await alpaca.marketData.getLatestPrice("AAPL");
```

#### `alpaca.marketData` — normalized accessors

Auto-paginated, symbol-keyed accessors returning canonical Bar/Trade/Quote shapes (and chart-ready Candles), unified with the streaming layer. Each has a single-symbol `*For(symbol)` variant that returns the unwrapped value.

##### `alpaca.marketData.getStockBars`

Historical stock bars as canonical `Bar`s, auto-paginated and keyed by symbol.

```ts
const bars = await alpaca.marketData.getStockBars({
  symbols: ["AAPL"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.getCryptoBars`

Historical crypto bars as canonical `Bar`s, keyed by symbol.

```ts
const bars = await alpaca.marketData.getCryptoBars({
  loc: "us",
  symbols: ["BTC/USD"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.getOptionBars`

Historical option bars as canonical `Bar`s, keyed by symbol.

```ts
const bars = await alpaca.marketData.getOptionBars({
  symbols: ["AAPL250117C00150000"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.getStockTrades`

Historical stock trades as canonical `Trade`s, keyed by symbol.

```ts
const trades = await alpaca.marketData.getStockTrades({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.getCryptoTrades`

Historical crypto trades as canonical `Trade`s, keyed by symbol.

```ts
const trades = await alpaca.marketData.getCryptoTrades({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.getStockQuotes`

Historical stock quotes as canonical `Quote`s, keyed by symbol.

```ts
const quotes = await alpaca.marketData.getStockQuotes({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.getCryptoQuotes`

Historical crypto quotes as canonical `Quote`s, keyed by symbol.

```ts
const quotes = await alpaca.marketData.getCryptoQuotes({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.getStockCandles`

Historical stock bars as chart-ready columnar `Candles`, keyed by symbol.

```ts
const candles = await alpaca.marketData.getStockCandles({
  symbols: ["AAPL"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.getCryptoCandles`

Historical crypto bars as chart-ready columnar `Candles`, keyed by symbol.

```ts
const candles = await alpaca.marketData.getCryptoCandles({
  loc: "us",
  symbols: ["BTC/USD"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.getStockBarsFor`

Single-symbol historical stock bars as canonical `Bar[]` (unwrapped, not a symbol map).

```ts
const bars = await alpaca.marketData.getStockBarsFor("AAPL", { timeframe: "1Day", start: new Date("2024-01-01") });
```

##### `alpaca.marketData.getCryptoBarsFor`

Single-symbol historical crypto bars as canonical `Bar[]` (unwrapped).

```ts
const bars = await alpaca.marketData.getCryptoBarsFor("BTC/USD", { loc: "us", timeframe: "1Day", start: new Date("2024-01-01") });
```

##### `alpaca.marketData.getOptionBarsFor`

Single-symbol historical option bars as canonical `Bar[]` (unwrapped).

```ts
const bars = await alpaca.marketData.getOptionBarsFor("AAPL250117C00150000", { timeframe: "1Day", start: new Date("2024-01-01") });
```

##### `alpaca.marketData.getStockTradesFor`

Single-symbol historical stock trades as canonical `Trade[]` (unwrapped).

```ts
const trades = await alpaca.marketData.getStockTradesFor("AAPL", { start: new Date("2024-01-02") });
```

##### `alpaca.marketData.getCryptoTradesFor`

Single-symbol historical crypto trades as canonical `Trade[]` (unwrapped).

```ts
const trades = await alpaca.marketData.getCryptoTradesFor("BTC/USD", { loc: "us", start: new Date("2024-01-02") });
```

##### `alpaca.marketData.getStockQuotesFor`

Single-symbol historical stock quotes as canonical `Quote[]` (unwrapped).

```ts
const quotes = await alpaca.marketData.getStockQuotesFor("AAPL", { start: new Date("2024-01-02") });
```

##### `alpaca.marketData.getCryptoQuotesFor`

Single-symbol historical crypto quotes as canonical `Quote[]` (unwrapped).

```ts
const quotes = await alpaca.marketData.getCryptoQuotesFor("BTC/USD", { loc: "us", start: new Date("2024-01-02") });
```

##### `alpaca.marketData.getStockCandlesFor`

Single-symbol historical stock bars as chart-ready columnar `Candles` (unwrapped).

```ts
const candles = await alpaca.marketData.getStockCandlesFor("AAPL", { timeframe: "1Day", start: new Date("2024-01-01") });
```

##### `alpaca.marketData.getCryptoCandlesFor`

Single-symbol historical crypto bars as chart-ready columnar `Candles` (unwrapped).

```ts
const candles = await alpaca.marketData.getCryptoCandlesFor("BTC/USD", { loc: "us", timeframe: "1Day", start: new Date("2024-01-01") });
```

#### `alpaca.marketData` — pagination helpers

Auto-paginated iterate/collect helpers across every paginated market-data endpoint; the page token is managed for you.

##### `alpaca.marketData.iterateStockBars`

Lazily yield `{ symbol, value }` stock-bar records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateStockBars({
  symbols: ["AAPL"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
})) console.log(symbol, value.c);
```

##### `alpaca.marketData.collectStockBarsBySymbol`

Collect stock bars merged into a `{ [symbol]: StockBar[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectStockBarsBySymbol({
  symbols: ["AAPL", "MSFT"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateStockTrades`

Lazily yield stock-trade records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateStockTrades({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.p);
```

##### `alpaca.marketData.collectStockTradesBySymbol`

Collect stock trades merged into a `{ [symbol]: StockTrade[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectStockTradesBySymbol({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateStockQuotes`

Lazily yield stock-quote records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateStockQuotes({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.bp);
```

##### `alpaca.marketData.collectStockQuotesBySymbol`

Collect stock quotes merged into a `{ [symbol]: StockQuote[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectStockQuotesBySymbol({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateStockAuctions`

Lazily yield daily-auction records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateStockAuctions({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.d);
```

##### `alpaca.marketData.collectStockAuctionsBySymbol`

Collect stock auctions merged into a `{ [symbol]: StockDailyAuctions[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectStockAuctionsBySymbol({
  symbols: ["AAPL"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateCryptoBars`

Lazily yield crypto-bar records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateCryptoBars({
  loc: "us",
  symbols: ["BTC/USD"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
})) console.log(symbol, value.c);
```

##### `alpaca.marketData.collectCryptoBarsBySymbol`

Collect crypto bars merged into a `{ [symbol]: CryptoBar[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectCryptoBarsBySymbol({
  loc: "us",
  symbols: ["BTC/USD"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateCryptoTrades`

Lazily yield crypto-trade records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateCryptoTrades({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.p);
```

##### `alpaca.marketData.collectCryptoTradesBySymbol`

Collect crypto trades merged into a `{ [symbol]: CryptoTrade[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectCryptoTradesBySymbol({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateCryptoQuotes`

Lazily yield crypto-quote records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateCryptoQuotes({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.bp);
```

##### `alpaca.marketData.collectCryptoQuotesBySymbol`

Collect crypto quotes merged into a `{ [symbol]: CryptoQuote[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectCryptoQuotesBySymbol({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateOptionBars`

Lazily yield option-bar records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateOptionBars({
  symbols: ["AAPL250117C00150000"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
})) console.log(symbol, value.c);
```

##### `alpaca.marketData.collectOptionBarsBySymbol`

Collect option bars merged into a `{ [symbol]: OptionBar[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectOptionBarsBySymbol({
  symbols: ["AAPL250117C00150000"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateOptionTrades`

Lazily yield option-trade records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateOptionTrades({
  symbols: ["AAPL250117C00150000"],
  start: new Date("2024-01-02"),
})) console.log(symbol, value.p);
```

##### `alpaca.marketData.collectOptionTradesBySymbol`

Collect option trades merged into a `{ [symbol]: OptionTrade[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectOptionTradesBySymbol({
  symbols: ["AAPL250117C00150000"],
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateIndexValues`

Lazily yield index-value records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateIndexValues({
  symbols: ["SPX"],
  start: new Date("2024-01-01"),
})) console.log(symbol, value);
```

##### `alpaca.marketData.collectIndexValuesBySymbol`

Collect index values merged into a `{ [symbol]: IndexValue[] }` map.

```ts
const bySymbol = await alpaca.marketData.collectIndexValuesBySymbol({
  symbols: ["SPX"],
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateForexRates`

Lazily yield forex-rate records across currency pairs and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateForexRates({
  currencyPairs: ["EUR/USD"],
  start: new Date("2024-01-01"),
})) console.log(symbol, value);
```

##### `alpaca.marketData.collectForexRatesBySymbol`

Collect forex rates merged into a `{ [pair]: ForexRate[] }` map.

```ts
const byPair = await alpaca.marketData.collectForexRatesBySymbol({
  currencyPairs: ["EUR/USD"],
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateOptionSnapshots`

Lazily yield `{ symbol, value }` option-snapshot records across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateOptionSnapshots({
  symbols: ["AAPL250117C00150000"],
})) console.log(symbol, value);
```

##### `alpaca.marketData.collectOptionSnapshotsBySymbol`

Collect option snapshots into a `{ [symbol]: OptionSnapshot }` map.

```ts
const bySymbol = await alpaca.marketData.collectOptionSnapshotsBySymbol({
  symbols: ["AAPL250117C00150000"],
});
```

##### `alpaca.marketData.iterateOptionChain`

Lazily yield an underlying's option-chain snapshots across symbols and pages.

```ts
for await (const { symbol, value } of alpaca.marketData.iterateOptionChain({
  underlyingSymbol: "AAPL",
})) console.log(symbol, value);
```

##### `alpaca.marketData.collectOptionChainBySymbol`

Collect an option chain's snapshots into a `{ [symbol]: OptionSnapshot }` map.

```ts
const chain = await alpaca.marketData.collectOptionChainBySymbol({
  underlyingSymbol: "AAPL",
});
```

##### `alpaca.marketData.iterateStockBarSingle`

Lazily yield a single symbol's stock bars across all pages.

```ts
for await (const bar of alpaca.marketData.iterateStockBarSingle({
  symbol: "AAPL",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
})) console.log(bar.c);
```

##### `alpaca.marketData.collectStockBarSingle`

Collect a single symbol's stock bars into one `StockBar[]` array.

```ts
const bars = await alpaca.marketData.collectStockBarSingle({
  symbol: "AAPL",
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

##### `alpaca.marketData.iterateStockTradeSingle`

Lazily yield a single symbol's stock trades across all pages.

```ts
for await (const trade of alpaca.marketData.iterateStockTradeSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
})) console.log(trade.p);
```

##### `alpaca.marketData.collectStockTradeSingle`

Collect a single symbol's stock trades into one `StockTrade[]` array.

```ts
const trades = await alpaca.marketData.collectStockTradeSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateStockQuoteSingle`

Lazily yield a single symbol's stock quotes across all pages.

```ts
for await (const quote of alpaca.marketData.iterateStockQuoteSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
})) console.log(quote.bp);
```

##### `alpaca.marketData.collectStockQuoteSingle`

Collect a single symbol's stock quotes into one `StockQuote[]` array.

```ts
const quotes = await alpaca.marketData.collectStockQuoteSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateStockAuctionSingle`

Lazily yield a single symbol's daily auctions across all pages.

```ts
for await (const auction of alpaca.marketData.iterateStockAuctionSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
})) console.log(auction.d);
```

##### `alpaca.marketData.collectStockAuctionSingle`

Collect a single symbol's daily auctions into one array.

```ts
const auctions = await alpaca.marketData.collectStockAuctionSingle({
  symbol: "AAPL",
  start: new Date("2024-01-02"),
});
```

##### `alpaca.marketData.iterateNews`

Lazily yield news articles across all pages.

```ts
for await (const article of alpaca.marketData.iterateNews({
  symbols: ["AAPL"],
})) console.log(article.headline);
```

##### `alpaca.marketData.collectNews`

Collect news articles into one `News[]` array.

```ts
const articles = await alpaca.marketData.collectNews({ symbols: ["AAPL"] });
```

##### `alpaca.marketData.iterateCorporateActionsPages`

Lazily yield each page's `CorporateActions` envelope, following the token.

```ts
for await (const page of alpaca.marketData.iterateCorporateActionsPages({
  symbols: ["AAPL"],
})) console.log(page.cashDividends);
```

##### `alpaca.marketData.collectCorporateActions`

Collect corporate actions across pages into one merged `CorporateActions` object.

```ts
const actions = await alpaca.marketData.collectCorporateActions({
  symbols: ["AAPL"],
  start: new Date("2024-01-01"),
});
```

<!-- API-REFERENCE:END -->

