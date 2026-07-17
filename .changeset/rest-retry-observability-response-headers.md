---
"@alpacahq/alpaca-trade-api": minor
---

Bring the REST transport to parity with the Alpaca Java client's resilience and
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
