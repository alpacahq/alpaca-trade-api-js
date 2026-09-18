---
"@alpacahq/alpaca-trade-api": patch
---

Copy caller headers with `new Headers(...)` so another-realm `Headers` objects are not dropped, and keep a single canonical `X-Request-ID` when a plain header object has differently cased keys.
