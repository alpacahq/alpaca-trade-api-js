/**
 * Hand-maintained source of truth for the generated README API reference.
 *
 * One entry per facade `accessor.method` (and per streaming factory accessor):
 * a one-line `description` and a short `ts` `example`. `scripts/api-reference/
 * render.ts` joins these with the capability maps in `src/capabilities.ts` to
 * emit the `<!-- API-REFERENCE -->` block in the README; a vitest drift guard
 * (`test/api-reference.test.ts`) asserts the keys here exactly match every
 * method across `capabilities`, `streamingCapabilities` and
 * `ergonomicCapabilities`. Run `npm run docs:api` after editing.
 *
 * Examples assume `const alpaca = new Alpaca({ keyId, secret })` in scope.
 */

export interface ApiReferenceExample {
    /** One-line description of what the method does. */
    description: string;
    /** Short `ts` usage snippet (rendered inside a fenced block). */
    example: string;
}

/** Map of `accessor.method` (or streaming `accessor`) to its doc entry. */
export type ApiReferenceExamples = Record<string, ApiReferenceExample>;

const trading: ApiReferenceExamples = {
    "trading.account.getAccount": {
        description: "Account details, balances, buying power and status.",
        example: 'await alpaca.trading.account.getAccount();',
    },
    "trading.accountActivities.getAccountActivities": {
        description: "List account activities (fills, fees, dividends, transfers), newest first.",
        example: 'await alpaca.trading.accountActivities.getAccountActivities({ activityTypes: ["FILL"], pageSize: 50 });',
    },
    "trading.accountActivities.getAccountActivitiesByActivityType": {
        description: "List activities of a single type (e.g. only fills).",
        example: 'await alpaca.trading.accountActivities.getAccountActivitiesByActivityType({ activityType: "FILL" });',
    },
    "trading.accountConfigurations.getAccountConfig": {
        description: "Read the account's trading configuration.",
        example: 'await alpaca.trading.accountConfigurations.getAccountConfig();',
    },
    "trading.accountConfigurations.patchAccountConfig": {
        description: "Update trading configuration (e.g. block short selling).",
        example: 'await alpaca.trading.accountConfigurations.patchAccountConfig({ accountConfigurations: { noShorting: true } });',
    },
    "trading.assets.getV2Assets": {
        description: "List tradable assets, filterable by class, status and exchange.",
        example: 'await alpaca.trading.assets.getV2Assets({ status: "active", assetClass: "us_equity" });',
    },
    "trading.assets.getV2AssetsSymbolOrAssetId": {
        description: "Fetch a single asset by symbol or asset id.",
        example: 'await alpaca.trading.assets.getV2AssetsSymbolOrAssetId({ symbolOrAssetId: "AAPL" });',
    },
    "trading.assets.getOptionsContracts": {
        description: "List option contracts for underlying symbols (paginated).",
        example: 'await alpaca.trading.assets.getOptionsContracts({ underlyingSymbols: "AAPL", limit: 100 });',
    },
    "trading.assets.getOptionContractSymbolOrId": {
        description: "Fetch a single option contract by symbol or id.",
        example: 'await alpaca.trading.assets.getOptionContractSymbolOrId({ symbolOrId: "AAPL250117C00150000" });',
    },
    "trading.assets.usCorporates": {
        description: "Reference data for US corporate bonds (by ISIN, CUSIP or ticker).",
        example: 'await alpaca.trading.assets.usCorporates({ tickers: "AAPL" });',
    },
    "trading.assets.usTreasuries": {
        description: "Reference data for US Treasury instruments.",
        example: 'await alpaca.trading.assets.usTreasuries({ cusips: "912797JL3" });',
    },
    "trading.calendar.calendar": {
        description: "Market calendar (sessions) for a market and date range.",
        example: 'await alpaca.trading.calendar.calendar({ market: "us_equity", start: new Date("2024-01-01"), end: new Date("2024-01-31") });',
    },
    "trading.calendar.legacyCalendar": {
        description: "Legacy market-calendar endpoint (prefer `calendar`).",
        example: 'await alpaca.trading.calendar.legacyCalendar({ start: new Date("2024-01-01"), end: new Date("2024-01-31") });',
    },
    "trading.clock.clock": {
        description: "Current market clock: open/closed and next open/close.",
        example: 'await alpaca.trading.clock.clock();',
    },
    "trading.clock.legacyClock": {
        description: "Legacy market-clock endpoint (prefer `clock`).",
        example: 'await alpaca.trading.clock.legacyClock();',
    },
    "trading.locates.createLocates": {
        description: "Create an easy-to-borrow locate request for a short sale.",
        example: 'await alpaca.trading.locates.createLocates({ createLocateRequest: { symbol: "AAPL", qty: 100 } });',
    },
    "trading.locates.getLocate": {
        description: "Fetch a single locate request by id.",
        example: 'await alpaca.trading.locates.getLocate({ locateId: "loc_123" });',
    },
    "trading.locates.listLocateQuotes": {
        description: "Locate availability and pricing for one or more symbols.",
        example: 'await alpaca.trading.locates.listLocateQuotes({ symbols: "AAPL,TSLA" });',
    },
    "trading.locates.listLocates": {
        description: "List locate requests, filtered by status, symbol or date range.",
        example: 'await alpaca.trading.locates.listLocates({ status: "active" });',
    },
    "trading.corporateActions.getV2CorporateActionsAnnouncements": {
        description: "Deprecated: corporate-action announcements over a date range.",
        example: 'await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({ caTypes: "dividend", since: "2024-01-01", until: "2024-01-31" });',
    },
    "trading.corporateActions.getV2CorporateActionsAnnouncementsId": {
        description: "Deprecated: a single corporate-action announcement by id.",
        example: 'await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncementsId({ id: "be3c368a-4c7c-4384-808e-f02c9f5a8afe" });',
    },
    "trading.cryptoFunding.createCryptoTransferForAccount": {
        description: "Initiate a crypto withdrawal/transfer for the account.",
        example: 'await alpaca.trading.cryptoFunding.createCryptoTransferForAccount({ createCryptoTransferRequest: { amount: "0.5", address: "0xabc...", asset: "ETH" } });',
    },
    "trading.cryptoFunding.getCryptoFundingTransfer": {
        description: "Fetch a single crypto transfer by id.",
        example: 'await alpaca.trading.cryptoFunding.getCryptoFundingTransfer({ transferId: "f1...e9" });',
    },
    "trading.cryptoFunding.listCryptoFundingTransfers": {
        description: "List crypto transfers for the account.",
        example: 'await alpaca.trading.cryptoFunding.listCryptoFundingTransfers();',
    },
    "trading.cryptoFunding.getCryptoTransferEstimate": {
        description: "Estimate fees for a crypto transfer.",
        example: 'await alpaca.trading.cryptoFunding.getCryptoTransferEstimate({ asset: "ETH", fromAddress: "0xabc...", toAddress: "0xdef...", amount: "0.5" });',
    },
    "trading.cryptoFunding.listCryptoFundingWallets": {
        description: "List the account's crypto wallets.",
        example: 'await alpaca.trading.cryptoFunding.listCryptoFundingWallets({ asset: "ETH" });',
    },
    "trading.cryptoFunding.createWhitelistedAddress": {
        description: "Whitelist a crypto withdrawal address.",
        example: 'await alpaca.trading.cryptoFunding.createWhitelistedAddress({ createWhitelistedAddressRequest: { address: "0xabc...", asset: "ETH" } });',
    },
    "trading.cryptoFunding.deleteWhitelistedAddress": {
        description: "Remove a whitelisted crypto address.",
        example: 'await alpaca.trading.cryptoFunding.deleteWhitelistedAddress({ whitelistedAddressId: "a1...c2" });',
    },
    "trading.cryptoFunding.listWhitelistedAddress": {
        description: "List whitelisted crypto withdrawal addresses.",
        example: 'await alpaca.trading.cryptoFunding.listWhitelistedAddress();',
    },
    "trading.cryptoPerpetualsAccountVitals.getCryptoPerpAccountVitals": {
        description: "Crypto perpetual-futures account vitals: margin, collateral, P&L (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsAccountVitals.getCryptoPerpAccountVitals();',
    },
    "trading.cryptoPerpetualsFunding.createCryptoPerpTransferForAccount": {
        description: "Initiate a crypto perpetual-futures transfer (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.createCryptoPerpTransferForAccount({ createCryptoTransferRequest: { amount: "100", asset: "USDT" } });',
    },
    "trading.cryptoPerpetualsFunding.getCryptoPerpFundingTransfer": {
        description: "Fetch a single perpetual-futures transfer by id (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpFundingTransfer({ transferId: "f1...e9" });',
    },
    "trading.cryptoPerpetualsFunding.getCryptoPerpTransferEstimate": {
        description: "Estimate fees for a perpetual-futures transfer (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.getCryptoPerpTransferEstimate({ asset: "USDT", amount: "100" });',
    },
    "trading.cryptoPerpetualsFunding.listCryptoPerpFundingTransfers": {
        description: "List perpetual-futures transfers (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingTransfers();',
    },
    "trading.cryptoPerpetualsFunding.listCryptoPerpFundingWallets": {
        description: "List perpetual-futures wallets (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.listCryptoPerpFundingWallets({ asset: "USDT" });',
    },
    "trading.cryptoPerpetualsFunding.createWhitelistedPerpAddress": {
        description: "Whitelist a perpetual-futures withdrawal address (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.createWhitelistedPerpAddress({ createWhitelistedPerpAddressRequest: { address: "0xabc...", asset: "USDT" } });',
    },
    "trading.cryptoPerpetualsFunding.deleteWhitelistedPerpAddress": {
        description: "Remove a whitelisted perpetual-futures address (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.deleteWhitelistedPerpAddress({ whitelistedAddressId: "a1...c2" });',
    },
    "trading.cryptoPerpetualsFunding.listWhitelistedPerpAddress": {
        description: "List whitelisted perpetual-futures addresses (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsFunding.listWhitelistedPerpAddress();',
    },
    "trading.cryptoPerpetualsLeverage.getCryptoPerpAccountLeverage": {
        description: "Read crypto perpetual-futures account leverage (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsLeverage.getCryptoPerpAccountLeverage({ symbol: "BTC-PERP" });',
    },
    "trading.cryptoPerpetualsLeverage.setCryptoPerpAccountLeverage": {
        description: "Set crypto perpetual-futures account leverage (beta).",
        example: 'await alpaca.trading.cryptoPerpetualsLeverage.setCryptoPerpAccountLeverage({ symbol: "BTC-PERP", leverage: 5 });',
    },
    "trading.events.subscribeToActivitiesSSE": {
        description: "Server-sent event stream of account activities.",
        example: 'await alpaca.trading.events.subscribeToActivitiesSSE({ sinceId: "20240101000000000::..." });',
    },
    "trading.orders.getAllOrders": {
        description: "List orders, filterable by status, side and symbol.",
        example: 'await alpaca.trading.orders.getAllOrders({ status: "open", limit: 100 });',
    },
    "trading.orders.postOrder": {
        description: "Place an order (raw). Prefer the typed builders under Ergonomic helpers.",
        example: 'await alpaca.trading.orders.postOrder({ postOrderRequest: { symbol: "AAPL", qty: "1", side: "buy", type: "market", timeInForce: "day" } });',
    },
    "trading.orders.getOrderByOrderID": {
        description: "Fetch a single order by its order id.",
        example: 'await alpaca.trading.orders.getOrderByOrderID({ orderId: "f1...e9" });',
    },
    "trading.orders.getOrderByClientOrderId": {
        description: "Fetch a single order by your client order id.",
        example: 'await alpaca.trading.orders.getOrderByClientOrderId({ clientOrderId: "my-order-1" });',
    },
    "trading.orders.patchOrderByOrderId": {
        description: "Replace (amend) an open order.",
        example: 'await alpaca.trading.orders.patchOrderByOrderId({ orderId: "f1...e9", patchOrderRequest: { qty: "2" } });',
    },
    "trading.orders.deleteOrderByOrderID": {
        description: "Cancel a single open order.",
        example: 'await alpaca.trading.orders.deleteOrderByOrderID({ orderId: "f1...e9" });',
    },
    "trading.orders.deleteAllOrders": {
        description: "Cancel all open orders.",
        example: 'await alpaca.trading.orders.deleteAllOrders();',
    },
    "trading.portfolioHistory.getAccountPortfolioHistory": {
        description: "Time series of account equity and profit/loss.",
        example: 'await alpaca.trading.portfolioHistory.getAccountPortfolioHistory({ period: "1M", timeframe: "1D" });',
    },
    "trading.positions.getAllOpenPositions": {
        description: "List all open positions.",
        example: 'await alpaca.trading.positions.getAllOpenPositions();',
    },
    "trading.positions.getOpenPosition": {
        description: "Fetch a single open position by symbol or asset id.",
        example: 'await alpaca.trading.positions.getOpenPosition({ symbolOrAssetId: "AAPL" });',
    },
    "trading.positions.deleteAllOpenPositions": {
        description: "Liquidate every open position (optionally cancel orders first).",
        example: 'await alpaca.trading.positions.deleteAllOpenPositions({ cancelOrders: true });',
    },
    "trading.positions.deleteOpenPosition": {
        description: "Close a position: whole, partial qty, or a percentage.",
        example: 'await alpaca.trading.positions.deleteOpenPosition({ symbolOrAssetId: "AAPL", percentage: 50 });',
    },
    "trading.positions.optionExercise": {
        description: "Exercise a held option position.",
        example: 'await alpaca.trading.positions.optionExercise({ symbolOrContractId: "AAPL250117C00150000" });',
    },
    "trading.positions.optionDoNotExercise": {
        description: "Submit a do-not-exercise instruction for an option position.",
        example: 'await alpaca.trading.positions.optionDoNotExercise({ symbolOrContractId: "AAPL250117C00150000" });',
    },
    "trading.tokenization.getTokenizationRequests": {
        description: "List tokenization (mint/redeem) requests.",
        example: 'await alpaca.trading.tokenization.getTokenizationRequests({ status: "completed" });',
    },
    "trading.tokenization.postTokenizationMint": {
        description: "Submit a tokenization mint request.",
        example: 'await alpaca.trading.tokenization.postTokenizationMint({ tokenizationMintRequest: { underlyingSymbol: "AAPL", quantity: "1" } });',
    },
    "trading.watchlists.getWatchlists": {
        description: "List all watchlists.",
        example: 'await alpaca.trading.watchlists.getWatchlists();',
    },
    "trading.watchlists.getWatchlistById": {
        description: "Fetch a single watchlist by id.",
        example: 'await alpaca.trading.watchlists.getWatchlistById({ watchlistId: "f1...e9" });',
    },
    "trading.watchlists.getWatchlistByName": {
        description: "Fetch a single watchlist by name.",
        example: 'await alpaca.trading.watchlists.getWatchlistByName({ name: "My List" });',
    },
    "trading.watchlists.postWatchlist": {
        description: "Create a watchlist with an initial set of symbols.",
        example: 'await alpaca.trading.watchlists.postWatchlist({ updateWatchlistRequest: { name: "Tech", symbols: ["AAPL", "MSFT"] } });',
    },
    "trading.watchlists.updateWatchlistById": {
        description: "Update a watchlist (name and/or symbols) by id.",
        example: 'await alpaca.trading.watchlists.updateWatchlistById({ watchlistId: "f1...e9", updateWatchlistRequest: { name: "Renamed" } });',
    },
    "trading.watchlists.updateWatchlistByName": {
        description: "Update a watchlist (name and/or symbols) by name.",
        example: 'await alpaca.trading.watchlists.updateWatchlistByName({ name: "Tech", updateWatchlistRequest: { symbols: ["AAPL"] } });',
    },
    "trading.watchlists.addAssetToWatchlist": {
        description: "Add an asset to a watchlist by id.",
        example: 'await alpaca.trading.watchlists.addAssetToWatchlist({ watchlistId: "f1...e9", addAssetToWatchlistRequest: { symbol: "NVDA" } });',
    },
    "trading.watchlists.addAssetToWatchlistByName": {
        description: "Add an asset to a watchlist by name.",
        example: 'await alpaca.trading.watchlists.addAssetToWatchlistByName({ name: "Tech", addAssetToWatchlistRequest: { symbol: "NVDA" } });',
    },
    "trading.watchlists.removeAssetFromWatchlist": {
        description: "Remove an asset from a watchlist by id.",
        example: 'await alpaca.trading.watchlists.removeAssetFromWatchlist({ watchlistId: "f1...e9", symbol: "NVDA" });',
    },
    "trading.watchlists.deleteWatchlistById": {
        description: "Delete a watchlist by id.",
        example: 'await alpaca.trading.watchlists.deleteWatchlistById({ watchlistId: "f1...e9" });',
    },
    "trading.watchlists.deleteWatchlistByName": {
        description: "Delete a watchlist by name.",
        example: 'await alpaca.trading.watchlists.deleteWatchlistByName({ name: "Tech" });',
    },
};

