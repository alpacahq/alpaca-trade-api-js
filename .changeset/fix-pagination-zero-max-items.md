---
"@alpacahq/alpaca-trade-api": patch
---

Return an empty array without fetching when `pagination.collect` or `pagination.collectCursor` is called with `maxItems <= 0`.
