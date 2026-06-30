---
sidebar_position: 4
title: Resilience & configuration
---

# Resilience & configuration

All resilience features are configured on the `Alpaca` client (or a raw
`Configuration`).

```ts
const alpaca = new Alpaca({
  keyId,
  secret,
  timeoutMs: 30_000,
  retry: { maxRetries: 2, retryDelayMs: 250 },
  rateLimit: { maxRequests: 200, intervalMs: 60_000 },
  redirect: "error",
});
```

## Retry

On the `Alpaca` client, retry is **on by default** (3 attempts = 1 initial + 2
retries) with exponential `250ms`..`5s` backoff, `±20%` jitter, and the retryable
status set `408, 425, 429, 500, 502, 503, 504`. Only safe/idempotent verbs
(`GET/HEAD/OPTIONS/TRACE`) and transient network failures are retried — a
non-idempotent `POST`/`PATCH`/etc. is never auto-retried, so an order can't be
silently duplicated (use an `Idempotency-Key` to make a `POST` safely retryable
yourself). A `Retry-After` header is honored over the computed delay.

### Observability

Pass `onRetry` and `onGiveUp` to observe attempts. Each fires with a `RetryEvent`
(`{ method, url, attempt, maxRetries, delayMs, status?, error? }`): `status` for
status-based retries, `error` for network-error retries. Exceptions thrown from a
listener are swallowed so they can never break a request.

```ts
retry: {
  maxRetries: 3,
  onRetry: (e) => console.warn(`retry ${e.attempt}/${e.maxRetries} in ${e.delayMs}ms`),
  onGiveUp: (e) => console.error(`gave up after ${e.attempt} retries`, e.status ?? e.error),
}
```

## Timeouts

`timeoutMs` wires an `AbortController` into the underlying `fetch` (default 30s;
pass `0` to disable). A per-call `AbortSignal` composes with it — whichever aborts
first wins.

## Redirects

Requests default to `redirect: "error"`, so any `3xx` fails fast instead of being
followed. Alpaca's APIs never redirect, and following one off-host would forward
the `APCA-API-*` secret headers to the redirect target (unlike `Authorization`,
custom headers are not stripped on a cross-origin redirect). Set
`redirect: "follow"` to opt back into the platform default behind a redirecting
proxy.

## Rate limiting

The `Alpaca` client enables a safe default token bucket (~200 req/min, applied
independently to the trading and market-data hosts). Tune it with a `rateLimit`
config or pass `rateLimit: false` to opt out.

## Typed errors & response headers

Non-2xx responses reject with a typed `ApiError` (subclasses: `AuthError` 401,
`PermissionError` 403, `NotFoundError` 404, `ValidationError` 400/422,
`RateLimitError` 429), each carrying `status`, `code`, `rateLimit`, and
`requestId`. For metadata on a **successful** call, wrap the generated `*Raw`
method with `withResponse`:

```ts
import { withResponse } from "@alpacahq/alpaca-trade-api";

const res = await withResponse(alpaca.trading.account.getAccountRaw());
res.data;                 // typed body
res.status;               // 200
res.headers.get("X-Request-ID");
res.rateLimit?.remaining;
```
