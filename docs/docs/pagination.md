---
title: Pagination
---

# Pagination

Many Alpaca list endpoints return results in pages keyed by a `next_page_token`
(or `page_token`). The SDK manages those tokens for you at two levels.

## Built-in iterate / collect helpers

Most paginated endpoints have a ready-made pair on the facade: an `iterate*`
helper that lazily yields across pages, and a `collect*` helper that eagerly
returns everything. The page token is handled internally.

```ts
// Lazily yield account activities across all pages.
for await (const activity of alpaca.trading.iterateActivities({ activityTypes: ["FILL"] })) {
  console.log(activity.id);
}

// Eagerly collect option contracts into one array.
const contracts = await alpaca.trading.collectOptionsContracts({ underlyingSymbols: "AAPL" });
```

Market data exposes the same shape across every paginated endpoint. The
`collect*BySymbol` variants merge pages into a `{ [symbol]: T[] }` map:

```ts
import { TimeFrame } from "@alpacahq/alpaca-trade-api";

// Stream `{ symbol, value }` records as they arrive.
for await (const { symbol, value } of alpaca.marketData.iterateStockBars({
  symbols: ["AAPL"],
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
})) {
  console.log(symbol, value.c);
}

// Or collect everything, keyed by symbol.
const bySymbol = await alpaca.marketData.collectStockBarsBySymbol({
  symbols: ["AAPL", "MSFT"],
  timeframe: TimeFrame.Day,
  start: new Date("2024-01-01"),
});
```

These cover bars/trades/quotes/auctions for stocks, crypto and options, plus
index values, forex rates, option snapshots/chains, news, and corporate actions.

Every token- and cursor-based helper tracks the full traversal history. If an
endpoint returns any previously visited token/cursor — including a longer cycle
such as `A → B → A` — iteration stops instead of fetching it again. Items and
corporate-action pages already fetched remain yielded/collected; only the
revisited request is suppressed.

## The generic `pagination` helper

For any endpoint without a dedicated helper, the exported `pagination` helper
turns a token-taking call into a single async iterator:

```ts
import { pagination } from "@alpacahq/alpaca-trade-api";

for await (const trade of pagination.paginate(async (pageToken) => {
  const response = await alpaca.marketData.stocks.stockTrades({
    symbols: "AAPL",
    pageToken,
  });
  return {
    items: response.trades?.AAPL ?? [],
    nextPageToken: response.nextPageToken,
  };
})) {
  console.log(trade);
}
```

In every case the next page is requested only as you consume the current one, so
large histories stream lazily instead of buffering everything in memory. The
same full-history cycle guard applies to these generic helpers.

## Bounding large fetches

Eager collection can consume substantial memory. Multi-symbol
`collect*BySymbol` methods and normalized `get*` accessors accept
`SymbolCollectOptions`:

```ts
// Stop after at most 1,000 records for each requested symbol.
const recent = await alpaca.marketData.getStockBars(
  {
    symbols: ["AAPL", "MSFT"],
    timeframe: TimeFrame.Minute,
    start,
  },
  { maxPerSymbol: 1_000 },
);
```

By default, every symbol is multiplexed into one request and its page-token
chain is followed sequentially. The generic `pagination.collect` and
`pagination.collectCursor` accept `maxItems`; `pagination.collectBySymbol`
accepts `maxPerSymbol`.

## Controlled fan-out

For a large basket over a long range, split symbols into chunks and cap the
number of in-flight requests:

```ts
const basket = await alpaca.marketData.getStockBars(
  {
    symbols: bigList,
    timeframe: TimeFrame.Day,
    start,
  },
  {
    concurrency: 4,
    chunkSize: 1,
    maxPerSymbol: 5_000,
  },
);
```

`concurrency` defaults to `1`, preserving the single combined request.
`chunkSize` defaults to `1` and is used when `concurrency > 1`; it controls how
many symbols share each parallel request. The client's rate limiter still
bounds the actual request rate.

For custom fan-out, `pagination.chunk(items, size)` creates consecutive groups,
and `pagination.mapConcurrent(items, concurrency, worker)` preserves input
order while keeping at most the requested number of workers in flight. Its
first rejection rejects the whole operation.
