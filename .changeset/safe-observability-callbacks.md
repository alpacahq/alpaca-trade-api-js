---
"@alpacahq/alpaca-trade-api": patch
---

Isolate logging and metrics callback failures so observability cannot reject a
successful API request or replace its original error.
