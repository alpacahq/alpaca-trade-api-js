---
"@alpacahq/alpaca-trade-api": minor
---

Preserve full precision for 64-bit trade ids on the REST side, matching the live stream:

- **Lossless market-data JSON.** The market-data REST transport now parses response bodies losslessly, so integer ids beyond `2^53` (in practice crypto trade ids) no longer lose precision. The trading transport is unaffected.
- **`idRaw` on REST canonical trades.** `getStockTrades`/`getCryptoTrades` (and their `*For` variants) now expose an exact `idRaw?: string` alongside the convenient `id: number` — identical to the WebSocket stream, so ids backfilled over REST match live ones. Use `idRaw` to compare, store, or key on an id.
- **Raw-model note (behavioral).** On the raw generated models an id past `2^53` (a crypto trade `.i`) now surfaces as a `string` at runtime rather than a lossy `number`, even though the generated type says `number`. Prefer the canonical accessors, or read the raw `.i` as the exact string. Stock/option ids, news ids, sizes, volumes, and counts are unaffected.
