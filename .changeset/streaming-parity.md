---
"@alpacahq/alpaca-trade-api": minor
---

Bring the real-time streaming layer to parity with the Alpaca Java client:

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
