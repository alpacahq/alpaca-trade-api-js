---
title: Values & types
---

# Values & types

The SDK keeps Alpaca's wire values truthful and layers conversion helpers on
top. Published TypeScript declarations and your editor are the authority for
exact signatures and model fields in the version you installed.

## Numeric wire strings

Money and quantity fields are numeric strings such as `"1234.56"`. Keeping the
wire string avoids silently introducing IEEE-754 float precision loss. Use the
`values` helpers for display and ordinary numeric calculations:

```ts
import { values } from "@alpacahq/alpaca-trade-api";

values.toNumber(account.buyingPower); // number | undefined
values.toNumberOr(account.cash, 0);   // number with fallback
values.formatMoney(account.equity);   // localized display string
```

`toNumber` returns `undefined` for nullish, empty, or unparseable input and
never returns `NaN`. `formatMoney` is for display only. For exact arithmetic on
large balances, keep the string and use a decimal library such as `big.js` or
`decimal.js`; the SDK does not bundle one.

Typed order builders accept `number | string` amounts for convenience and
normalize them to the strings Alpaca expects.

## Timeframe builders

Facade bar methods require a validated, branded `TimeFrameString`. Use a preset
or builder instead of hand-writing a string:

```ts
import {
  TimeFrame,
  TimeFrameUnit,
  timeFrame,
} from "@alpacahq/alpaca-trade-api";

TimeFrame.Minute;                       // "1Min"
TimeFrame.Day;                          // "1Day"
timeFrame(15, TimeFrameUnit.Minute);    // "15Min"
timeFrame(4, TimeFrameUnit.Hour);       // "4Hour"
```

Minutes allow 1–59, hours 1–23, and day/week/month require an amount of 1.
Invalid combinations throw before a request is sent. The branded result remains
assignable to raw generated request fields that accept `string`.

## Dates and raw generated maps

Trading models deserialize timestamps to `Date`, and market-data models also
declare timestamp fields as `Date`. One low-level exception matters:
multi-symbol/list market-data responses leave their nested symbol-keyed maps
verbatim, so a timestamp in a **raw generated map** can be an ISO string at
runtime even when the generated model says `Date`.

Prefer normalized accessors such as `getStockBars` and `getStockBarsFor`; they
return actual `Date` values. When using a raw map such as
`alpaca.marketData.stocks.stockBars(...)`, normalize defensively:

```ts
const timestamp = values.toDate(rawBar.t);
const iso = values.toISO(rawBar.t);
```

`toDate` and `toISO` return `undefined` for nullish or invalid input.

## Timestamps and 64-bit IDs

JavaScript `Date` keeps millisecond precision. Canonical market-data
`Bar`/`Trade`/`Quote` records expose `timestampRaw?: string` alongside
`timestamp: Date` when the exact RFC-3339 nanosecond timestamp is available.

Trade IDs can exceed JavaScript's safe integer range (`2^53`). Canonical REST
trades and live events expose `idRaw?: string` alongside the convenient
`id: number`; use the raw string to compare, store, or key exact IDs. On raw
generated market-data models, an oversized integer can arrive as a string at
runtime even when the generated type says `number`.

The full endpoint-specific behavior, including corrections and auction/index
timestamps, belongs in [Market Data](./market-data.md#timestamp-precision) and
[Streaming & Events](./streaming.md#timestamp-precision).

## Discovering capabilities

The facade publishes representative, curated maps for all three layers:

- `capabilities.capabilities` lists generated REST accessors and methods.
- `ergonomicCapabilities` lists hand-written helpers and what they wrap.
- `capabilities.streamingCapabilities` lists stream factories.

Use the case-insensitive lookup functions when you know a method name but not
where it lives:

```ts
import {
  findCapabilities,
  findErgonomic,
} from "@alpacahq/alpaca-trade-api";

findCapabilities("getAccount");
// [{ accessor: "trading.account", api: "AccountsApi", ... }]

findErgonomic("getStockBars");
// [{ accessor: "marketData", kind: "normalized", ... }]
```

For curated inventories and examples, use the
[API Reference](./api/index.md). The published TypeScript declarations surfaced
by your editor are the authority for the complete installed surface, including
exact request and response types.
