---
"@alpacahq/alpaca-trade-api": minor
---

Harden HTTP redirect handling to prevent credential leakage. Requests now
default to `redirect: "error"`, so a `3xx` redirect fails fast instead of being
followed. Alpaca's APIs never redirect, and following one off-host would forward
the `APCA-API-KEY-ID`/`APCA-API-SECRET-KEY` headers to the redirect target —
unlike `Authorization`, custom headers are not stripped on a cross-origin
redirect, so this closes a secret-leak vector. A new `redirect` option (client
option and `Configuration` parameter; per-call `initOverrides.redirect` still
wins) lets you opt back into `"follow"` when fronting the API with a redirecting
proxy.
