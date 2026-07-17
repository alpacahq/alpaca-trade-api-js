---
"@alpacahq/alpaca-trade-api": minor
---

Market-data timestamps now carry an additive `timestampRaw` (RFC-3339, nanosecond precision) alongside the existing millisecond `timestamp: Date`, on both the WebSocket stream and the REST canonical `Bar`/`Trade`/`Quote` shapes. Fixes the v3 nanosecond-truncation issue (#250) without any breaking changes.
