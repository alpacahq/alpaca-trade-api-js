---
title: Market Data
---

# Market Data

The Market Data API has two layers. The raw, generated endpoints
(`alpaca.marketData.stocks.stockBars`, `alpaca.marketData.crypto.cryptoTrades`,
…) remain available for complete API coverage. The ergonomic
**normalized accessors** auto-paginate and return canonical, symbol-keyed shapes
that match the streaming layer, so a historical `Bar` and a live `Bar` share
one type.

## Normalized accessors

`get<Asset><Thing>` auto-paginates and returns canonical `Bar` / `Trade` /
`Quote` data keyed by symbol:

```ts
import { Alpaca, TimeFrame } from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({ keyId, secret });

// Symbol-keyed map: { AAPL: Bar[], MSFT: Bar[] }
const bars = await alpaca.marketData.getStockBars({
  symbols: ["AAPL", "MSFT"],
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
});

const trades = await alpaca.marketData.getCryptoTrades({
  loc: "us",
  symbols: ["BTC/USD"],
  start: new Date("2024-01-02"),
});
```

Each accessor has a single-symbol **`*For(symbol)`** variant that returns the
unwrapped value (an array, not a symbol map):

```ts
const aapl = await alpaca.marketData.getStockBarsFor("AAPL", {
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
});
```

`*For` always reads the **exact requested key** from Alpaca's symbol map. If that
key is absent it returns `[]`; it never substitutes data from another symbol.
The candle variants return an empty `Candles` object (empty column arrays) when
the requested symbol is absent.

The normalized layer includes stock, crypto, and option bars; stock and crypto
trades and quotes; index values; and stock auctions. Corresponding chart-ready
candle and single-symbol variants are available where applicable. Browse the
complete helper inventory in the
[Ergonomic Helpers Reference](./api/ergonomic-helpers.md).

### Normalize generated endpoint results manually

If you call generated endpoints directly, use the exported `marketDataShapes`
helpers to convert their raw symbol maps into the same canonical records used by
the facade and streaming clients:

Required symbol-map fields are always objects after deserialization. If Alpaca
returns `null` or omits one of these maps when no data matches, the generated
client normalizes it to `{}`. Individual requested symbols may still be absent
from a populated map.

```ts
import {
  Alpaca,
  marketDataShapes,
  TimeFrame,
} from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
});

const rawBars = await alpaca.marketData.stocks.stockBars({
  symbols: "AAPL,MSFT",
  timeframe: TimeFrame.Day,
});
const barsBySymbol = marketDataShapes.toBarsBySymbol(rawBars.bars);

const rawTrades = await alpaca.marketData.stocks.stockTrades({ symbols: "AAPL" });
const tradesBySymbol = marketDataShapes.toTradesBySymbol(
  rawTrades.trades,
  marketDataShapes.toStockTrade,
);

const rawQuotes = await alpaca.marketData.stocks.stockQuotes({ symbols: "AAPL" });
const quotesBySymbol = marketDataShapes.toQuotesBySymbol(
  rawQuotes.quotes,
  marketDataShapes.toStockQuote,
);
```

Choose the asset-specific trade or quote mapper (`toStockTrade`,
`toCryptoTrade`, `toStockQuote`, and so on). These pure helpers stamp the symbol
from each map key and normalize fields without another network request.

### Timestamp precision

Canonical `Bar` / `Trade` / `Quote` records include `timestampRaw?: string` —
the original RFC-3339 timestamp with full **nanosecond** precision (e.g.
`"2024-01-02T03:04:05.678099211Z"`) — alongside the millisecond `timestamp:
Date`. The same fields appear on the live stream, so historical and real-time
records stay identical.

The canonical **index-value** (`getIndexValues`) and **stock-auction**
(`getStockAuctions`) accessors carry the same `timestampRaw` on every record
(each opening/closing auction print for auctions), so those endpoints no longer
silently truncate to milliseconds when you reach for the canonical shape.

