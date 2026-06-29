---
name: alpaca-ts-alpha-sdk
description: >-
  Integrate and build on the @alpacahq/alpaca-ts-alpha TypeScript SDK for the
  Alpaca Trading and Market Data APIs (the unified Alpaca client, ergonomic
  order builders, normalized market-data shapes, pagination, typed errors,
  resilience, and real-time streaming). Use when writing or reviewing code that
  imports @alpacahq/alpaca-ts-alpha, places orders, fetches bars/trades/quotes,
  opens market-data or trading WebSocket streams, or builds a trading bot,
  backtester, or market-data backend on top of this SDK.
---

# Building on @alpacahq/alpaca-ts-alpha

This is a **map, not the territory.** It gives you the mental model, the idioms
agents most often get wrong, and where to look — it deliberately omits the full
API surface. Whenever you need specifics (exact method names, parameters,
response fields), **open the package README and grep the API reference**: the
README is ~2750 lines and its second half is an auto-generated, per-method
reference. Do not guess method signatures from this file alone — confirm in the
README or the source.

## Where the source of truth lives

Paths are relative to the package root — the repo root when developing here, or
`node_modules/@alpacahq/alpaca-ts-alpha/` when installed (`src/` ships in the
published tarball).

| You need… | Read / search |
| --- | --- |
| The full per-method API (all REST methods, streams, ergonomic helpers) | `README.md` → the `## API reference` section (search the heading, then grep for the method name) |
| The narrative docs & idioms | `README.md` → sections before `## API reference` (`Quick start`, `Placing orders`, `Pagination`, `Values & types`, `Normalized market-data shapes`, `Real-time streaming`, …) |
| Runnable end-to-end examples | `examples/trading-bot.ts`, `examples/marketdata-backend.ts` |
| The unified client / facade wiring | `src/client.ts` |
| Order builders | `src/orders.ts` |
| Normalized bar/trade/quote shapes + chart helpers | `src/marketDataShapes.ts` |
| Programmatic capability maps | `src/capabilities.ts` |
| Shared transport (retry/timeout/rate-limit/errors) | `src/core/runtime.ts` |
| Streaming clients | `src/streaming/` |

When unsure where a method lives, prefer the programmatic lookups (below) over
guessing, then confirm against the README.

## Mental model: a two-layer facade

The `Alpaca` client bundles every Trading and Market Data API behind one
constructor, reached via the `.trading` and `.marketData` namespaces.

1. **Generated (always present, uniform).** Every generated REST method is
   reachable raw at `alpaca.<group>.<resource>.<method>(...)` — e.g.
   `alpaca.trading.assets.getV2Assets()`, `alpaca.marketData.stocks.stockBars(...)`.
   Nothing is ever hidden.
2. **Ergonomic (additive, never replaces layer 1).** Hand-written conveniences
   sit on top: order builders, normalized market-data accessors, pagination,
   workflow helpers. The raw method each one wraps is still available.

**The rule:** if there's no ergonomic helper for what you need, the raw
generated method is always there. You never have to choose between them.

## Setup essentials

```ts
import { Alpaca } from "@alpacahq/alpaca-ts-alpha";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
  paper: true, // DEFAULT. set false for LIVE trading — a deliberate flag.
});
```

- Credentials resolve from env vars when omitted: `APCA_API_KEY_ID`,
  `APCA_API_SECRET_KEY`, `APCA_API_OAUTH_TOKEN`. Explicit values win.
- **Never** pass `apiKey` as a plain string — Alpaca needs two distinct headers
  and will reject a single value (the SDK throws a guided error). Use OAuth via
  `accessToken`, or `auth.apiKeyAuth({ keyId, secret })` for lazy credentials.
- OAuth-only clients **cannot** open WebSocket streams (streaming needs
  key/secret).

## Idioms agents get wrong (read these before writing code)

- **Money & quantities are numeric `string`s** (wire-truthful, no float loss).
  Convert for display/compute with the `values` helpers (`values.toNumber`,
  `values.toNumberOr`, `values.formatMoney`); for exact math keep the string and
  feed a decimal library. Never `parseFloat` blindly for arithmetic.
- **Timeframes are branded.** Don't hand-write `"1minute"` (the API rejects it).
  Build with `TimeFrame.Day` / `timeFrame(15, TimeFrameUnit.Minute)` → the
  branded `TimeFrameString` the facade bar methods require.
