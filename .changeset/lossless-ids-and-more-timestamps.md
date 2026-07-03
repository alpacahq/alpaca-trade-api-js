---
"@alpacahq/alpaca-trade-api": minor
---

Preserve full precision for market-data identifiers and extend `timestampRaw` coverage, all additively:

- **Lossless 64-bit stream ids.** The market-data WebSocket now decodes trade/news ids as exact values and exposes them as strings alongside the numeric field: `idRaw` on trades and cancel-errors, `originalIdRaw`/`correctedIdRaw` on corrections, and `idRaw` on news. This prevents precision loss for ids beyond `2^53`; other numeric fields remain a plain `number`.
- **`timestampRaw` on more canonical shapes.** New `getIndexValues` and `getStockAuctions` accessors return canonical `IndexValue` / `DailyAuctions` shapes that carry the full-precision `timestampRaw` (per auction print), matching `Bar`/`Trade`/`Quote`.