const marketData: ApiReferenceExamples = {
    "marketData.stocks.stockBars": {
        description: "Historical bars for one or more stocks (paginated).",
        example: 'await alpaca.marketData.stocks.stockBars({ symbols: "AAPL,MSFT", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.stocks.stockTrades": {
        description: "Historical trades for one or more stocks (paginated).",
        example: 'await alpaca.marketData.stocks.stockTrades({ symbols: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.stocks.stockQuotes": {
        description: "Historical quotes for one or more stocks (paginated).",
        example: 'await alpaca.marketData.stocks.stockQuotes({ symbols: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.stocks.stockAuctions": {
        description: "Historical opening/closing auctions for stocks (paginated).",
        example: 'await alpaca.marketData.stocks.stockAuctions({ symbols: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.stocks.stockSnapshots": {
        description: "Latest snapshot (trade, quote, bars) for one or more stocks.",
        example: 'await alpaca.marketData.stocks.stockSnapshots({ symbols: "AAPL,MSFT" });',
    },
    "marketData.stocks.stockLatestBars": {
        description: "Latest minute bar for one or more stocks.",
        example: 'await alpaca.marketData.stocks.stockLatestBars({ symbols: "AAPL,MSFT" });',
    },
    "marketData.stocks.stockLatestQuotes": {
        description: "Latest quote for one or more stocks.",
        example: 'await alpaca.marketData.stocks.stockLatestQuotes({ symbols: "AAPL,MSFT" });',
    },
    "marketData.stocks.stockLatestTrades": {
        description: "Latest trade for one or more stocks.",
        example: 'await alpaca.marketData.stocks.stockLatestTrades({ symbols: "AAPL,MSFT" });',
    },
    "marketData.stocks.stockMetaConditions": {
        description: "Trade/quote condition-code mappings for a tape.",
        example: 'await alpaca.marketData.stocks.stockMetaConditions({ ticktype: "trade", tape: "A" });',
    },
    "marketData.stocks.stockMetaExchanges": {
        description: "Exchange-code mappings.",
        example: 'await alpaca.marketData.stocks.stockMetaExchanges();',
    },
    "marketData.crypto.cryptoBars": {
        description: "Historical crypto bars (paginated); `loc` selects the data region.",
        example: 'await alpaca.marketData.crypto.cryptoBars({ loc: "us", symbols: "BTC/USD,ETH/USD", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.crypto.cryptoTrades": {
        description: "Historical crypto trades (paginated).",
        example: 'await alpaca.marketData.crypto.cryptoTrades({ loc: "us", symbols: "BTC/USD", start: new Date("2024-01-02") });',
    },
    "marketData.crypto.cryptoQuotes": {
        description: "Historical crypto quotes (paginated).",
        example: 'await alpaca.marketData.crypto.cryptoQuotes({ loc: "us", symbols: "BTC/USD", start: new Date("2024-01-02") });',
    },
    "marketData.crypto.cryptoSnapshots": {
        description: "Latest snapshot for one or more crypto pairs.",
        example: 'await alpaca.marketData.crypto.cryptoSnapshots({ loc: "us", symbols: "BTC/USD,ETH/USD" });',
    },
    "marketData.crypto.cryptoLatestBars": {
        description: "Latest bar for one or more crypto pairs.",
        example: 'await alpaca.marketData.crypto.cryptoLatestBars({ loc: "us", symbols: "BTC/USD" });',
    },
    "marketData.crypto.cryptoLatestQuotes": {
        description: "Latest quote for one or more crypto pairs.",
        example: 'await alpaca.marketData.crypto.cryptoLatestQuotes({ loc: "us", symbols: "BTC/USD" });',
    },
    "marketData.crypto.cryptoLatestTrades": {
        description: "Latest trade for one or more crypto pairs.",
        example: 'await alpaca.marketData.crypto.cryptoLatestTrades({ loc: "us", symbols: "BTC/USD" });',
    },
    "marketData.crypto.cryptoLatestOrderbooks": {
        description: "Latest order book for one or more crypto pairs.",
        example: 'await alpaca.marketData.crypto.cryptoLatestOrderbooks({ loc: "us", symbols: "BTC/USD" });',
    },
    "marketData.cryptoPerpetualFutures.cryptoPerpLatestBars": {
        description: "Latest bar for one or more crypto perpetual-futures contracts.",
        example: 'await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestBars({ loc: "global", symbols: "BTC-PERP" });',
    },
    "marketData.cryptoPerpetualFutures.cryptoPerpLatestQuotes": {
        description: "Latest quote for one or more perpetual-futures contracts.",
        example: 'await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestQuotes({ loc: "global", symbols: "BTC-PERP" });',
    },
    "marketData.cryptoPerpetualFutures.cryptoPerpLatestTrades": {
        description: "Latest trade for one or more perpetual-futures contracts.",
        example: 'await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestTrades({ loc: "global", symbols: "BTC-PERP" });',
    },
    "marketData.cryptoPerpetualFutures.cryptoPerpLatestOrderbooks": {
        description: "Latest order book for one or more perpetual-futures contracts.",
        example: 'await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestOrderbooks({ loc: "global", symbols: "BTC-PERP" });',
    },
    "marketData.cryptoPerpetualFutures.cryptoPerpLatestFuturesPricing": {
        description: "Latest funding/mark pricing for perpetual-futures contracts.",
        example: 'await alpaca.marketData.cryptoPerpetualFutures.cryptoPerpLatestFuturesPricing({ loc: "global", symbols: "BTC-PERP" });',
    },
    "marketData.fixedIncome.fixedIncomeLatestPrices": {
        description: "Latest fixed-income prices by ISIN.",
        example: 'await alpaca.marketData.fixedIncome.fixedIncomeLatestPrices({ isins: "US0378331005" });',
    },
    "marketData.fixedIncome.fixedIncomeLatestQuotes": {
        description: "Latest fixed-income quotes by ISIN.",
        example: 'await alpaca.marketData.fixedIncome.fixedIncomeLatestQuotes({ isins: "US0378331005", tradeSize: 100 });',
    },
    "marketData.forex.rates": {
        description: "Historical forex rates for currency pairs (paginated).",
        example: 'await alpaca.marketData.forex.rates({ currencyPairs: "EUR/USD", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.forex.latestRates": {
        description: "Latest forex rates for one or more currency pairs.",
        example: 'await alpaca.marketData.forex.latestRates({ currencyPairs: "EUR/USD,GBP/USD" });',
    },
    "marketData.indices.indexValues": {
        description: "Historical index values (paginated).",
        example: 'await alpaca.marketData.indices.indexValues({ symbols: "SPX", start: new Date("2024-01-01") });',
    },
    "marketData.indices.indexLatestValues": {
        description: "Latest values for one or more indices.",
        example: 'await alpaca.marketData.indices.indexLatestValues({ symbols: "SPX" });',
    },
    "marketData.logos.logos": {
        description: "Company logo image bytes for a symbol.",
        example: 'await alpaca.marketData.logos.logos({ symbol: "AAPL" });',
    },
    "marketData.news.news": {
        description: "Latest news articles across stocks and crypto (paginated).",
        example: 'await alpaca.marketData.news.news({ symbols: "AAPL,TSLA", limit: 10 });',
    },
    "marketData.options.optionBars": {
        description: "Historical option bars (paginated).",
        example: 'await alpaca.marketData.options.optionBars({ symbols: "AAPL250117C00150000", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.options.optionTrades": {
        description: "Historical option trades (paginated).",
        example: 'await alpaca.marketData.options.optionTrades({ symbols: "AAPL250117C00150000", start: new Date("2024-01-02") });',
    },
    "marketData.options.optionChain": {
        description: "Snapshots for an underlying's full option chain (paginated).",
        example: 'await alpaca.marketData.options.optionChain({ underlyingSymbol: "AAPL", type: "call" });',
    },
    "marketData.options.optionSnapshots": {
        description: "Latest snapshots for one or more option contracts.",
        example: 'await alpaca.marketData.options.optionSnapshots({ symbols: "AAPL250117C00150000" });',
    },
    "marketData.options.optionLatestQuotes": {
        description: "Latest quotes for one or more option contracts.",
        example: 'await alpaca.marketData.options.optionLatestQuotes({ symbols: "AAPL250117C00150000" });',
    },
    "marketData.options.optionLatestTrades": {
        description: "Latest trades for one or more option contracts.",
        example: 'await alpaca.marketData.options.optionLatestTrades({ symbols: "AAPL250117C00150000" });',
    },
    "marketData.options.optionMetaConditions": {
        description: "Option trade/quote condition-code mappings.",
        example: 'await alpaca.marketData.options.optionMetaConditions({ ticktype: "trade" });',
    },
    "marketData.options.optionMetaExchanges": {
        description: "Option exchange-code mappings.",
        example: 'await alpaca.marketData.options.optionMetaExchanges();',
    },
    "marketData.screener.mostActives": {
        description: "Most-active stocks by volume or trade count.",
        example: 'await alpaca.marketData.screener.mostActives({ by: "volume", top: 10 });',
    },
    "marketData.screener.movers": {
        description: "Top market gainers and losers.",
        example: 'await alpaca.marketData.screener.movers({ marketType: "stocks", top: 10 });',
    },
    "marketData.corporateActions.corporateActions": {
        description: "Historical corporate-action data by symbol and type (paginated).",
        example: 'await alpaca.marketData.corporateActions.corporateActions({ symbols: "AAPL", types: "cash_dividend", start: new Date("2024-01-01") });',
    },
};

