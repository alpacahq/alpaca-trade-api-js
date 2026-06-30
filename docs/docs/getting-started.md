---
sidebar_position: 2
title: Getting started
---

# Getting started

## Install

```bash
npm install @alpacahq/alpaca-trade-api@alpha
```

## Your first call

Construct the unified `Alpaca` client once with credentials, then reach any
sub-API through it:

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({ keyId: "YOUR_KEY", secret: "YOUR_SECRET" });

// Trading API
const account = await alpaca.trading.account.getAccount();
console.log(account.status, account.buyingPower);

// Market Data API
const bars = await alpaca.marketData.getStockBars({
  symbols: ["AAPL"],
  timeframe: "1Day",
});
```

## Placing an order

`alpaca.trading.orders` adds a typed **order builder** per order kind on top of
the generated `OrdersApi.postOrder` — one verb method each, with required fields
enforced at compile time. The raw `postOrder` (see the **Trading API** reference)
is always still available.

```ts
// Market / limit / stop / stop-limit (exactly one of `qty` / `notional`)
await alpaca.trading.orders.market({ symbol: "AAPL", side: "buy", qty: 1 });
await alpaca.trading.orders.limit({ symbol: "AAPL", side: "buy", qty: 1, limitPrice: 150 });
await alpaca.trading.orders.stop({ symbol: "AAPL", side: "sell", qty: 1, stopPrice: 140 });
await alpaca.trading.orders.stopLimit({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  stopPrice: 140,
  limitPrice: 139,
});

// Trailing stop (one of `trailPrice` / `trailPercent`)
await alpaca.trading.orders.trailingStop({ symbol: "AAPL", side: "sell", qty: 1, trailPercent: 5 });

// Multi-leg: bracket (entry + take-profit + stop-loss), OCO, OTO
await alpaca.trading.orders.bracket({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  takeProfit: { limitPrice: 160 },
  stopLoss: { stopPrice: 140 },
});
```

For shapes the typed builders don't cover (e.g. `mleg`), `orders.submit({ ... })`
is the generic escape hatch.

## Workflow helpers

A few high-level flows that would otherwise be boilerplate live directly on
`alpaca.trading`:

```ts
// Submit and resolve once the order reaches a terminal state (observed over the
// trading stream), instead of polling.
const filled = await alpaca.trading.submitAndWait(
  { type: "market", symbol: "AAPL", side: "buy", qty: 1 },
  { timeoutMs: 30_000 },
);

// Flatten the account: close every open position, optionally cancelling orders first.
await alpaca.trading.closeAllPositions({ cancelOrders: true });
```

## Next steps

- Configure credentials and environments in **[Authentication](./authentication.md)**.
- Tune retries, timeouts, and rate limiting in **[Resilience & configuration](./resilience.md)**.
- Fetch normalized prices and bars in **[Market data](./market-data.md)**.
- Stream live data in **[Streaming](./streaming.md)**.
- Page through large histories in **[Pagination](./pagination.md)**.
