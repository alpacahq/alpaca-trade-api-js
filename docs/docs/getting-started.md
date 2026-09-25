---
title: Getting Started
---

# Getting Started

## Install

```bash
npm install @alpacahq/alpaca-trade-api
```

Before your first call, create or access a paper account and obtain its paper
credentials. See Alpaca's
[paper-trading documentation](https://docs.alpaca.markets/docs/paper-trading),
then export the key and secret in your shell:

```bash
export APCA_API_KEY_ID="YOUR_PAPER_KEY"
export APCA_API_SECRET_KEY="YOUR_PAPER_SECRET"
```

## Your first call

Create a paper-trading client and make an authenticated account call:

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secret: process.env.APCA_API_SECRET_KEY,
  paper: true,
});

const account = await alpaca.trading.account.getAccount();
console.log(account.status, account.buyingPower);
```

`paper: true` is the default, but keeping it explicit makes the environment easy
to audit. Set `paper: false` only in code paths intended for live trading.

## The two-layer facade

The `Alpaca` client bundles the SDK behind `.trading` and `.marketData`. Within
those namespaces:

1. Generated REST methods are always available at
   `alpaca.<group>.<resource>.<method>(...)`.
2. Hand-written helpers add typed order builders, workflows, normalized data,
   and pagination without hiding the generated layer.

For example, `alpaca.trading.orders.market(...)` is an ergonomic builder. Its
raw generated escape hatch remains
`alpaca.trading.orders.postOrder({ postOrderRequest: ... })`. This rule applies
throughout the SDK: when no helper fits, call the generated method.

## Place one paper order

This sends a real order to your paper account. A stable, unique
`clientOrderId` lets you correlate logs and reconcile an ambiguous network
outcome:

```ts
const clientOrderId = `getting-started-${crypto.randomUUID()}`;

const order = await alpaca.trading.orders.market({
  symbol: "AAPL",
  side: "buy",
  qty: 1,
  clientOrderId,
});

console.log(order.id, order.status, order.clientOrderId);
```

Do not automatically resubmit a placement after a timeout or `FetchError`.
Follow the reconciliation workflow in
[Trading](./trading.md#stable-client-order-ids-and-reconciliation) first.

## Support

- **Library / SDK issues:** Bugs, feature requests, or questions specific to the SDK → [GitHub Issues](https://github.com/alpacahq/alpaca-trade-api-js/issues/new/choose).
- **Security vulnerabilities:** Do not report them publicly. Follow Alpaca's [vulnerability-disclosure process](https://alpaca.markets/security).
- **Account-specific questions:** Contact [Alpaca Support](https://alpaca.markets/support) privately.
- **Alpaca API behavior, missing capabilities, or specification defects:** Search or open an issue in the [Alpaca API issue tracker](https://github.com/alpacahq/Alpaca-API/issues/new/choose).
- **General Alpaca API & platform discussion:** Broader API or platform topics → [Alpaca Community Forum](https://forum.alpaca.markets/).
- **Slack community:** Chat with other developers and the Alpaca community on [Slack](https://alpaca.markets/slack).

## Next steps

- Build account, asset, order, and position workflows in
  **[Trading](./trading.md)**.
- Fetch historical and latest prices in
  **[Market Data](./market-data.md)**.
- Consume real-time updates in
  **[Streaming & Events](./streaming.md)**.
- Configure credentials and environments in
  **[Authentication](./authentication.md)**.
- Tune retries, timeouts, logging, and rate limiting in
  **[Resilience & configuration](./resilience.md)**.
- Upgrading from 3.x? Follow the **[Migration guide](./migration.md)**.