const streaming: ApiReferenceExamples = {
    "trading.stream": {
        description: "Open the trading-updates WebSocket (order/account events, JSON).",
        example: [
            "const updates = alpaca.trading.stream();",
            "updates.onTradeUpdate((u) => console.log(u.event, u.order.symbol));",
            "updates.onConnect(() => updates.subscribeTradeUpdates());",
            "updates.connect();",
        ].join("\n"),
    },
    "marketData.stockStream": {
        description: "Open the US-equity market-data WebSocket (msgpack).",
        example: [
            'const stocks = alpaca.marketData.stockStream({ feed: "iex" });',
            "stocks.onBar((bar) => console.log(bar.symbol, bar.close));",
            'stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));',
            "stocks.connect();",
        ].join("\n"),
    },
    "marketData.cryptoStream": {
        description: "Open the crypto market-data WebSocket (msgpack).",
        example: [
            "const crypto = alpaca.marketData.cryptoStream();",
            "crypto.onTrade((t) => console.log(t.symbol, t.price));",
            'crypto.onConnect(() => crypto.subscribeForTrades(["BTC/USD"]));',
            "crypto.connect();",
        ].join("\n"),
    },
    "marketData.optionStream": {
        description: "Open the options market-data WebSocket (msgpack).",
        example: [
            "const opts = alpaca.marketData.optionStream();",
            "opts.onTrade((t) => console.log(t.symbol, t.price));",
            'opts.onConnect(() => opts.subscribeForTrades(["AAPL250117C00150000"]));',
            "opts.connect();",
        ].join("\n"),
    },
    "marketData.newsStream": {
        description: "Open the real-time news-headline WebSocket.",
        example: [
            "const news = alpaca.marketData.newsStream();",
            "news.onNews((n) => console.log(n.headline));",
            'news.onConnect(() => news.subscribeForNews(["AAPL", "TSLA"]));',
            "news.connect();",
        ].join("\n"),
    },
};

