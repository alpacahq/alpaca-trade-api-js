---
sidebar_position: 5
title: Market data
---

# Market data

The Market Data API has two layers. The raw, generated endpoints
(`alpaca.marketData.stocks.stockBars`, `alpaca.marketData.crypto.cryptoTrades`,
…) are enumerated in the **Market Data API** reference. On top of them the SDK
adds a small, ergonomic layer of **normalized accessors** that handle pagination
and return canonical, symbol-keyed shapes — unified with the streaming layer so
a historical `Bar` and a live `Bar` are the same type.

## Normalized accessors

`get<Asset><Thing>` auto-paginates and returns canonical `Bar` / `Trade` /
`Quote` data keyed by symbol:

```ts
// Symbol-keyed map: { AAPL: Bar[], MSFT: Bar[] }
const bars = await alpaca.marketData.getStockBars({
  symbols: ["AAPL", "MSFT"],
  timeframe: "1Day",
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
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

The same exists for trades and quotes — `getStockTrades` / `getCryptoTrades`,
`getStockQuotes` / `getCryptoQuotes`, and their `*For` variants — across stocks,
crypto, and options (`getOptionBars` / `getOptionBarsFor`).

### Chart-ready candles

`get<Asset>Candles` (and `get<Asset>CandlesFor`) return the same data in a
chart-ready **columnar** form (parallel arrays of `o`/`h`/`l`/`c`/`v`/…) instead
of an array of objects:

```ts
const candles = await alpaca.marketData.getStockCandles({
  symbols: ["AAPL"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

## Latest price

`getLatestPrice` resolves to the latest trade price for a symbol as a plain
`number` (or `undefined` if unavailable):

```ts
const price = await alpaca.marketData.getLatestPrice("AAPL");
```

## Next steps

- Stream the same canonical shapes live in **[Streaming](./streaming.md)**.
- Iterate or collect large histories with the helpers in **[Pagination](./pagination.md)**.
- Browse every raw endpoint in the **Market Data API** reference (sidebar).
