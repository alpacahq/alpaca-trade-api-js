# @alpacahq/alpaca-trade-api

## 4.0.0-alpha.3

### Minor Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`41f05d1`](https://github.com/alpacahq/alpaca-trade-api-js/commit/41f05d13969849050483df78cdc6d4ea85b679c3) Thanks [@Azein](https://github.com/Azein)! - Preserve full precision for 64-bit trade ids on the REST side, matching the live stream:

  - **Lossless market-data JSON.** The market-data REST transport now parses response bodies losslessly, so integer ids beyond `2^53` (in practice crypto trade ids) no longer lose precision. The trading transport is unaffected.
  - **`idRaw` on REST canonical trades.** `getStockTrades`/`getCryptoTrades` (and their `*For` variants) now expose an exact `idRaw?: string` alongside the convenient `id: number` — identical to the WebSocket stream, so ids backfilled over REST match live ones. Use `idRaw` to compare, store, or key on an id.
  - **Raw-model note (behavioral).** On the raw generated models an id past `2^53` (a crypto trade `.i`) now surfaces as a `string` at runtime rather than a lossy `number`, even though the generated type says `number`. Prefer the canonical accessors, or read the raw `.i` as the exact string. Stock/option ids, news ids, sizes, volumes, and counts are unaffected.

## 4.0.0-alpha.2

### Minor Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`8fe1d2a`](https://github.com/alpacahq/alpaca-trade-api-js/commit/8fe1d2a072b9c88e08ca0121fcdd814506b4c7b7) Thanks [@Azein](https://github.com/Azein)! - Preserve full precision for market-data identifiers and extend `timestampRaw` coverage, all additively:

  - **Lossless 64-bit stream ids.** The market-data WebSocket now decodes trade/news ids as exact values and exposes them as strings alongside the numeric field: `idRaw` on trades and cancel-errors, `originalIdRaw`/`correctedIdRaw` on corrections, and `idRaw` on news. This prevents precision loss for ids beyond `2^53`; other numeric fields remain a plain `number`.
  - **`timestampRaw` on more canonical shapes.** New `getIndexValues` and `getStockAuctions` accessors return canonical `IndexValue` / `DailyAuctions` shapes that carry the full-precision `timestampRaw` (per auction print), matching `Bar`/`Trade`/`Quote`.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`8fe1d2a`](https://github.com/alpacahq/alpaca-trade-api-js/commit/8fe1d2a072b9c88e08ca0121fcdd814506b4c7b7) Thanks [@Azein](https://github.com/Azein)! - Market-data timestamps now carry an additive `timestampRaw` (RFC-3339, nanosecond precision) alongside the existing millisecond `timestamp: Date`, on both the WebSocket stream and the REST canonical `Bar`/`Trade`/`Quote` shapes. Fixes the v3 nanosecond-truncation issue ([#250](https://github.com/alpacahq/alpaca-trade-api-js/issues/250)) without any breaking changes.

## 4.0.0-alpha.1

### Minor Changes

- Added imbalances stream channel + validateConnection

## 4.0.0-alpha.0

### Major Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`acb1837`](https://github.com/alpacahq/alpaca-trade-api-js/commit/acb18371ba01ca55076f3427f9d3048223f0cc5e) Thanks [@Azein](https://github.com/Azein)! - Complete TypeScript rewrite (alpha). New unified `Alpaca` client for the Trading and Market Data APIs with typed errors, retry/timeout/rate limiting, pagination helpers, ergonomic order builders, and real-time streaming. Dual ESM+CJS build with edge/worker/deno export conditions. Requires Node >= 20.

### Minor Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`7a1ce54`](https://github.com/alpacahq/alpaca-trade-api-js/commit/7a1ce549ac553220a383f2d9bd13de3634d10894) Thanks [@Azein](https://github.com/Azein)! - Harden HTTP redirect handling to prevent credential leakage. Requests now
  default to `redirect: "error"`, so a `3xx` redirect fails fast instead of being
  followed. Alpaca's APIs never redirect, and following one off-host would forward
  the `APCA-API-KEY-ID`/`APCA-API-SECRET-KEY` headers to the redirect target —
  unlike `Authorization`, custom headers are not stripped on a cross-origin
  redirect, so this closes a secret-leak vector. A new `redirect` option (client
  option and `Configuration` parameter; per-call `initOverrides.redirect` still
  wins) lets you opt back into `"follow"` when fronting the API with a redirecting
  proxy.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`7a1ce54`](https://github.com/alpacahq/alpaca-trade-api-js/commit/7a1ce549ac553220a383f2d9bd13de3634d10894) Thanks [@Azein](https://github.com/Azein)! - Bring the REST transport to parity with the Alpaca Java client's resilience and
  response surfaces:

  - **Retry observability.** The `retry` config now accepts `onRetry` and
    `onGiveUp` hooks, each fired with a `RetryEvent`
    (`{ method, url, attempt, maxRetries, delayMs, status?, error? }`): `status`
    for status-based retries, `error` for transient network-error retries.
    `onRetry` fires before each delayed retry; `onGiveUp` fires once when a
    retryable failure exhausts all attempts. They are pure observability hooks —
    exceptions thrown from a listener are swallowed so they can never break a
    request.
  - **Typed response-with-headers.** New `withResponse(...)` helper wraps any
    generated `*Raw` call and returns a typed `AlpacaApiResponse<T>`
    (`{ data, status, headers, rateLimit }`), so successful calls can expose the
    HTTP status, response headers, and parsed `X-RateLimit-*` metadata alongside
    the deserialized body.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`415f0e5`](https://github.com/alpacahq/alpaca-trade-api-js/commit/415f0e57a8a07817148bb2fd8fcd716bf07b985f) Thanks [@Azein](https://github.com/Azein)! - Bring the real-time streaming layer to parity with the Alpaca Java client:

  - **Awaitable authentication.** Streams now expose `whenAuthenticated()`,
    `waitForAuthentication(timeoutMs?)`, and `waitForAuthenticationResult(timeoutMs?)`,
    resolving with a typed `StreamAuthResult` (`STREAM_AUTH_STATUS` of authenticated,
    server_rejected, closed, or timeout — server rejections include the error code).
  - **Reconnect lifecycle events.** New `reconnecting` (1-based attempt count) and
    `reconnected` (fired after re-auth and re-subscribe) events, with `onReconnecting`
    / `onReconnected` helpers — distinct from the first connect.
  - **Listener isolation + executor offload.** A throwing listener can no longer
    break the stream's protocol, re-subscription, or reconnect handling; a new
    `callbackExecutor` option offloads listener work off the socket thread.
  - **Custom market-data stream URL.** Market-data streams accept an optional `url`
    to route through a proxy/custom host (mirrors the trading stream), bypassing the
    sandbox guard when set.
  - **Subscription validation + production-only guard.** Blank/non-string subscription
    symbols are rejected, and crypto/news streams reject `sandbox` (no sandbox endpoint
    exists); the client `sandbox` flag is no longer applied to crypto/news factories.
