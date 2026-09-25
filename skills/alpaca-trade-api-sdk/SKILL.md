---
name: alpaca-trade-api-sdk
description: >-
  Integrate and build on @alpacahq/alpaca-trade-api, the Alpaca
  JavaScript/TypeScript SDK for the Trading and Market Data APIs (the unified
  Alpaca client, ergonomic
  order builders, normalized market-data shapes, pagination, typed errors,
  resilience, and real-time streaming). Use when writing or reviewing code that
  imports @alpacahq/alpaca-trade-api, places orders, fetches bars/trades/quotes,
  opens market-data or trading WebSocket streams, or builds a trading bot,
  backtester, or market-data backend on top of this SDK.
---

# Building on @alpacahq/alpaca-trade-api

Guidance for LLMs and coding agents writing applications with
`@alpacahq/alpaca-trade-api`. Packaged `LLMS.md` and the installable Agent Skill
share this exact guidance body; use whichever integration your agent supports:

```bash
npx skills add alpacahq/alpaca-trade-api-js
```

For changes to the SDK repository itself, read the repo-only
[AGENTS.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md)
instead.

This is a **map, not the territory.** It gives you the mental model, the idioms
agents most often get wrong, and where to look. It deliberately omits the full
API surface. Whenever you need specifics, use the hosted guides and curated API
reference for discovery, then confirm exact signatures and response models in
the installed package's TypeScript declarations (`dist/*.d.ts`), your editor's
type information, or the installed `src/` source. Do not guess method signatures
from this file alone.

## Where to look

Paths are relative to the package root—the repository root when developing
here, or `node_modules/@alpacahq/alpaca-trade-api/` when installed. The
published tarball includes `src/`.

