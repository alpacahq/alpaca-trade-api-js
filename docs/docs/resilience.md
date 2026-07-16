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
silently replayed by the transport. A `Retry-After` header is honored over the
computed delay for eligible requests.

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

## Order-submission safety

Give each order a stable, unique `clientOrderId` in its request body. This
provides an auditable correlation key and a recovery lookup, but it does not
replay a prior response: Alpaca rejects a duplicate client ID.

```ts
const clientOrderId = `rebalance-${crypto.randomUUID()}`;

await alpaca.trading.orders.market({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  clientOrderId,
});
```

Order-placement `POST`s are never auto-retried. If a `FetchError` makes the
outcome ambiguous, call
`alpaca.trading.orders.getOrderByClientOrderId({ clientOrderId })` before any
further submission. A lookup miss is not proof that the placement failed, and
the SDK does not promise that a record will eventually appear; follow your
application's reconciliation policy.

`submitAndWait` adds a narrowly scoped workflow: it waits for the server's
`listening` acknowledgement for `trade_updates`, then issues one placement per
invocation. It preserves a supplied client ID or creates one once, never
re-places on stream reconnect, and applies one deadline across connect,
authentication, subscription, REST placement, and terminal-event waiting.
After an ambiguous placement `FetchError`, it performs one
`getOrderByClientOrderId` request and continues waiting when appropriate.
Generic `market`/`limit`/`submit` calls do not reconcile automatically. A
timeout can still leave the outcome ambiguous; `submitAndWait` does not promise
exactly-once execution or eventual lookup visibility. Post-placement workflow
failures reject with `SubmitAndWaitError`, which exposes `clientOrderId`, an
optional confirmed `orderId`, `phase`, `placementAmbiguous`, and the original
`cause`. Reconcile the client ID before resubmitting when placement remains
ambiguous.

## Timeouts

`timeoutMs` is a fresh **per-attempt** deadline (default 30s; pass `0` to
disable). Each attempt's budget starts before client-side rate-limit acquisition
and covers the rate-limit wait, pre middleware, `fetch`, error/post middleware,
and successful or error response-body consumption.

Retry backoff is outside the finished attempt's budget; the next attempt gets a
new full deadline. A caller `AbortSignal` spans the whole operation and can
cancel an active attempt or its retry backoff. Cancellation from any phase
rejects with `FetchError`, whose `cause` is an `AbortError` for caller
cancellation or a `TimeoutError` for the attempt deadline. Neither cancellation
kind is retried, and `POST` remains excluded from automatic retry.

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
