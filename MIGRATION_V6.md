# Migration guide: `5.x` to `6.0`

Version 6 adopts Alpaca's latest Trading and Market Data OpenAPI documents. It removes operations no longer exposed by the public specifications, adds international-stock v3 coverage, and tightens several generated request and response contracts.

> Still using 3.x? Complete the [3.x to 4.0 migration](MIGRATION.md) first. That guide covers the manual-client to generated-client rewrite and remains the primary migration path. The [migration guide index](MIGRATIONS.md) describes every supported upgrade sequence.

Install the new major:

```bash
npm install @alpacahq/alpaca-trade-api@^6
```

Version 6 does not include a codemod. The breaking changes are concentrated in removed generated APIs and request/model type changes that require application-specific decisions.

## Operations removed from the public generated surface

### Forex Market Data API

The current public Market Data specification intentionally hides the Forex REST operations, so generated SDKs no longer publish them. Version 6 therefore removes:

- `alpaca.marketData.forex` and `marketData.ForexApi`;
- `marketData.LatestRatesRequest` and `marketData.RatesRequest`;
- `marketData.ForexLatestRatesResp`, `marketData.ForexRate`, and `marketData.ForexRatesResp`, including their generated runtime helpers;
- `iterateForexRates` and `collectForexRatesBySymbol`.

The backing endpoints may remain available to specifically entitled integrations, but they are no longer part of the supported public SDK contract. Do not silently substitute a stock, crypto, or fixed-income endpoint because those surfaces have different instruments and semantics. Integrations that still require Forex rates must confirm their supported access path with Alpaca before upgrading.

### Crypto transfer creation

The deprecated `trading.cryptoFunding.createCryptoTransferForAccount()` and `CreateCryptoTransferRequest` model were removed after the upstream `POST /v2/wallets/transfers` sunset. The operation was mistakenly exposed in the Trading API and carried a security risk when trading API keys were shared. Transfer lookup, listing, estimates, and whitelisted-address operations remain available.

Use the Alpaca web application to initiate withdrawals. Do not replace creation with a read operation.

## Clock methods moved to `CalendarApi`

The upstream clock operations are now tagged under Calendar. The generated `trading.ClockApi` export is removed, and `clock`, `clockRaw`, `legacyClock`, and `legacyClockRaw` now live on `trading.CalendarApi`.

The facade preserves source compatibility: `alpaca.trading.clock` remains available and is the same `CalendarApi` instance as `alpaca.trading.calendar`.

```ts
const clock = await alpaca.trading.clock.legacyClock();
const sameClock = await alpaca.trading.calendar.legacyClock();
```

Direct generated-client construction must change:

```ts
// 5.x
const api = new trading.ClockApi(configuration);

// 6.0
const api = new trading.CalendarApi(configuration);
```

## Historical stock-bar adjustments

The generated stock-bar operations now represent `adjustment` as `StockAdjustment[]` and serialize it as a comma-separated query value.

```ts
await alpaca.marketData.stocks.stockBars({
  symbols: "AAPL",
  timeframe: "1Day",
  adjustment: [marketData.StockAdjustment.All],
});
```

The ergonomic helpers continue to accept both the existing scalar shorthand, including variables typed as `string`, and the generated array form. This compatibility applies to `getStockBars`, `getStockBarsFor`, `getStockCandles`, `getStockCandlesFor`, `iterateStockBars`, `collectStockBarsBySymbol`, `iterateStockBarSingle`, and `collectStockBarSingle`.

```ts
await alpaca.marketData.getStockBarsFor("AAPL", {
  timeframe: TimeFrame.Day,
  adjustment: marketData.StockAdjustment.All,
});
```

JavaScript callers of raw `stocks.stockBars()` or `stocks.stockBarSingle()` must update scalar values. Passing `"all"` directly to those generated methods now fails at runtime because generated serialization calls `.join()`.

## `stockMetaExchanges` request positioning

`stockMetaExchanges` gained an optional request object for the `End-User-Id` header. Its generated signature is now `stockMetaExchanges(requestParameters?, initOverrides?)`.

If a 5.x JavaScript caller passed `RequestInit` as the first argument, move it to the second position:

```ts
// 5.x
await alpaca.marketData.stocks.stockMetaExchanges({ signal });

// 6.0
await alpaca.marketData.stocks.stockMetaExchanges({}, { signal });
```

The raw response-wrapper method now requires the request object even when it is empty:

```ts
await alpaca.marketData.stocks.stockMetaExchangesRaw({}, { signal });
```

TypeScript rejects a direct `{ signal }` request object, but untyped JavaScript could otherwise lose the abort signal silently. Existing no-argument `stockMetaExchangesRaw()` calls must pass `{}`. To send the correspondent header, use the first argument:

```ts
await alpaca.marketData.stocks.stockMetaExchanges({
  endUserId: "6f1c3a52-8d4e-4b7a-9c21-3e8f0d4b6a17",
});
```

The same optional `endUserId` header is now available on other generated stock requests.

## Portfolio history request and response types

`getAccountPortfolioHistory()` now accepts `start` and `end` as wire-format strings instead of `Date` objects. This preserves date-only values and server-supported timestamp precision without implicit `toISOString()` conversion.