| You need… | Read / search |
| --- | --- |
| Workflows, conventions, and safety guidance | Hosted guides: [Getting started](https://alpacahq.github.io/alpaca-trade-api-js/getting-started), [Trading](https://alpacahq.github.io/alpaca-trade-api-js/trading), [Market data](https://alpacahq.github.io/alpaca-trade-api-js/market-data), [Streaming & events](https://alpacahq.github.io/alpaca-trade-api-js/streaming), [Authentication](https://alpacahq.github.io/alpaca-trade-api-js/authentication), [Resilience & configuration](https://alpacahq.github.io/alpaca-trade-api-js/resilience), [Pagination](https://alpacahq.github.io/alpaca-trade-api-js/pagination), [Values & types](https://alpacahq.github.io/alpaca-trade-api-js/types-and-values), [Testing](https://alpacahq.github.io/alpaca-trade-api-js/testing), [Runtime compatibility](https://alpacahq.github.io/alpaca-trade-api-js/runtime-compatibility), [Examples](https://alpacahq.github.io/alpaca-trade-api-js/examples), and [Migration from 3.x](https://alpacahq.github.io/alpaca-trade-api-js/migration). |
| Curated per-method discovery and examples | Hosted [API Reference](https://alpacahq.github.io/alpaca-trade-api-js/api): [Trading](https://alpacahq.github.io/alpaca-trade-api-js/api/trading), [Market data](https://alpacahq.github.io/alpaca-trade-api-js/api/market-data), [Streaming](https://alpacahq.github.io/alpaca-trade-api-js/api/streaming), and [Ergonomic helpers](https://alpacahq.github.io/alpaca-trade-api-js/api/ergonomic-helpers). |
| Exact installed-version signatures and model fields | Installed `dist/*.d.ts`, your editor's type information, or installed `src/`. |
| Runnable end-to-end examples | Hosted [Examples](https://alpacahq.github.io/alpaca-trade-api-js/examples) or the [repository examples](https://github.com/alpacahq/alpaca-trade-api-js/tree/master/examples). |
| The unified client / facade wiring | `src/client.ts` |
| Order builders | `src/orders.ts` |
| Normalized bar/trade/quote shapes + chart helpers | `src/marketDataShapes.ts` |
| Curated, representative discovery maps | `src/capabilities.ts` |
| Shared transport (retry/timeout/rate-limit/errors) | `src/core/runtime.ts` |
| Streaming clients | `src/streaming/` |

When unsure where a method lives, prefer the programmatic lookups below over
guessing, then confirm against the hosted API Reference and installed
TypeScript declarations.

## Mental model: a two-layer facade

The `Alpaca` client bundles every Trading and Market Data API behind one
constructor, reached via the `.trading` and `.marketData` namespaces.

1. **Generated (always present, uniform).** Every generated REST method is
   reachable raw at `alpaca.<group>.<resource>.<method>(...)`—for example,
   `alpaca.trading.assets.getV2Assets()` and
   `alpaca.marketData.stocks.stockBars(...)`. Nothing is hidden.
2. **Ergonomic (additive, never replaces layer 1).** Hand-written conveniences
   sit on top: order builders, normalized market-data accessors, pagination, and
   workflow helpers. The raw method each one wraps remains available.

**The rule:** if there is no ergonomic helper for what you need, use the raw
generated method. You never have to choose between the two layers.

## Setup essentials

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
  paper: true, // DEFAULT. Set false for LIVE trading only deliberately.
});
```

- Credentials resolve from environment variables when omitted:
  `APCA_API_KEY_ID`, `APCA_API_SECRET_KEY`, and `APCA_API_OAUTH_TOKEN`. A
  non-empty explicit `accessToken` selects OAuth; otherwise any non-empty
  explicit key field selects key authentication ahead of an environment token.
  Empty strings are absent. With no explicit scheme, environment OAuth takes
  precedence over environment keys.
- **Never** pass `apiKey` as a plain string. Alpaca needs two distinct headers
  and rejects a single value. Use OAuth via `accessToken`, or
  `auth.apiKeyAuth({ keyId, secret })` for lazy credentials.
- OAuth-only clients **cannot** open WebSocket streams; streaming needs a key
  and secret.

## Idioms agents get wrong

- **Money and quantities are numeric strings** to preserve wire values without
  float loss. Convert for display with `values.toNumber`, `values.toNumberOr`,
  or `values.formatMoney`; for exact arithmetic, keep the string and use a
  decimal library. Never use `parseFloat` blindly for financial arithmetic.
- **Timeframes are branded.** Do not hand-write `"1minute"`; build with
  `TimeFrame.Day` or `timeFrame(15, TimeFrameUnit.Minute)` to produce the
  `TimeFrameString` required by facade bar methods.
- **Orders:** prefer ergonomic builders on `alpaca.trading.orders`
  (`market`, `limit`, `stop`, `stopLimit`, `trailingStop`, `bracket`, `oco`,
  and `oto`). They remove the `postOrder({ postOrderRequest })` wrapper and
  enforce required fields per order kind at compile time. For uncovered shapes
  such as multi-leg `mleg`, use `orders.submit(input)` or raw `postOrder`.
- **Order safety:** agent-generated trading code must put a stable, unique
  `clientOrderId` in every order request and persist it with the strategy's
  audit record. Never add a custom idempotency header and never retry an
  order-placement `POST`. If a `FetchError` makes placement ambiguous, call
  `orders.getOrderByClientOrderId({ clientOrderId })` before any further
  submission. Duplicate client IDs are rejected; they do not replay the prior
  response. A lookup miss is not proof that placement failed, and visibility is
  not guaranteed to become eventual.
- **Pagination is built in.** `iterate*` lazily yields across pages;
  `collect*` and `collect*BySymbol` eagerly return them. Do not thread page
  tokens by hand. For large backfills, pass `SymbolCollectOptions`
  (`maxPerSymbol`, `concurrency`, and `chunkSize`) to bound memory and
  parallelism. Every helper stops before refetching any previously visited
  token or cursor, including longer cycles, after preserving valid pages
  already fetched.
- **REST and streaming share one shape.** Normalized accessors such as
  `getStockBars`, `getCryptoTrades`, single-symbol `*For(symbol)` variants, and
  chart-ready `get*Candles` return the same `Bar`, `Trade`, or `Quote` type that
  streams emit. Raw generated map responses keep Alpaca's compact wire keys and
  may carry ISO-string timestamps; prefer normalized accessors or
  `marketDataShapes.toBar` and related helpers. A single-symbol `*For` reads only
  the exact requested key; absent data is `[]` or empty `Candles`, never another
  symbol's value.
- **Errors are typed.** Non-2xx responses reject with `ApiError` and
  status-specific subclasses: `AuthError` (401), `PermissionError` (403),
  `NotFoundError` (404), `ValidationError` (400/422), and `RateLimitError`
  (429). Branch on the subclass rather than magic numbers. Always log
  `err.requestId` from `X-Request-ID`; it cannot be looked up later.
  Network and abort failures reject with `FetchError`.
- **Resilience defaults depend on the entry point.** The `Alpaca` facade
  defaults to 2 retries (3 attempts total) for eligible idempotent requests.
  Bare generated Configuration retries are off unless configured. Only `GET`,
  `HEAD`, `OPTIONS`, and `TRACE` are automatically retried; `POST`, `PATCH`,
  `PUT`, and `DELETE` are not automatically retried. `timeoutMs`, `retry`,
  `rateLimit`, and `userAgent` are top-level client options. The facade enables
  a safe rate limit near 200 requests/minute; raw `Api` classes do not. `onRetry`
  and `onGiveUp` receive `RetryEvent`; thrown hook exceptions are swallowed so
  observability cannot break a request.
- **Timeout and cancellation scopes matter.** `timeoutMs` is fresh per attempt
  and covers rate-limit waits, middleware, fetch, and response-body reads.
  Backoff is outside that attempt budget; caller abort spans the entire
  operation and backoff. Every cancellation phase throws `FetchError` with an
  `AbortError` or `TimeoutError` cause.
- **Redirects reject by default.** Requests use `redirect: "error"` so secret
  `APCA-API-*` headers cannot follow an off-host redirect. Set
  `redirect: "follow"` only when deliberately opting out.
- **Response metadata:** methods normally return the body. Wrap a generated
  `*Raw` sibling with `withResponse(...)` to receive
  `{ data, status, headers, rateLimit }` as `AlpacaApiResponse<T>`.
- **REST-only builds:** import `@alpacahq/alpaca-trade-api/rest` to keep `ws` and
  `@msgpack/msgpack` out of the module graph. Stream factories and
  `submitAndWait` throw from this entrypoint. Edge and browser runtimes resolve
  the root import to this REST-only build through package export conditions, so
  REST works but streaming does not.
- **ESM and CJS:** do not load the SDK through both `import` and `require` in one
  process if you rely on `instanceof` against classes such as `ApiError`; the
  process may contain two class copies.

## Streaming

WebSocket clients are typed `EventEmitter`s. Register listeners, then call
`connect()`. They authenticate, reconnect with backoff, and resubscribe.

```ts
const stocks = alpaca.marketData.stockStream({ feed: "iex" });
stocks.onBar((bar) => console.log(bar.symbol, bar.close));
stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
stocks.connect();
```

`cryptoStream()`, `optionStream()`, `newsStream()`, and the
`alpaca.trading.stream()` order/trade updates client share the same shape.
Register the trading subscription before connecting. Its authenticated
`onConnect` callback runs before automatic subscription dispatch, so subscribing
there duplicates the initial listen frame:

```ts
const updates = alpaca.trading.stream();
updates.onTradeUpdate((update) =>
  console.log(update.event, update.order.symbol),
);
updates.subscribeTradeUpdates();
updates.connect();
```

The `submitAndWait` workflow waits for the server's `listening`
acknowledgement, then places once per invocation and resolves on a terminal
update. It preserves or creates one client ID, never re-places on reconnect,
and uses one deadline for connect, authentication, subscription, REST
placement, and waiting. Only this helper performs one client-ID lookup after an
ambiguous `FetchError`; generic builders do not reconcile automatically. It
does not guarantee exactly-once execution or eventual lookup visibility.

Every stream also exposes:

- **Awaitable authentication:** `await stream.whenAuthenticated()` returns
  `StreamAuthResult { status, authenticated, code?, message }` and never
  rejects; `waitForAuthentication(timeoutMs?)` returns `boolean`.
- **Reconnect lifecycle:** `onReconnecting((attempt) => …)` receives a
  one-based attempt number, and `onReconnected(...)` runs after authentication
  and resubscription dispatch. It is distinct from first connect and is not
  server subscription acknowledgement.
- **Overrides:** each stream accepts a `url` for proxy/gateway routing and a
  `callbackExecutor` to isolate listeners. A throwing listener is logged and
  does not break the stream.
- **Gotchas:** crypto and news streams are production-only; `sandbox: true`
  throws. Pass `url` to override. Blank or non-string symbols throw at the call
  site. Malformed/decode/mapper failures and trading `action: "error"` messages
  surface through `onError` or `CLIENT_ERROR`.

## Discovering APIs programmatically

```ts
import {
  findCapabilities,
  findErgonomic,
} from "@alpacahq/alpaca-trade-api";

findCapabilities("getAccount");
findErgonomic("market");
```

`capabilities`, `ergonomicCapabilities`, `streamingCapabilities`, and the
hosted API Reference are curated, representative discovery aids, not exhaustive
inventories. Use them to answer “where does this live?” when they contain a
match, then confirm the complete surface in the installed TypeScript
declarations or generated source.

## Testing integrations

`@alpacahq/alpaca-trade-api/testing` is a network-free harness.
`createMockAlpaca([...])` returns a ready client backed by canned responses
matched by method and path; use it so unit tests never hit Alpaca.

## When unsure

Open the relevant hosted guide, search the curated API Reference, then confirm
exact methods and models in the installed TypeScript declarations or generated
source. The declarations and generated source are the complete inventory for
the installed SDK version.
