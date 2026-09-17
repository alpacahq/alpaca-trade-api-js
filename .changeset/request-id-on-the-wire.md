---
"@alpacahq/alpaca-trade-api": patch
---

Stamp `X-Request-ID` from logging/metrics `genRequestId` on each request (overwriting a client `headers` value) so logs and `ApiError.requestId` match.