const ergonomic: ApiReferenceExamples = {
    "trading.orders.market": {
        description: "Place a market order (exactly one of `qty`/`notional`).",
        example: 'await alpaca.trading.orders.market({ symbol: "AAPL", side: "buy", qty: 1 });',
    },
    "trading.orders.limit": {
        description: "Place a limit order.",
        example: 'await alpaca.trading.orders.limit({ symbol: "AAPL", side: "buy", qty: 1, limitPrice: 150 });',
    },
    "trading.orders.stop": {
        description: "Place a stop (stop-market) order.",
        example: 'await alpaca.trading.orders.stop({ symbol: "AAPL", side: "sell", qty: 1, stopPrice: 140 });',
    },
    "trading.orders.stopLimit": {
        description: "Place a stop-limit order.",
        example: 'await alpaca.trading.orders.stopLimit({ symbol: "AAPL", side: "sell", qty: 1, stopPrice: 140, limitPrice: 139 });',
    },
    "trading.orders.trailingStop": {
        description: "Place a trailing-stop order (one of `trailPrice`/`trailPercent`).",
        example: 'await alpaca.trading.orders.trailingStop({ symbol: "AAPL", side: "sell", qty: 1, trailPercent: 5 });',
    },
    "trading.orders.bracket": {
        description: "Place a bracket order: entry plus take-profit and stop-loss legs.",
        example: 'await alpaca.trading.orders.bracket({ symbol: "AAPL", side: "buy", qty: 1, takeProfit: { limitPrice: 160 }, stopLoss: { stopPrice: 140 } });',
    },
    "trading.orders.oco": {
        description: "Place a one-cancels-other order (take-profit + stop-loss on a held position).",
        example: 'await alpaca.trading.orders.oco({ symbol: "AAPL", side: "sell", qty: 1, takeProfit: { limitPrice: 160 }, stopLoss: { stopPrice: 140 } });',
    },
    "trading.orders.oto": {
        description: "Place a one-triggers-other order (entry that triggers a single leg).",
        example: 'await alpaca.trading.orders.oto({ symbol: "AAPL", side: "buy", qty: 1, limitPrice: 150, takeProfit: { limitPrice: 160 } });',
    },
    "trading.orders.submit": {
        description: "Generic builder escape hatch for shapes the typed builders don't cover (e.g. `mleg`).",
        example: 'await alpaca.trading.orders.submit({ type: "market", symbol: "AAPL", side: "buy", qty: 1 });',
    },
    "trading.submitAndWait": {
        description: "Place an order and resolve once it reaches a terminal state, observed over the trading stream.",
        example: 'const filled = await alpaca.trading.submitAndWait({ type: "market", symbol: "AAPL", side: "buy", qty: 1 }, { timeoutMs: 30_000 });',
    },
    "trading.closeAllPositions": {
        description: "Close every open position (optionally cancel open orders first).",
        example: 'await alpaca.trading.closeAllPositions({ cancelOrders: true });',
    },
    "trading.iterateOptionsContracts": {
        description: "Lazily yield option contracts across all pages.",
        example: 'for await (const contract of alpaca.trading.iterateOptionsContracts({ underlyingSymbols: "AAPL" })) console.log(contract.symbol);',
    },
    "trading.collectOptionsContracts": {
        description: "Eagerly collect all option contracts across pages into one array.",
        example: 'const contracts = await alpaca.trading.collectOptionsContracts({ underlyingSymbols: "AAPL" });',
    },
    "trading.iterateActivities": {
        description: "Lazily yield account activities across all pages.",
        example: 'for await (const activity of alpaca.trading.iterateActivities({ activityTypes: ["FILL"] })) console.log(activity.id);',
    },
    "trading.collectActivities": {
        description: "Eagerly collect all account activities across pages into one array.",
        example: 'const activities = await alpaca.trading.collectActivities({ activityTypes: ["FILL"] });',
    },
    "trading.iterateActivitiesByType": {
        description: "Lazily yield activities of a single type across all pages.",
        example: 'for await (const fill of alpaca.trading.iterateActivitiesByType({ activityType: "FILL" })) console.log(fill.id);',
    },
    "trading.collectActivitiesByType": {
        description: "Eagerly collect activities of a single type into one array.",
        example: 'const fills = await alpaca.trading.collectActivitiesByType({ activityType: "FILL" });',
    },
    "marketData.getLatestPrice": {
        description: "Latest trade price for a symbol as a `number` (or `undefined`).",
        example: 'const price = await alpaca.marketData.getLatestPrice("AAPL");',
    },
    "marketData.getStockBars": {
        description: "Historical stock bars as canonical `Bar`s, auto-paginated and keyed by symbol.",
        example: 'const bars = await alpaca.marketData.getStockBars({ symbols: ["AAPL"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getCryptoBars": {
        description: "Historical crypto bars as canonical `Bar`s, keyed by symbol.",
        example: 'const bars = await alpaca.marketData.getCryptoBars({ loc: "us", symbols: ["BTC/USD"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getOptionBars": {
        description: "Historical option bars as canonical `Bar`s, keyed by symbol.",
        example: 'const bars = await alpaca.marketData.getOptionBars({ symbols: ["AAPL250117C00150000"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getStockTrades": {
        description: "Historical stock trades as canonical `Trade`s, keyed by symbol.",
        example: 'const trades = await alpaca.marketData.getStockTrades({ symbols: ["AAPL"], start: new Date("2024-01-02") });',
    },
    "marketData.getCryptoTrades": {
        description: "Historical crypto trades as canonical `Trade`s, keyed by symbol.",
        example: 'const trades = await alpaca.marketData.getCryptoTrades({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") });',
    },
    "marketData.getStockQuotes": {
        description: "Historical stock quotes as canonical `Quote`s, keyed by symbol.",
        example: 'const quotes = await alpaca.marketData.getStockQuotes({ symbols: ["AAPL"], start: new Date("2024-01-02") });',
    },
    "marketData.getCryptoQuotes": {
        description: "Historical crypto quotes as canonical `Quote`s, keyed by symbol.",
        example: 'const quotes = await alpaca.marketData.getCryptoQuotes({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") });',
    },
    "marketData.getStockCandles": {
        description: "Historical stock bars as chart-ready columnar `Candles`, keyed by symbol.",
        example: 'const candles = await alpaca.marketData.getStockCandles({ symbols: ["AAPL"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getCryptoCandles": {
        description: "Historical crypto bars as chart-ready columnar `Candles`, keyed by symbol.",
        example: 'const candles = await alpaca.marketData.getCryptoCandles({ loc: "us", symbols: ["BTC/USD"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getStockBarsFor": {
        description: "Single-symbol historical stock bars as canonical `Bar[]` (unwrapped, not a symbol map).",
        example: 'const bars = await alpaca.marketData.getStockBarsFor("AAPL", { timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getCryptoBarsFor": {
        description: "Single-symbol historical crypto bars as canonical `Bar[]` (unwrapped).",
        example: 'const bars = await alpaca.marketData.getCryptoBarsFor("BTC/USD", { loc: "us", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getOptionBarsFor": {
        description: "Single-symbol historical option bars as canonical `Bar[]` (unwrapped).",
        example: 'const bars = await alpaca.marketData.getOptionBarsFor("AAPL250117C00150000", { timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getStockTradesFor": {
        description: "Single-symbol historical stock trades as canonical `Trade[]` (unwrapped).",
        example: 'const trades = await alpaca.marketData.getStockTradesFor("AAPL", { start: new Date("2024-01-02") });',
    },
    "marketData.getCryptoTradesFor": {
        description: "Single-symbol historical crypto trades as canonical `Trade[]` (unwrapped).",
        example: 'const trades = await alpaca.marketData.getCryptoTradesFor("BTC/USD", { loc: "us", start: new Date("2024-01-02") });',
    },
    "marketData.getStockQuotesFor": {
        description: "Single-symbol historical stock quotes as canonical `Quote[]` (unwrapped).",
        example: 'const quotes = await alpaca.marketData.getStockQuotesFor("AAPL", { start: new Date("2024-01-02") });',
    },
    "marketData.getCryptoQuotesFor": {
        description: "Single-symbol historical crypto quotes as canonical `Quote[]` (unwrapped).",
        example: 'const quotes = await alpaca.marketData.getCryptoQuotesFor("BTC/USD", { loc: "us", start: new Date("2024-01-02") });',
    },
    "marketData.getStockCandlesFor": {
        description: "Single-symbol historical stock bars as chart-ready columnar `Candles` (unwrapped).",
        example: 'const candles = await alpaca.marketData.getStockCandlesFor("AAPL", { timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.getCryptoCandlesFor": {
        description: "Single-symbol historical crypto bars as chart-ready columnar `Candles` (unwrapped).",
        example: 'const candles = await alpaca.marketData.getCryptoCandlesFor("BTC/USD", { loc: "us", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.iterateStockBars": {
        description: "Lazily yield `{ symbol, value }` stock-bar records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateStockBars({ symbols: ["AAPL"], timeframe: "1Day", start: new Date("2024-01-01") })) console.log(symbol, value.c);',
    },
    "marketData.collectStockBarsBySymbol": {
        description: "Collect stock bars merged into a `{ [symbol]: StockBar[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectStockBarsBySymbol({ symbols: ["AAPL", "MSFT"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.iterateStockTrades": {
        description: "Lazily yield stock-trade records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateStockTrades({ symbols: ["AAPL"], start: new Date("2024-01-02") })) console.log(symbol, value.p);',
    },
    "marketData.collectStockTradesBySymbol": {
        description: "Collect stock trades merged into a `{ [symbol]: StockTrade[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectStockTradesBySymbol({ symbols: ["AAPL"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateStockQuotes": {
        description: "Lazily yield stock-quote records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateStockQuotes({ symbols: ["AAPL"], start: new Date("2024-01-02") })) console.log(symbol, value.bp);',
    },
    "marketData.collectStockQuotesBySymbol": {
        description: "Collect stock quotes merged into a `{ [symbol]: StockQuote[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectStockQuotesBySymbol({ symbols: ["AAPL"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateStockAuctions": {
        description: "Lazily yield daily-auction records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateStockAuctions({ symbols: ["AAPL"], start: new Date("2024-01-02") })) console.log(symbol, value.d);',
    },
    "marketData.collectStockAuctionsBySymbol": {
        description: "Collect stock auctions merged into a `{ [symbol]: StockDailyAuctions[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectStockAuctionsBySymbol({ symbols: ["AAPL"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateCryptoBars": {
        description: "Lazily yield crypto-bar records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateCryptoBars({ loc: "us", symbols: ["BTC/USD"], timeframe: "1Day", start: new Date("2024-01-01") })) console.log(symbol, value.c);',
    },
    "marketData.collectCryptoBarsBySymbol": {
        description: "Collect crypto bars merged into a `{ [symbol]: CryptoBar[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectCryptoBarsBySymbol({ loc: "us", symbols: ["BTC/USD"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.iterateCryptoTrades": {
        description: "Lazily yield crypto-trade records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateCryptoTrades({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") })) console.log(symbol, value.p);',
    },
    "marketData.collectCryptoTradesBySymbol": {
        description: "Collect crypto trades merged into a `{ [symbol]: CryptoTrade[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectCryptoTradesBySymbol({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateCryptoQuotes": {
        description: "Lazily yield crypto-quote records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateCryptoQuotes({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") })) console.log(symbol, value.bp);',
    },
    "marketData.collectCryptoQuotesBySymbol": {
        description: "Collect crypto quotes merged into a `{ [symbol]: CryptoQuote[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectCryptoQuotesBySymbol({ loc: "us", symbols: ["BTC/USD"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateOptionBars": {
        description: "Lazily yield option-bar records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateOptionBars({ symbols: ["AAPL250117C00150000"], timeframe: "1Day", start: new Date("2024-01-01") })) console.log(symbol, value.c);',
    },
    "marketData.collectOptionBarsBySymbol": {
        description: "Collect option bars merged into a `{ [symbol]: OptionBar[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectOptionBarsBySymbol({ symbols: ["AAPL250117C00150000"], timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.iterateOptionTrades": {
        description: "Lazily yield option-trade records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateOptionTrades({ symbols: ["AAPL250117C00150000"], start: new Date("2024-01-02") })) console.log(symbol, value.p);',
    },
    "marketData.collectOptionTradesBySymbol": {
        description: "Collect option trades merged into a `{ [symbol]: OptionTrade[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectOptionTradesBySymbol({ symbols: ["AAPL250117C00150000"], start: new Date("2024-01-02") });',
    },
    "marketData.iterateIndexValues": {
        description: "Lazily yield index-value records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateIndexValues({ symbols: ["SPX"], start: new Date("2024-01-01") })) console.log(symbol, value);',
    },
    "marketData.collectIndexValuesBySymbol": {
        description: "Collect index values merged into a `{ [symbol]: IndexValue[] }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectIndexValuesBySymbol({ symbols: ["SPX"], start: new Date("2024-01-01") });',
    },
    "marketData.iterateForexRates": {
        description: "Lazily yield forex-rate records across currency pairs and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateForexRates({ currencyPairs: ["EUR/USD"], start: new Date("2024-01-01") })) console.log(symbol, value);',
    },
    "marketData.collectForexRatesBySymbol": {
        description: "Collect forex rates merged into a `{ [pair]: ForexRate[] }` map.",
        example: 'const byPair = await alpaca.marketData.collectForexRatesBySymbol({ currencyPairs: ["EUR/USD"], start: new Date("2024-01-01") });',
    },
    "marketData.iterateOptionSnapshots": {
        description: "Lazily yield `{ symbol, value }` option-snapshot records across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateOptionSnapshots({ symbols: ["AAPL250117C00150000"] })) console.log(symbol, value);',
    },
    "marketData.collectOptionSnapshotsBySymbol": {
        description: "Collect option snapshots into a `{ [symbol]: OptionSnapshot }` map.",
        example: 'const bySymbol = await alpaca.marketData.collectOptionSnapshotsBySymbol({ symbols: ["AAPL250117C00150000"] });',
    },
    "marketData.iterateOptionChain": {
        description: "Lazily yield an underlying's option-chain snapshots across symbols and pages.",
        example: 'for await (const { symbol, value } of alpaca.marketData.iterateOptionChain({ underlyingSymbol: "AAPL" })) console.log(symbol, value);',
    },
    "marketData.collectOptionChainBySymbol": {
        description: "Collect an option chain's snapshots into a `{ [symbol]: OptionSnapshot }` map.",
        example: 'const chain = await alpaca.marketData.collectOptionChainBySymbol({ underlyingSymbol: "AAPL" });',
    },
    "marketData.iterateStockBarSingle": {
        description: "Lazily yield a single symbol's stock bars across all pages.",
        example: 'for await (const bar of alpaca.marketData.iterateStockBarSingle({ symbol: "AAPL", timeframe: "1Day", start: new Date("2024-01-01") })) console.log(bar.c);',
    },
    "marketData.collectStockBarSingle": {
        description: "Collect a single symbol's stock bars into one `StockBar[]` array.",
        example: 'const bars = await alpaca.marketData.collectStockBarSingle({ symbol: "AAPL", timeframe: "1Day", start: new Date("2024-01-01") });',
    },
    "marketData.iterateStockTradeSingle": {
        description: "Lazily yield a single symbol's stock trades across all pages.",
        example: 'for await (const trade of alpaca.marketData.iterateStockTradeSingle({ symbol: "AAPL", start: new Date("2024-01-02") })) console.log(trade.p);',
    },
    "marketData.collectStockTradeSingle": {
        description: "Collect a single symbol's stock trades into one `StockTrade[]` array.",
        example: 'const trades = await alpaca.marketData.collectStockTradeSingle({ symbol: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.iterateStockQuoteSingle": {
        description: "Lazily yield a single symbol's stock quotes across all pages.",
        example: 'for await (const quote of alpaca.marketData.iterateStockQuoteSingle({ symbol: "AAPL", start: new Date("2024-01-02") })) console.log(quote.bp);',
    },
    "marketData.collectStockQuoteSingle": {
        description: "Collect a single symbol's stock quotes into one `StockQuote[]` array.",
        example: 'const quotes = await alpaca.marketData.collectStockQuoteSingle({ symbol: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.iterateStockAuctionSingle": {
        description: "Lazily yield a single symbol's daily auctions across all pages.",
        example: 'for await (const auction of alpaca.marketData.iterateStockAuctionSingle({ symbol: "AAPL", start: new Date("2024-01-02") })) console.log(auction.d);',
    },
    "marketData.collectStockAuctionSingle": {
        description: "Collect a single symbol's daily auctions into one array.",
        example: 'const auctions = await alpaca.marketData.collectStockAuctionSingle({ symbol: "AAPL", start: new Date("2024-01-02") });',
    },
    "marketData.iterateNews": {
        description: "Lazily yield news articles across all pages.",
        example: 'for await (const article of alpaca.marketData.iterateNews({ symbols: ["AAPL"] })) console.log(article.headline);',
    },
    "marketData.collectNews": {
        description: "Collect news articles into one `News[]` array.",
        example: 'const articles = await alpaca.marketData.collectNews({ symbols: ["AAPL"] });',
    },
    "marketData.iterateCorporateActionsPages": {
        description: "Lazily yield each page's `CorporateActions` envelope, following the token.",
        example: 'for await (const page of alpaca.marketData.iterateCorporateActionsPages({ symbols: ["AAPL"] })) console.log(page.cashDividends);',
    },
    "marketData.collectCorporateActions": {
        description: "Collect corporate actions across pages into one merged `CorporateActions` object.",
        example: 'const actions = await alpaca.marketData.collectCorporateActions({ symbols: ["AAPL"], start: new Date("2024-01-01") });',
    },
};

/** Merged map consumed by the renderer and the drift guard. */
export const examples: ApiReferenceExamples = {
    ...trading,
    ...marketData,
    ...streaming,
    ...ergonomic,
};
