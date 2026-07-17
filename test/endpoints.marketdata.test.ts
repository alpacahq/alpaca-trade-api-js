/**
 * Per-endpoint surface tests for the Market Data API.
 *
 * One case per generated method on every `marketData.*` facade accessor; see
 * endpoints.shared.ts for how the single-route mock validates verb + path +
 * deserialization. A coverage guard keeps this in lockstep with `capabilities`,
 * and the four market-data streaming factories are referenced by name.
 */
import { describe, expect, it } from 'vitest';

import { createMockAlpaca } from '../src/testing';
import * as streaming from '../src/streaming';
import { type EndpointCase, runEndpointCases } from './endpoints.shared';

const cases: EndpointCase[] = [
    // --- marketData.stocks ----------------------------------------------
    {
        accessor: 'marketData.stocks',
        method: 'stockBars',
        verb: 'GET',
        path: /^\/v2\/stocks\/bars$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockBars({ symbols: 'AAPL', timeframe: '1Day' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockTrades',
        verb: 'GET',
        path: /^\/v2\/stocks\/trades$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockTrades({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockQuotes',
        verb: 'GET',
        path: /^\/v2\/stocks\/quotes$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockQuotes({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockAuctions',
        verb: 'GET',
        path: /^\/v2\/stocks\/auctions$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockAuctions({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockSnapshots',
        verb: 'GET',
        path: /^\/v2\/stocks\/snapshots$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockSnapshots({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockLatestBars',
        verb: 'GET',
        path: /^\/v2\/stocks\/bars\/latest$/,
        kind: 'object',
        body: { bars: {} },
        call: (a) => a.marketData.stocks.stockLatestBars({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockLatestQuotes',
        verb: 'GET',
        path: /^\/v2\/stocks\/quotes\/latest$/,
        kind: 'object',
        body: { quotes: {} },
        call: (a) => a.marketData.stocks.stockLatestQuotes({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockLatestTrades',
        verb: 'GET',
        path: /^\/v2\/stocks\/trades\/latest$/,
        kind: 'object',
        body: { trades: {} },
        call: (a) => a.marketData.stocks.stockLatestTrades({ symbols: 'AAPL' }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockMetaConditions',
        verb: 'GET',
        path: /^\/v2\/stocks\/meta\/conditions\/[^/]+$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockMetaConditions({ ticktype: 'trade' as any, tape: 'A' as any }),
    },
    {
        accessor: 'marketData.stocks',
        method: 'stockMetaExchanges',
        verb: 'GET',
        path: /^\/v2\/stocks\/meta\/exchanges$/,
        kind: 'object',
        call: (a) => a.marketData.stocks.stockMetaExchanges(),
    },

    // --- marketData.crypto ----------------------------------------------
    {
        accessor: 'marketData.crypto',
        method: 'cryptoBars',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/bars$/,
        kind: 'object',
        call: (a) => a.marketData.crypto.cryptoBars({ loc: 'us' as any, symbols: 'BTC/USD', timeframe: '1Day' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoTrades',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/trades$/,
        kind: 'object',
        call: (a) => a.marketData.crypto.cryptoTrades({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoQuotes',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/quotes$/,
        kind: 'object',
        call: (a) => a.marketData.crypto.cryptoQuotes({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoSnapshots',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/snapshots$/,
        kind: 'object',
        body: { snapshots: {} },
        call: (a) => a.marketData.crypto.cryptoSnapshots({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoLatestBars',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/latest\/bars$/,
        kind: 'object',
        body: { bars: {} },
        call: (a) => a.marketData.crypto.cryptoLatestBars({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoLatestQuotes',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/latest\/quotes$/,
        kind: 'object',
        body: { quotes: {} },
        call: (a) => a.marketData.crypto.cryptoLatestQuotes({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoLatestTrades',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/latest\/trades$/,
        kind: 'object',
        body: { trades: {} },
        call: (a) => a.marketData.crypto.cryptoLatestTrades({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },
    {
        accessor: 'marketData.crypto',
        method: 'cryptoLatestOrderbooks',
        verb: 'GET',
        path: /^\/v1beta3\/crypto\/[^/]+\/latest\/orderbooks$/,
        kind: 'object',
        body: { orderbooks: {} },
        call: (a) => a.marketData.crypto.cryptoLatestOrderbooks({ loc: 'us' as any, symbols: 'BTC/USD' }),
    },

    // --- marketData.cryptoPerpetualFutures ------------------------------
    {
        accessor: 'marketData.cryptoPerpetualFutures',
        method: 'cryptoPerpLatestBars',
        verb: 'GET',
        path: /^\/v1beta1\/crypto-perps\/[^/]+\/latest\/bars$/,
        kind: 'object',
        body: { bars: {} },
        call: (a) => a.marketData.cryptoPerpetualFutures.cryptoPerpLatestBars({ loc: 'us' as any, symbols: 'BTC-PERP' }),
    },
    {
        accessor: 'marketData.cryptoPerpetualFutures',
        method: 'cryptoPerpLatestQuotes',
        verb: 'GET',
        path: /^\/v1beta1\/crypto-perps\/[^/]+\/latest\/quotes$/,
        kind: 'object',
        body: { quotes: {} },
        call: (a) => a.marketData.cryptoPerpetualFutures.cryptoPerpLatestQuotes({ loc: 'us' as any, symbols: 'BTC-PERP' }),
    },
    {
        accessor: 'marketData.cryptoPerpetualFutures',
        method: 'cryptoPerpLatestTrades',
        verb: 'GET',
        path: /^\/v1beta1\/crypto-perps\/[^/]+\/latest\/trades$/,
        kind: 'object',
        body: { trades: {} },
        call: (a) => a.marketData.cryptoPerpetualFutures.cryptoPerpLatestTrades({ loc: 'us' as any, symbols: 'BTC-PERP' }),
    },
    {
        accessor: 'marketData.cryptoPerpetualFutures',
        method: 'cryptoPerpLatestOrderbooks',
        verb: 'GET',
        path: /^\/v1beta1\/crypto-perps\/[^/]+\/latest\/orderbooks$/,
        kind: 'object',
        body: { orderbooks: {} },
        call: (a) => a.marketData.cryptoPerpetualFutures.cryptoPerpLatestOrderbooks({ loc: 'us' as any, symbols: 'BTC-PERP' }),
    },
    {
        accessor: 'marketData.cryptoPerpetualFutures',
        method: 'cryptoPerpLatestFuturesPricing',
        verb: 'GET',
        path: /^\/v1beta1\/crypto-perps\/[^/]+\/latest\/pricing$/,
        kind: 'object',
        body: { pricing: {} },
        call: (a) => a.marketData.cryptoPerpetualFutures.cryptoPerpLatestFuturesPricing({ loc: 'us' as any, symbols: 'BTC-PERP' }),
    },

    // --- marketData.fixedIncome -----------------------------------------
    {
        accessor: 'marketData.fixedIncome',
        method: 'fixedIncomeLatestPrices',
        verb: 'GET',
        path: /^\/v1beta1\/fixed_income\/latest\/prices$/,
        kind: 'object',
        body: { prices: {} },
        call: (a) => a.marketData.fixedIncome.fixedIncomeLatestPrices({ isins: 'US1234567890' }),
    },
    {
        accessor: 'marketData.fixedIncome',
        method: 'fixedIncomeLatestQuotes',
        verb: 'GET',
        path: /^\/v1beta1\/fixed_income\/latest\/quotes$/,
        kind: 'object',
        body: { quotes: {} },
        call: (a) => a.marketData.fixedIncome.fixedIncomeLatestQuotes({ isins: 'US1234567890' }),
    },

    // --- marketData.forex -----------------------------------------------
    {
        accessor: 'marketData.forex',
        method: 'rates',
        verb: 'GET',
        path: /^\/v1beta1\/forex\/rates$/,
        kind: 'object',
        call: (a) => a.marketData.forex.rates({ currencyPairs: 'EURUSD' }),
    },
    {
        accessor: 'marketData.forex',
        method: 'latestRates',
        verb: 'GET',
        path: /^\/v1beta1\/forex\/latest\/rates$/,
        kind: 'object',
        body: { rates: {} },
        call: (a) => a.marketData.forex.latestRates({ currencyPairs: 'EURUSD' }),
    },

    // --- marketData.indices ---------------------------------------------
    {
        accessor: 'marketData.indices',
        method: 'indexValues',
        verb: 'GET',
        path: /^\/v1beta1\/indices\/values$/,
        kind: 'object',
        call: (a) => a.marketData.indices.indexValues({ symbols: 'SPX' }),
    },
    {
        accessor: 'marketData.indices',
        method: 'indexLatestValues',
        verb: 'GET',
        path: /^\/v1beta1\/indices\/latest\/values$/,
        kind: 'object',
        body: { values: {} },
        call: (a) => a.marketData.indices.indexLatestValues({ symbols: 'SPX' }),
    },

    // --- marketData.logos -----------------------------------------------
    {
        accessor: 'marketData.logos',
        method: 'logos',
        verb: 'GET',
        path: /^\/v1beta1\/logos\/[^/]+$/,
        kind: 'object',
        call: (a) => a.marketData.logos.logos({ symbol: 'AAPL' }),
    },

    // --- marketData.news ------------------------------------------------
    {
        accessor: 'marketData.news',
        method: 'news',
        verb: 'GET',
        path: /^\/v1beta1\/news$/,
        kind: 'object',
        call: (a) => a.marketData.news.news({}),
    },

    // --- marketData.options ---------------------------------------------
    {
        accessor: 'marketData.options',
        method: 'optionBars',
        verb: 'GET',
        path: /^\/v1beta1\/options\/bars$/,
        kind: 'object',
        call: (a) => a.marketData.options.optionBars({ symbols: 'AAPL240119C00050000', timeframe: '1Day' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionTrades',
        verb: 'GET',
        path: /^\/v1beta1\/options\/trades$/,
        kind: 'object',
        call: (a) => a.marketData.options.optionTrades({ symbols: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionChain',
        verb: 'GET',
        path: /^\/v1beta1\/options\/snapshots\/[^/]+$/,
        kind: 'object',
        body: { snapshots: {} },
        call: (a) => a.marketData.options.optionChain({ underlyingSymbol: 'AAPL' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionSnapshots',
        verb: 'GET',
        path: /^\/v1beta1\/options\/snapshots$/,
        kind: 'object',
        body: { snapshots: {} },
        call: (a) => a.marketData.options.optionSnapshots({ symbols: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionLatestQuotes',
        verb: 'GET',
        path: /^\/v1beta1\/options\/quotes\/latest$/,
        kind: 'object',
        body: { quotes: {} },
        call: (a) => a.marketData.options.optionLatestQuotes({ symbols: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionLatestTrades',
        verb: 'GET',
        path: /^\/v1beta1\/options\/trades\/latest$/,
        kind: 'object',
        body: { trades: {} },
        call: (a) => a.marketData.options.optionLatestTrades({ symbols: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionMetaConditions',
        verb: 'GET',
        path: /^\/v1beta1\/options\/meta\/conditions\/[^/]+$/,
        kind: 'object',
        call: (a) => a.marketData.options.optionMetaConditions({ ticktype: 'trade' as any }),
    },
    {
        accessor: 'marketData.options',
        method: 'optionMetaExchanges',
        verb: 'GET',
        path: /^\/v1beta1\/options\/meta\/exchanges$/,
        kind: 'object',
        call: (a) => a.marketData.options.optionMetaExchanges(),
    },

    // --- marketData.screener --------------------------------------------
    {
        accessor: 'marketData.screener',
        method: 'mostActives',
        verb: 'GET',
        path: /^\/v1beta1\/screener\/stocks\/most-actives$/,
        kind: 'object',
        call: (a) => a.marketData.screener.mostActives({}),
    },
    {
        accessor: 'marketData.screener',
        method: 'movers',
        verb: 'GET',
        path: /^\/v1beta1\/screener\/[^/]+\/movers$/,
        kind: 'object',
        call: (a) => a.marketData.screener.movers({ marketType: 'stocks' as any }),
    },

    // --- marketData.corporateActions ------------------------------------
    {
        accessor: 'marketData.corporateActions',
        method: 'corporateActions',
        verb: 'GET',
        path: /^\/v1\/corporate-actions$/,
        kind: 'object',
        call: (a) => a.marketData.corporateActions.corporateActions({}),
    },
];

describe('Market Data API surface (per-endpoint)', () => {
    runEndpointCases('marketData', cases);
});

describe('Market data streaming surface', () => {
    const factories: Array<{ name: string; open: (a: ReturnType<typeof createMockAlpaca>) => unknown; ctor: unknown }> = [
        {
            name: 'stockStream',
            open: (a) => a.marketData.stockStream({ wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike }),
            ctor: streaming.StockDataStream,
        },
        {
            name: 'cryptoStream',
            open: (a) => a.marketData.cryptoStream({ wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike }),
            ctor: streaming.CryptoDataStream,
        },
        {
            name: 'optionStream',
            open: (a) => a.marketData.optionStream({ wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike }),
            ctor: streaming.OptionDataStream,
        },
        {
            name: 'newsStream',
            open: (a) => a.marketData.newsStream({ wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike }),
            ctor: streaming.NewsStream,
        },
    ];

    it.each(factories)('exposes the marketData.$name factory by name', ({ open, ctor }) => {
        const alpaca = createMockAlpaca([]);
        expect(open(alpaca)).toBeInstanceOf(ctor as any);
    });
});

/** Minimal non-connecting socket so constructing a stream touches no network. */
class FakeSocket {
    on(): this {
        return this;
    }
    send(): void {}
    close(): void {}
    terminate(): void {}
    ping(): void {}
}
