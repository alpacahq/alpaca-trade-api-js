---
"@alpacahq/alpaca-trade-api": patch
---

Apply a fresh timeout to every request attempt across rate limiting, middleware,
fetch, and body reads while preserving caller cancellation through retry backoff.