```ts
await alpaca.trading.portfolioHistory.getAccountPortfolioHistory({
  start: "2026-01-01",
  end: "2026-01-31",
  timeframe: trading.PortfolioHistoryTimeframe._1D,
});
```

The request and response `timeframe` fields now use the generated `PortfolioHistoryTimeframe` enum rather than arbitrary strings. Review code that constructs or compares portfolio-history timeframes.

## Account activity filters

`getAccountActivities({ activityTypes })` and `getAccountActivitiesByActivityType({ activityType })` now use `ActivityTypeFilter`. This separates accepted filter aliases such as `TRANS` and `MISC` from `ActivityType`, which represents concrete values returned on activities.

```ts
await alpaca.trading.accountActivities.getAccountActivities({
  activityTypes: [
    trading.ActivityTypeFilter.Fill,
    trading.ActivityTypeFilter.Trans,
  ],
});
```

Review exhaustive switches over `ActivityType`. The current specification adds clearing, fee, international-trade, tokenization, and other concrete codes, including `FXTRD` and `OPCA_CGD`.

## Close-all-positions responses

`PositionClosedResponse.body` is now `PositionClosedResponseBody`, a union of `Order` and `ClosePositionError`. A `status` of `200` means the body is the closing order; another status means it is the rejection payload.

```ts
for (const result of await alpaca.trading.positions.deleteAllOpenPositions({})) {
  if (
    result.body &&
    trading.instanceOfClosePositionError(result.body)
  ) {
    console.error(result.body.code, result.body.message);
  }
}
```

Do not assume every body is an order. Narrow the union before reading order-specific or rejection-specific fields.

## Other generated request and model changes

Review these contract changes if your application calls the generated APIs or names their models directly:

- `Account.accountNumber` is `string | null | undefined`; an explicit wire `null` now remains `null`.
- `AccountConfigurations.tradeConfirmEmail` is the `"all" | "none"` generated enum.
- `getV2CorporateActionsAnnouncements({ dateType })` uses `GetV2CorporateActionsAnnouncementsDateTypeEnum`; replace broadly typed string variables with a generated enum member such as `trading.GetV2CorporateActionsAnnouncementsDateTypeEnum.ExDate`.
- `CreateWatchlistRequest.symbols` and `UpdateWatchlistRequest.symbols` are `string[]`; remove null entries before constructing either request.
- `Order.submittedAt`, `Order.updatedAt`, `OrderLeg.submittedAt`, and `OrderLeg.updatedAt` no longer include `null`; `groupId` and `groupRole` were added to both models for related advanced orders.
- `OrderStatus.PendingReview` and additional `Exchange` and `ExchangeForPosition` values were added. Keep default branches in runtime switches for future server values.
- `TradingActivities.side` and `GetAccountActivities200ResponseInner.side` now use generated `"buy" | "sell" | "sell_short"` enums.
- `SearchVASPsResponse.vasps` is required and deserializes a missing or null collection to `[]`.
- Fee activity `parentId` is optional; `executionId`, `orderId`, and `swapRate` were added. Trade activity details add `partial_fill` and optional `settlementCurrency`.
- Activity events can include a structured `asset`, and new FX and options corporate-action detail variants were added.
- Tokenization adds Bitget and Robinhood issuers, client request IDs, transfer status, and additional request/response fields.

Generated enums are closed TypeScript unions, but Alpaca can add wire values before an SDK release. Applications processing long-lived or persisted external data should retain a defensive unknown-value path at runtime.

## International-stock v3 coverage

Version 6 adds `alpaca.marketData.stocksV3`, backed by `marketData.StockV3Api`, for international-stock bars, trades, quotes, snapshots, and latest data. Historical bar, trade, and quote responses expose symbol-keyed arrays whose nested timestamps deserialize to real `Date` values.

The facade adds pagination helpers:

- `iterateStockV3Bars` and `collectStockV3BarsBySymbol`;
- `iterateStockV3Trades` and `collectStockV3TradesBySymbol`;
- `iterateStockV3Quotes` and `collectStockV3QuotesBySymbol`.

```ts
const bars = await alpaca.marketData.collectStockV3BarsBySymbol({
  feed: marketData.StockV3HistoricalFeed.Xetr,
  symbols: ["SAP:XETR", "DTE:XETR"],
  timeframe: TimeFrame.Day,
  start: "2026-01-01",
});
```

International v3 prices and sizes are decimal strings. Parse them deliberately according to your application's precision requirements rather than coercing them implicitly.

## Upgrade checklist

1. Remove or replace Forex and crypto-transfer creation usage.
2. Replace direct `ClockApi` imports or construction with `CalendarApi`.
3. Convert raw stock-bar adjustment values to `StockAdjustment[]`.
4. Audit `stockMetaExchanges` and `stockMetaExchangesRaw` calls for the new request-object position.
5. Update portfolio-history dates, timeframe values, and activity filters.
6. Update corporate-action date filters and remove null watchlist symbols.
7. Narrow close-all-position result bodies.
8. Compile against version 6 and run tests that exercise enum, nullability, and response-union handling.