> Note: raw generated models for fully-deserialized endpoints (e.g. latest
> orderbooks, fixed-income, perp-futures) still surface only a millisecond
> `Date`; prefer the canonical accessors above where nanosecond precision
> matters.

### Trade-id precision

Trade ids are 64-bit integers that can exceed JavaScript's safe integer range
(`2^53`) — notably crypto trade ids. The lossless market-data REST parser
converts any integer token beyond `2^53` to a string at runtime. Canonical trade
IDs then receive dedicated `idRaw` normalization: `Trade` records expose
`idRaw?: string` (exact) alongside `id: number` (convenient, but lossy past
`2^53`) — identical to the live stream, so historical and real-time ids match.

```ts
const trades = await alpaca.marketData.getCryptoTrades({ symbols: "BTC/USD", loc: "us" });
const t = trades["BTC/USD"][0];
t.id;    // number — fine to display, lossy past 2^53
t.idRaw; // e.g. "8857581800245878123" — exact; use this to compare/store/key
```

> Note: on **raw** generated models any unsafe integer can therefore arrive as a
> `string` at runtime even when the generated type says `number` (for example,
> `alpaca.marketData.crypto.cryptoTrades(...).trades[sym][i].i`). Use the
> canonical accessors for dedicated ID normalization, and treat any raw unsafe
> integer as its exact string.

See [Values & types](./types-and-values.md#timestamps-and-64-bit-ids) for the
general precision rule.

### Chart-ready candles

`get<Asset>Candles` (and `get<Asset>CandlesFor`) return the same data in a
chart-ready **columnar** form (parallel arrays of `o`/`h`/`l`/`c`/`v`/…) instead
of an array of objects:

```ts
const candles = await alpaca.marketData.getStockCandles({
  symbols: ["AAPL"],
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
});
```

Pure helpers also reshape a canonical `Bar[]` for plotting libraries:

```ts
import {
  toCandles,
  toCandlestickSeries,
  toLineSeries,
} from "@alpacahq/alpaca-trade-api";

toCandles(bars.AAPL);
toCandlestickSeries(bars.AAPL);
toLineSeries(bars.AAPL, "close");
```

## Latest price

`getLatestPrice` resolves to the latest trade price for a symbol as a plain
`number` (or `undefined` if unavailable):

```ts
const price = await alpaca.marketData.getLatestPrice("AAPL");
```

## Feeds and the free-tier delay

Feed access comes from your Alpaca data subscription, not from paper versus live
trading:

- US-equity REST endpoints accept `feed`: `iex` is the free feed; `sip` covers
  all US exchanges and requires the corresponding subscription; `otc` and
  `boats` are also supported where the endpoint allows them.
- REST helpers do not force a feed. When omitted, Alpaca selects the best feed
  your subscription allows, which is normally `iex` on the free plan.
- Stock streaming defaults to `feed: "iex"` so free-plan credentials work
  without extra configuration. Request `sip` explicitly only when entitled.
- On the free plan, recent SIP data inside the last 15 minutes is restricted.
  An explicit recent `sip` query can return a guided 403. With `iex`, the
  trailing window can be sparse or empty; if you need a reliably populated
  historical window, set `end` at least 15 minutes in the past.

The SDK does not silently clamp `end`, because that would hide recent data from
paid subscribers.

The `paper` option is irrelevant to market data. It switches trading hosts, but
market-data REST and stream calls continue to use the market-data service.
Entitlements depend on the subscription and `feed`.

## Next steps

- Browse the curated generated-endpoint and facade overview in the
  **[Market Data API Reference](./api/market-data.md)**. For the complete
  installed surface, use the published TypeScript declarations and your editor.
- Stream the same canonical shapes in
  **[Streaming & Events](./streaming.md)**.
- Bound or fan out large histories with **[Pagination](./pagination.md)**.
- Review precision and timeframe conventions in
  **[Values & types](./types-and-values.md)**.
