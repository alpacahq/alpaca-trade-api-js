---
"@alpacahq/alpaca-trade-api": patch
---

Make order submission safer by forwarding stable client order IDs, preventing
automatic placement retries, and reconciling ambiguous `submitAndWait`
placements by client ID.
