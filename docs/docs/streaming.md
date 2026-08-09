---
sidebar_position: 6
title: Streaming
---

# Real-time streaming

WebSocket clients for market data (stocks, crypto, options, news) and a trading
stream (order/account updates). Both authenticate automatically, reconnect with
backoff, dispatch their current subscriptions after reconnect authentication,
and ping/pong. The API is a typed `EventEmitter`: register listeners, then
`connect()`.

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" });
stocks.onBar((bar) => console.log(bar));
stocks.onError((msg) => console.error("stream error:", msg));
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();

const updates = alpaca.trading.stream();
updates.onTradeUpdate((u) => console.log(u.event, u.order.symbol));
updates.onConnect(() => updates.subscribeTradeUpdates());
updates.connect();
```

## Available streams

All five factories return a stream sharing the lifecycle below:

| Factory | Stream | Data |
| --- | --- | --- |
| `alpaca.trading.stream()` | `TradingStream` | Order/account updates (JSON) |
| `alpaca.marketData.stockStream()` | `StockDataStream` | US-equity bars/trades/quotes (msgpack) |
| `alpaca.marketData.cryptoStream()` | `CryptoDataStream` | Crypto market data (msgpack) |
| `alpaca.marketData.optionStream()` | `OptionDataStream` | Options market data (msgpack) |
| `alpaca.marketData.newsStream()` | `NewsStream` | Real-time news headlines |

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

- **Awaitable authentication** — `whenAuthenticated()` resolves with a typed
  `StreamAuthResult` (never rejects); `waitForAuthentication(timeoutMs?)` returns
  a `boolean`. Failures carry a `STREAM_AUTH_STATUS` (`server_rejected` with the
  server `code`, `closed`, `timeout`).
- **Reconnect lifecycle** — `onReconnecting((attempt) => …)` (1-based) and
  `onReconnected(() => …)` after re-authentication and re-subscription
  **dispatch**, distinct from the first `onConnect`. This event does not promise
  a server subscription acknowledgement.
- **A custom `url`** on any stream to route through a proxy/gateway, plus a
  `callbackExecutor` to offload listener work — a throwing listener is isolated
  and can never break the stream.

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
the same error channel. Listener/callback-executor failures are isolated too.

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
