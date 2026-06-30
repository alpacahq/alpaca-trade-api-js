---
sidebar_position: 7
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
// Stream `{ symbol, value }` records as they arrive.
for await (const { symbol, value } of alpaca.marketData.iterateStockBars({
  symbols: ["AAPL"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
})) {
  console.log(symbol, value.c);
}

// Or collect everything, keyed by symbol.
const bySymbol = await alpaca.marketData.collectStockBarsBySymbol({
  symbols: ["AAPL", "MSFT"],
  timeframe: "1Day",
  start: new Date("2024-01-01"),
});
```

These cover bars/trades/quotes/auctions for stocks, crypto and options, plus
index values, forex rates, option snapshots/chains, news, and corporate actions.

## The generic `pagination` helper

For any endpoint without a dedicated helper, the exported `pagination` helper
turns a token-taking call into a single async iterator:

```ts
import { pagination } from "@alpacahq/alpaca-trade-api";

for await (const activity of pagination.paginate((pageToken) =>
  alpaca.trading.account.getAccountActivities({ pageToken }),
)) {
  console.log(activity);
}
```

In every case the next page is requested only as you consume the current one, so
large histories stream lazily instead of buffering everything in memory.
