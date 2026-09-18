---
"@alpacahq/alpaca-trade-api": patch
---

Send valid observability request UUIDs as `X-Request-ID` so logs and metrics correlate with Alpaca API requests. Custom generators that return non-UUID values now fall back to a generated UUID.