- **Orders:** prefer the ergonomic builders on `alpaca.trading.orders`
  (`market`, `limit`, `stop`, `stopLimit`, `trailingStop`, `bracket`, `oco`,
  `oto`) — they drop the `postOrder({ postOrderRequest })` wrapper and enforce
  required fields per kind at compile time. For uncovered shapes (e.g. multi-leg
  `mleg`) use `orders.submit(input)` or the raw `postOrder`.
- **Pagination is built in.** `iterate*` lazily yields across all pages;
  `collect*` / `collect*BySymbol` eagerly return them — never thread page tokens
  by hand. For big back-fills pass `SymbolCollectOptions`
  (`maxPerSymbol`, `concurrency`, `chunkSize`) to bound memory / parallelize.
- **REST and streaming share one shape.** The normalized accessors
  (`getStockBars`, `getCryptoTrades`, …; single-symbol `*For(symbol)` variants;
  chart-ready `get*Candles`) return the SAME `Bar`/`Trade`/`Quote` type the
  streams emit — backfill over REST then append live updates without remapping.
  The **raw** generated map responses (e.g. `marketData.stocks.stockBars`) keep
  Alpaca's compact wire keys (`{ o, h, l, c, v, … }`) and may carry ISO-string
  timestamps; prefer the normalized accessors or `marketDataShapes.toBar` etc.
- **Errors are typed.** Non-2xx rejects with `ApiError` and status-specific
  subclasses (`AuthError` 401, `PermissionError` 403, `NotFoundError` 404,
  `ValidationError` 400/422, `RateLimitError` 429). Branch on the subclass, not
  magic numbers. Always log `err.requestId` (Alpaca's `X-Request-ID`) — it can't
  be looked up later. Network/abort failures reject with `FetchError`.
- **Resilience is opt-in but conservative.** `timeoutMs`, `retry`
  (`maxRetries > 0` to enable; non-idempotent POSTs are never auto-retried),
  `rateLimit` (the `Alpaca` client enables a safe ~200/min default; raw `Api`
  classes do not), and `userAgent` are all top-level client options.
- **REST-only builds:** import from `@alpacahq/alpaca-ts-alpha/rest` to keep
  `ws`/`@msgpack/msgpack` out of the module graph. Stream factories and
  `submitAndWait` throw from this entrypoint — import the root package for
  streams. On edge/browser runtimes (Cloudflare Workers/`workerd`, Vercel Edge,
  Deno, browsers) the root import auto-resolves to this REST-only build via the
  package `exports` conditions, so streaming is unavailable there (`ws` can't
  run on edge) but REST works without the `Class extends value [object Module]`
  crash.
- **ESM & CJS dual package:** don't load the SDK through both `import` and
  `require` in one process if you rely on `instanceof` against its classes
  (e.g. `ApiError`) — you may compare against two copies.

## Streaming (quick shape)

WebSocket clients are typed `EventEmitter`s: register listeners, then
`connect()`. They auto-authenticate, reconnect with backoff, and re-subscribe.

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" }); // iex | sip | delayed_sip
stocks.onBar((bar) => {/* canonical Bar */});
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();
```

`cryptoStream()`, `optionStream()`, `newsStream()`, and the trading
`alpaca.trading.stream()` (order/account updates) share the same surface. The
`submitAndWait` workflow helper places an order and resolves on its terminal
state over the trading-updates stream.

## Discovering anything programmatically

```ts
import { findCapabilities, findErgonomic } from "@alpacahq/alpaca-ts-alpha";

findCapabilities("getAccount"); // generated: which Api / accessor hosts it
findErgonomic("market");        // ergonomic: is there a helper, and where
```

`capabilities` / `ergonomicCapabilities` / `streamingCapabilities` are the full
maps. Use these (or grep the README `## API reference`) to answer "where does X
live?" instead of guessing.

## Testing integrations

`@alpacahq/alpaca-ts-alpha/testing` is a network-free harness: `createMockAlpaca([...])`
returns a ready client backed by canned responses matched by method + path; use
it so unit tests never hit Alpaca.

## When you're unsure

Don't stop at this file. Open `README.md` and read the relevant `##` section, or
grep the `## API reference` for the exact method, or read the `src/` module in
the table above. This skill points the way; the README and source are
authoritative.
