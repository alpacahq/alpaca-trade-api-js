---
"@alpacahq/alpaca-trade-api": patch
---

Stamp a UUID `X-Request-ID` from logging/metrics middleware on each request (overwriting a client `headers` value) so logs and `ApiError.requestId` match.
