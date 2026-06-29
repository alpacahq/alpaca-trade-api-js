# Examples

Runnable, end-to-end examples for `@alpacahq/alpaca-trade-api`. They import from the local
source (`../src`) so they run straight from this repo; in your own app the
imports are simply `from "@alpacahq/alpaca-trade-api"` (shown in a comment at the top of each
file).

They are type-checked against the current source as part of `npm run typecheck`
(via `tsconfig.examples.json`), so they cannot silently drift out of sync with
the API.

## Prerequisites

- Node.js >= 20
- Paper-trading API credentials from <https://app.alpaca.markets/paper/dashboard/overview>
- [`tsx`](https://github.com/privatenumber/tsx) to run TypeScript directly
  (`npx tsx ...` will fetch it on first use)

Export your credentials once:

```bash
export APCA_API_KEY_ID="your-key-id"
export APCA_API_SECRET_KEY="your-secret"
```

## [`trading-bot.ts`](./trading-bot.ts)

A paper trading bot: reads the account (formatting money with the `values`
helpers), looks up the latest price, places a resting limit order with the
ergonomic `orders.limit` builder (then cancels it), streams order/account
updates, and places a market order with `submitAndWait` (which blocks until the
order reaches a terminal state). Errors branch on the typed `ApiError`
subclasses (`RateLimitError`, ...) and log Alpaca's request id.

```bash
npx tsx examples/trading-bot.ts
```

## [`marketdata-backend.ts`](./marketdata-backend.ts)

A tiny market-data backend for a visualization frontend. A single live
market-data WebSocket is fanned out to many HTTP clients over Server-Sent
Events, alongside REST routes for the latest price and historical bars. The
live stream and the historical `/bars` route emit the same canonical `Bar`
shape, so a frontend can backfill history then append live updates without
remapping; `/candles` returns the columnar form charting libraries consume.
Upstream failures are surfaced as typed `ApiError`s, mapped to the right HTTP
status with the request id.

```bash
npx tsx examples/marketdata-backend.ts

# in another shell:
curl -N http://localhost:8080/stream
curl "http://localhost:8080/price?symbol=AAPL"
curl "http://localhost:8080/bars?symbol=AAPL&start=2024-01-01"
curl "http://localhost:8080/candles?symbol=AAPL&start=2024-01-01"
```

Configure with `PORT` (default `8080`) and `SYMBOLS` (default `AAPL,MSFT`).
