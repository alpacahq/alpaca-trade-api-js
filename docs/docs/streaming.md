---
title: Streaming & Events
---

# Streaming & Events

WebSocket clients for market data (stocks, crypto, options, news) and a trading
stream (order/trade updates). Both authenticate automatically, reconnect with
backoff, dispatch their current subscriptions after reconnect authentication,
and ping/pong. The API is a typed Node-style `EventEmitter`: register listeners,
then `connect()`.

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" });
stocks.onBar((bar) => console.log(bar));
stocks.onError((msg) => console.error("stream error:", msg));
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();

const updates = alpaca.trading.stream();
updates.onTradeUpdate((u) => console.log(u.event, u.order.symbol));
updates.subscribeTradeUpdates();
updates.connect();
```

Set the trading subscription before `connect()` so the authenticated connection
sends one initial listen frame and reconnects restore the same subscription.

## Server-Sent Events

The facade exposes two short, fetch-based SSE helpers:

- `alpaca.trading.subscribeActivities()`
- `alpaca.marketData.subscribeCorporateActions()`

They delegate to the generated operations, inherit the client's credentials and
environment selection, and return the same single-consumer
`SseSubscription<T>` async iterable:

```ts
const controller = new AbortController();
const activities = await alpaca.trading.subscribeActivities(
  {},
  { signal: controller.signal },
);

