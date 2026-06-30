---
sidebar_position: 6
title: Streaming
---

# Real-time streaming

WebSocket clients for market data (stocks, crypto, options, news) and a trading
stream (order/account updates). Both authenticate automatically, reconnect with
backoff, re-subscribe after a reconnect, and ping/pong. The API is a typed
`EventEmitter`: register listeners, then `connect()`.

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

## Shared lifecycle

Every stream exposes:

- **Awaitable authentication** — `whenAuthenticated()` resolves with a typed
  `StreamAuthResult` (never rejects); `waitForAuthentication(timeoutMs?)` returns
  a `boolean`. Failures carry a `STREAM_AUTH_STATUS` (`server_rejected` with the
  server `code`, `closed`, `timeout`).
- **Reconnect lifecycle** — `onReconnecting((attempt) => …)` (1-based) and
  `onReconnected(() => …)` (after re-auth + re-subscribe), distinct from the first
  `onConnect`.
- **A custom `url`** on any stream to route through a proxy/gateway, plus a
  `callbackExecutor` to offload listener work — a throwing listener is isolated
  and can never break the stream.

```ts
const result = await stocks.whenAuthenticated();
if (!result.authenticated) {
  console.error(`auth failed: ${result.status} ${result.code ?? ""}`);
}
```

:::note Production-only streams
Crypto and news streams have no sandbox endpoint: pass an explicit `url` to point
them elsewhere, otherwise `sandbox: true` throws.
:::

## Common options

In addition to `feed`/`paper`/`sandbox`: `reconnect`, `maxReconnectAttempts`
(`UNLIMITED_RECONNECT_ATTEMPTS` to retry forever), `backoff`,
`initialReconnectMs`, `maxReconnectMs`, `reconnectJitter`, `pingIntervalMs`,
`pongWaitMs`, `url`, and `callbackExecutor`.
