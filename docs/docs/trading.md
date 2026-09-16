---
title: Trading
---

# Trading

The trading namespace covers account state, tradable assets, orders, positions,
and account/order events. Start in paper trading, make live mode a deliberate
configuration choice, and give every order a stable client ID.

## Paper and live safety

Trading defaults to the paper host. Keep the setting explicit in applications
that can place orders:

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";

const paper = new Alpaca({ keyId, secret, paper: true });
const live = new Alpaca({ keyId, secret, paper: false });
```

Use separate credentials and deployment configuration for paper and live
accounts. The `paper` flag changes trading REST and trading-stream endpoints;
it does not change market-data entitlements or feeds.

## Accounts and assets

Generated REST APIs are available directly beneath `alpaca.trading`:

```ts
const account = await paper.trading.account.getAccount();
console.log(account.status, account.buyingPower);

const assets = await paper.trading.assets.getV2Assets({
  status: "active",
  assetClass: "us_equity",
});
const aapl = assets.find((asset) => asset.symbol === "AAPL");
console.log(aapl?.tradable, aapl?.fractionable);
```

Money and quantity fields intentionally remain numeric strings. See
[Values & types](./types-and-values.md) before doing arithmetic with them.

## Typed order builders

`alpaca.trading.orders` is the generated `OrdersApi` plus one typed builder per
common order shape. The builders accept `number | string` amounts, normalize
them to wire strings, default `timeInForce` to `"day"`, and enforce required
fields at compile time.

```ts
await paper.trading.orders.market({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  clientOrderId: `market-${crypto.randomUUID()}`,
});

await paper.trading.orders.limit({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  limitPrice: 150,
  clientOrderId: `limit-${crypto.randomUUID()}`,
});

await paper.trading.orders.stop({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  stopPrice: 140,
  clientOrderId: `stop-${crypto.randomUUID()}`,
});

await paper.trading.orders.stopLimit({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  stopPrice: 140,
  limitPrice: 139.5,
  clientOrderId: `stop-limit-${crypto.randomUUID()}`,
});

await paper.trading.orders.trailingStop({
  symbol: "AAPL",
  side: "sell",
  qty: 1,
  trailPercent: 5,
  clientOrderId: `trailing-stop-${crypto.randomUUID()}`,
});

await paper.trading.orders.bracket({
  symbol: "AAPL",
  side: "buy",
  qty: 10,
  limitPrice: 150,
  takeProfit: { limitPrice: 155 },
  stopLoss: { stopPrice: 145, limitPrice: 144.5 },
  clientOrderId: `bracket-${crypto.randomUUID()}`,
});
```

The same facade also provides `oco` and `oto`. Market orders require exactly one
of `qty` or `notional`; trailing stops require exactly one of `trailPrice` or
`trailPercent`.

### Generic and raw escape hatches

For shapes without a dedicated builder, such as multi-leg option orders, use the
near-raw `submit` helper:

```ts
await paper.trading.orders.submit({
  type: "market",
  orderClass: "mleg",
  qty: 1,
  timeInForce: "day",
  clientOrderId: `mleg-${crypto.randomUUID()}`,
  legs: [
    {
      symbol: "AAPL270115C00150000",
      ratioQty: "1",
      side: "buy",
      positionIntent: "buy_to_open",
    },
    {
      symbol: "AAPL270115C00160000",
      ratioQty: "1",
      side: "sell",
      positionIntent: "sell_to_open",
    },
  ],
});
```

The generated method is always available too:

```ts
const clientOrderId = `raw-market-${crypto.randomUUID()}`;

await paper.trading.orders.postOrder({
  postOrderRequest: {
    symbol: "AAPL",
    side: "buy",
    type: "market",
    timeInForce: "day",
    qty: "1",
    clientOrderId,
  },
});
```

## Stable client order IDs and reconciliation

A stable, unique `clientOrderId` makes a placement auditable and gives you a
recovery key. It does not provide response replay: Alpaca rejects another order
that reuses the same ID.

Order-placement `POST`s are never automatically retried. If a `FetchError`
leaves placement ambiguous, query by the same client ID before deciding what to
do next:

```ts
const recovered = await paper.trading.orders.getOrderByClientOrderId({
  clientOrderId,
});
```

A lookup miss is not proof that placement failed, and the SDK does not promise
eventual lookup visibility. Apply your application's reconciliation policy
before any further submission.

## Submit and wait for a terminal state

`submitAndWait` combines the trade-updates stream and one REST placement. It
waits for the server's `listening` acknowledgement, places once per invocation,
never places again after reconnect, and uses one deadline for connection,
authentication, subscription, placement, and terminal-event waiting.

```ts
const filled = await paper.trading.submitAndWait(
  {
    type: "market",
    symbol: "AAPL",
    side: "buy",
    qty: 1,
    clientOrderId: `workflow-${crypto.randomUUID()}`,
  },
  { timeoutMs: 30_000 },
);

console.log(filled.id, filled.status, filled.filledAvgPrice);
```

After an ambiguous placement `FetchError`, this workflow makes one
`getOrderByClientOrderId` request and continues waiting when appropriate. It
does not promise exactly-once execution or eventual lookup visibility.

Post-placement failures reject with `SubmitAndWaitError`. Inspect
`clientOrderId`, optional `orderId`, `phase`, `placementAmbiguous`, and `cause`.
If placement remains ambiguous, reconcile the client ID before resubmitting.

## Close all positions

Use the workflow helper to flatten the account, optionally cancelling open
orders first:

```ts
await paper.trading.closeAllPositions({ cancelOrders: true });
```

This is a consequential operation even in paper trading. In live mode, gate it
behind explicit application authorization and observability.

## Reference and related guides

- Browse every facade method in the
  **[Trading API Reference](./api/trading.md)**.
- Configure environments and OAuth in
  **[Authentication](./authentication.md)**.
- Understand retry and error behavior in
  **[Resilience & configuration](./resilience.md)**.
- Consume order/account events in
  **[Streaming & Events](./streaming.md)**.
