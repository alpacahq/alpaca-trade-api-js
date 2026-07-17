# @alpacahq/alpaca-trade-api

## 4.0.1

### Patch Changes

- [#298](https://github.com/alpacahq/alpaca-trade-api-js/pull/298) [`5344968`](https://github.com/alpacahq/alpaca-trade-api-js/commit/5344968b63617c11d3332e167626e4a471e331fc) Thanks [@Azein](https://github.com/Azein)! - Update installation and migration documentation to use the stable 4.x release instead of the alpha channel.

## 4.0.0

### Major Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Complete TypeScript rewrite (alpha). New unified `Alpaca` client for the Trading and Market Data APIs with typed errors, retry/timeout/rate limiting, pagination helpers, ergonomic order builders, and real-time streaming. Dual ESM+CJS build with edge/worker/deno export conditions. Requires Node >= 20.

### Minor Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Added imbalances stream channel + validateConnection

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Preserve full precision for market-data identifiers and extend `timestampRaw` coverage, all additively:

  - **Lossless 64-bit stream ids.** The market-data WebSocket now decodes trade/news ids as exact values and exposes them as strings alongside the numeric field: `idRaw` on trades and cancel-errors, `originalIdRaw`/`correctedIdRaw` on corrections, and `idRaw` on news. This prevents precision loss for ids beyond `2^53`; other numeric fields remain a plain `number`.
  - **`timestampRaw` on more canonical shapes.** New `getIndexValues` and `getStockAuctions` accessors return canonical `IndexValue` / `DailyAuctions` shapes that carry the full-precision `timestampRaw` (per auction print), matching `Bar`/`Trade`/`Quote`.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Preserve full precision for 64-bit trade ids on the REST side, matching the live stream:

  - **Lossless market-data JSON.** The market-data REST transport now parses response bodies losslessly, so integer ids beyond `2^53` (in practice crypto trade ids) no longer lose precision. The trading transport is unaffected.
  - **`idRaw` on REST canonical trades.** `getStockTrades`/`getCryptoTrades` (and their `*For` variants) now expose an exact `idRaw?: string` alongside the convenient `id: number` — identical to the WebSocket stream, so ids backfilled over REST match live ones. Use `idRaw` to compare, store, or key on an id.
  - **Raw-model note (behavioral).** On the raw generated models an id past `2^53` (a crypto trade `.i`) now surfaces as a `string` at runtime rather than a lossy `number`, even though the generated type says `number`. Prefer the canonical accessors, or read the raw `.i` as the exact string. Stock/option ids, news ids, sizes, volumes, and counts are unaffected.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Market-data timestamps now carry an additive `timestampRaw` (RFC-3339, nanosecond precision) alongside the existing millisecond `timestamp: Date`, on both the WebSocket stream and the REST canonical `Bar`/`Trade`/`Quote` shapes. Fixes the v3 nanosecond-truncation issue ([#250](https://github.com/alpacahq/alpaca-trade-api-js/issues/250)) without any breaking changes.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Harden HTTP redirect handling to prevent credential leakage. Requests now
  default to `redirect: "error"`, so a `3xx` redirect fails fast instead of being
  followed. Alpaca's APIs never redirect, and following one off-host would forward
  the `APCA-API-KEY-ID`/`APCA-API-SECRET-KEY` headers to the redirect target —
  unlike `Authorization`, custom headers are not stripped on a cross-origin
  redirect, so this closes a secret-leak vector. A new `redirect` option (client
  option and `Configuration` parameter; per-call `initOverrides.redirect` still
  wins) lets you opt back into `"follow"` when fronting the API with a redirecting
  proxy.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Bring the REST transport to parity with the Alpaca Java client's resilience and
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

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Bring the real-time streaming layer to parity with the Alpaca Java client:

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

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Refresh the Trading API models from the latest Alpaca OpenAPI spec. This is an
  additive, non-breaking update: new `AssetClass` values (`crypto_perp`,
  `treasury`, `corporate`, `global_equity`, `us_index`, `us_equity_chain`), new
  `OptionContractType`, `OptionContractStyle`, `LocateStatus`, `AssetAttribute`,
  and `CryptoChain` types, plus additional fields on `Account`,
  `AccountConfigurations`, `OptionContract`, `Exchange`, `Locate`, and related
  models. No operations were added, removed, or renamed.

### Patch Changes

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Return only the requested symbol from single-symbol market-data helpers and stop
  all pagination helpers safely when any token or cursor is revisited.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Honor explicitly selected key credentials ahead of environment OAuth while
  preserving explicit and environment-only OAuth authentication.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Apply a fresh timeout to every request attempt across rate limiting, middleware,
  fetch, and body reads while preserving caller cancellation through retry backoff.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Keep the REST runtime and declarations free of Node, WebSocket, and msgpack
  requirements for strict Node/no-DOM and edge consumers; align REST-only exports;
  and ship the migration guide plus a binding- and flow-safe v3-to-v4 codemod.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Refresh the generated clients from Alpaca's published OpenAPI specs: add
  tokenization-request lookups, a dedicated watchlist-create input, locate-request
  idempotency keys, and more smart-router destinations; mark crypto withdrawals
  deprecated; and remove withdrawn fixed-income reference and trading
  crypto-perpetual beta endpoints.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Identify the SDK family, package version, and actual Node, Bun, or Deno
  execution runtime in the default User-Agent header.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Isolate logging and metrics callback failures so observability cannot reject a
  successful API request or replace its original error.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Make order submission safer by forwarding stable client order IDs, preventing
  automatic placement retries, and reconciling ambiguous `submitAndWait`
  placements by client ID.

- [#295](https://github.com/alpacahq/alpaca-trade-api-js/pull/295) [`9301d5c`](https://github.com/alpacahq/alpaca-trade-api-js/commit/9301d5cf70db5a2b61bb89d0e7b60d8c483de4d8) Thanks [@Azein](https://github.com/Azein)! - Scope WebSocket events, disconnects, pings, and keepalive timers to their
  originating connection; surface malformed/decode/mapper and trading protocol
  errors without crashing; and report reconnect only after auth and
  re-subscription dispatch.

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
