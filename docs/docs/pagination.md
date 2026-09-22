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

The common historical bar, trade, quote, and auction helpers yield
`{ symbol, value }` records. Their `collect*BySymbol` variants merge pages into
symbol-keyed arrays:

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

The exact collected shape follows the endpoint:

- **Symbol-keyed arrays** cover stock bars/trades/quotes/auctions, crypto
  bars/trades/quotes, option bars/trades, index values, and forex rates.
- **Symbol-keyed objects** cover option snapshots and option chains, where each
  symbol has one snapshot rather than an array.
- **Top-level arrays** cover news and the single-symbol stock
  bar/trade/quote/auction endpoints.
- Corporate actions use a **corporate-action envelope** whose typed action
  arrays are merged across pages.

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

Cursor-based endpoints use `pagination.paginateCursor` with a cursor extracted
from the last item. It provides the same lazy backpressure: it fetches the next
page only after the current page has been consumed.

```ts
import { pagination, trading } from "@alpacahq/alpaca-trade-api";

const cursorOptions: pagination.CursorOptions<
  trading.GetAccountActivities200ResponseInner
> = {
  fetchPage: (pageToken) =>
    alpaca.trading.accountActivities.getAccountActivities({
      pageToken,
      pageSize: 100,
    }),
  getCursor: (activity) => activity.id,
  pageSize: 100,
};

for await (const activity of pagination.paginateCursor(cursorOptions)) {
  console.log(activity.id);
}
```

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
accepts `maxPerSymbol`. Supply the expected `symbols` to `collectBySymbol` so it
can stop fetching as soon as every requested symbol reaches that bound:

```ts
import {
  marketData,
  pagination,
  TimeFrame,
  trading,
} from "@alpacahq/alpaca-trade-api";

const cursorOptions: pagination.CursorOptions<
  trading.GetAccountActivities200ResponseInner
> = {
  fetchPage: (pageToken) =>
    alpaca.trading.accountActivities.getAccountActivities({
      pageToken,
      pageSize: 100,
    }),
  getCursor: (activity) => activity.id,
  pageSize: 100,
};

const activities = await pagination.collectCursor(cursorOptions, {
  maxItems: 500,
});

const fetchBarsPage: pagination.SymbolMapPageFetcher<marketData.StockBar> =
  async (pageToken) => {
    const response = await alpaca.marketData.stocks.stockBars({
      symbols: "AAPL,MSFT",
      timeframe: TimeFrame.Day,
      start: new Date("2024-01-01"),
      pageToken,
    });
    return {
      data: response.bars ?? {},
      nextPageToken: response.nextPageToken,
    };
  };

const bars = await pagination.collectBySymbol(fetchBarsPage, {
  symbols: ["AAPL", "MSFT"],
  maxPerSymbol: 1_000,
});
```

`collectCursor` and `collectBySymbol` are eager collectors, so set these bounds
when the full history might not fit comfortably in memory. Without expected
symbols, `collectBySymbol` still caps each array but must follow the token chain
to completion because a new symbol could appear on a later page.

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

```ts
import {
  Alpaca,
  pagination,
  TimeFrame,
} from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
});
const bigList = ["AAPL", "MSFT", "GOOG", "AMZN"];
const start = new Date("2024-01-01");
const groups = pagination.chunk(bigList, 25);
const results = await pagination.mapConcurrent(groups, 4, async (symbols) => {
  return alpaca.marketData.getStockBars({
    symbols,
    timeframe: TimeFrame.Day,
    start,
  });
});
```