try {
  for await (const activity of activities) {
    console.log(activity.activityType, activity.details);
  }
} finally {
  activities.close();
}
```

Unlike WebSocket streams, fetch-based SSE accepts OAuth as well as a key/secret
pair. Pass an `accessToken` provider to the `Alpaca` facade when tokens may
expire; the provider is called again for every reconnect. Authentication
failures (`401`/`403`) are terminal and are not retried.

The raw generated methods remain available when you want the operation names
directly:

- `alpaca.trading.events.subscribeToActivitiesSSE()`
- `alpaca.marketData.corporateActions.subscribeToCorporateActionsEventsSSE()`

Account-activity SSE is not the Trading WebSocket `trade_updates` channel.
Continue using `alpaca.trading.stream()` for real-time order status updates and
workflows such as `submitAndWait`.

Marked live subscriptions reconnect automatically until cancelled. Reconnects
carry the latest event id in `Last-Event-ID` and honor the server's `retry:`
field and HTTP `Retry-After`. Replay may be inclusive, so consumers that need
exactly-once effects must deduplicate by event id. Pass `reconnect: false`, or a
policy such as `{ maxAttempts: 5, maxElapsedMs: 60_000 }`, to bound retries.
`subscription.lastEventId` is safe to persist after handling an event: it tracks
the most recently delivered message rather than later messages already buffered
in the same network chunk. A completed data-less `id:` block is applied only
after all earlier buffered messages have been delivered.
Queries with `until` or `untilId` are finite and end cleanly without reconnecting.
Opening is bounded to two retries by default so the initial `await` cannot retry
forever; set `maxInitialAttempts` explicitly (or `Infinity`) to change that
limit. Once opened, live reconnects remain unlimited unless bounded by policy.

For a successful 200/204 SSE connection, the ordinary SDK `timeoutMs` ends after
the response headers are validated; it never terminates a healthy body after 30
seconds. For a non-2xx response, that same deadline remains active while the SDK
reads the bounded error body used to construct a typed `ApiError`.
`connectTimeoutMs` overrides the deadline per subscription, and `0` disables it.
Other options include opt-in `idleTimeoutMs` / `maxDurationMs`, `basePath` /
`serverIndex`, resource limits, and `onOpen`, `onComment`, and `onReconnect`
diagnostics. Use `subscription.messages()` when you need the raw SSE envelope
(`data`, `event`, `id`, and `retry`) rather than only typed data. Breaking
iteration, `close()`, `abort()`, or aborting the caller signal releases
the reader and prevents further reconnects. A subscription has one consumer; if
you open one but never begin iteration, call `close()` explicitly.

`subscription.closed` distinguishes `{ reason: "eof" }`,
`{ reason: "aborted" }`, and `{ reason: "error", error }`. Iteration still
rejects with the terminal parser, deserialization, HTTP, or transport error.

SSE uses middleware `pre` and `onError` hooks. It intentionally skips `post`
hooks because those hooks receive a cloned response, and cloning a long-lived
body can buffer or stall the stream. Use `onOpen` for response status/header
observability and `onComment` / `onReconnect` for stream diagnostics.

### Available SSE subscriptions

| Facade helper | Raw generated method | Events |
| --- | --- | --- |
| `alpaca.trading.subscribeActivities()` | `trading.events.subscribeToActivitiesSSE()` | Account activities |
| `alpaca.marketData.subscribeCorporateActions()` | `marketData.corporateActions.subscribeToCorporateActionsEventsSSE()` | Corporate-action mutations |

Both helpers are available from the main package and
`@alpacahq/alpaca-trade-api/rest`.

## Available WebSocket streams

All five factories return a stream sharing the lifecycle below:

| Factory | Stream | Data |
| --- | --- | --- |
| `alpaca.trading.stream()` | `TradingStream` | Order/trade updates (JSON) |
| `alpaca.marketData.stockStream()` | `StockDataStream` | US-equity bars/trades/quotes (msgpack) |
| `alpaca.marketData.cryptoStream()` | `CryptoDataStream` | Crypto market data (msgpack) |
| `alpaca.marketData.optionStream()` | `OptionDataStream` | Options market data (msgpack) |
| `alpaca.marketData.newsStream()` | `NewsStream` | Real-time news headlines |

The five WebSocket factories are supported on Node.js and Bun. Generated SSE is
fetch-based and remains available in Node/Bun and REST-capable server runtimes.
Direct browser use is discouraged because it exposes credentials and depends on
API CORS. See
[Runtime & module compatibility](./runtime-compatibility.md#edge--browser-runtimes).

## Timestamp precision

Market-data stream events expose two timestamp fields:

- `timestamp: Date` — millisecond precision, convenient for most uses.
- `timestampRaw?: string` — the full RFC-3339 **nanosecond** timestamp, e.g.
  `"2024-01-02T03:04:05.678099211Z"`.

The market-data stream is msgpack, whose default decoder truncates timestamps to
milliseconds. The SDK installs a custom decoder so `timestampRaw` keeps every
digit Alpaca sends. (This applies to the market-data channels — trades, quotes,
bars, statuses, LULDs, imbalances, corrections, cancel-errors, and orderbooks.)

## Trade-id precision

Trade ids are 64-bit integers, which can exceed JavaScript's safe integer range
(`2^53`). The same custom decoder reads them losslessly, so id-bearing events
expose an exact string alongside the convenient (best-effort) `number`:

- Trades — `id: number` and `idRaw?: string`.
- Cancel-errors — `id: number` and `idRaw?: string`.
- Corrections — `originalId` / `correctedId` (numbers) and
  `originalIdRaw?` / `correctedIdRaw?` (strings).
- News — `id: number` and `idRaw?: string`.

Use `idRaw` whenever you compare, store, or key on an id; `id` remains for
display and small values. Other numeric fields (sizes, volumes, counts) stay a
plain `number`.

The REST canonical trade accessors (`getStockTrades`/`getCryptoTrades`) expose
the same `idRaw`, so ids you backfill over REST match the ones you receive live
— see [Trade-id precision](./market-data.md#trade-id-precision) in the
market-data guide.

## Crypto taker side

Crypto trades carry the aggressor side — who crossed the spread to make the
trade happen:

- `takerSide?: string` — `"B"` (buyer-initiated) or `"S"` (seller-initiated).

Crypto only: equities trade messages carry no taker side on the wire, so the
field stays `undefined` there. The REST canonical accessor (`getCryptoTrades`)
exposes the same field, so taker sides you backfill over REST match the ones
you receive live.

## Shared lifecycle

Every stream exposes:

- **Lifecycle callbacks** — `onConnect(() => …)`, `onDisconnect(() => …)`,
  `onStateChange((state) => …)`, and `onError((message) => …)`. State changes
  expose every transition; a manual `disconnect()` emits the disconnect
  lifecycle exactly once.
- **Awaitable authentication** — `whenAuthenticated()` resolves with the
  stream's eventual typed `StreamAuthResult` (never rejects);
  `waitForAuthenticationResult(timeoutMs?)` also returns a typed result, while
  `waitForAuthentication(timeoutMs?)` is its `boolean` convenience wrapper.
  Failures carry a `STREAM_AUTH_STATUS` (`server_rejected` with the server
  `code`, `closed`, `timeout`). A caller-side timeout from either wait method
  does not settle or overwrite the stream's eventual real authentication
  outcome, so `whenAuthenticated()` and other waiters can still receive it.
- **Reconnect lifecycle** — `onReconnecting((attempt) => …)` (1-based) and
  `onReconnected(() => …)` after re-authentication and re-subscription
  **dispatch**, distinct from the first `onConnect`. This event does not promise
  a server subscription acknowledgement.
- **A custom `url`** on any stream to route through a proxy/gateway, plus a
  `callbackExecutor` to schedule listener work away from the socket callback.
  A synchronously throwing listener is isolated and can never break the stream.

```ts
const result = await stocks.whenAuthenticated();
if (!result.authenticated) {
  console.error(`auth failed: ${result.status} ${result.code ?? ""}`);
}
```

## Connection safety

Lifecycle callbacks, messages, keepalive timers, and reconnect work are scoped
to the socket generation that created them, so a stale socket cannot mutate a
new connection. Ping timers start only after the socket is open. A manual
`disconnect()` suppresses reconnect and emits the disconnect lifecycle exactly
once.

Malformed frames, decode failures, and event-mapper failures are caught and
reported through `onError` / `CLIENT_ERROR` without escaping the socket callback
or crashing the process. The trading protocol's `action: "error"` frames use
the same error channel. Synchronously throwing listeners are isolated too.

Node's event loop still applies: synchronous listener work blocks other
callbacks and socket processing. Keep listeners short or provide a
`callbackExecutor` that schedules application work appropriately; callback
isolation prevents failures, not event-loop starvation.

:::note Production-only streams
Crypto and news streams have no sandbox endpoint: pass an explicit `url` to point
them elsewhere, otherwise `sandbox: true` throws.
:::

:::note Order imbalances
`stockStream` also exposes `subscribeForImbalances([...])` / `onImbalance(...)`.
This channel is equities-only and sparse — Alpaca emits imbalance messages mainly
during limit-up/limit-down halts, so long quiet periods are expected even while
subscribed.
:::

## Common options

In addition to `feed`/`paper`/`sandbox`: `reconnect`, `maxReconnectAttempts`
(`UNLIMITED_RECONNECT_ATTEMPTS` to retry forever), `backoff`,
`initialReconnectMs`, `maxReconnectMs`, `reconnectJitter`, `pingIntervalMs`,
`pongWaitMs`, `url`, and `callbackExecutor`.

For a curated factory and event overview, see the
[Streaming API Reference](./api/streaming.md); the published TypeScript
declarations are the complete surface. For historical/live shape
interoperability, see [Market Data](./market-data.md).
