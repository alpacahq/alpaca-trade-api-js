import { describe, expect, it } from 'vitest';

import * as marketDataShapes from '../src/marketDataShapes';
import { createMockAlpaca } from '../src/testing';
import { TimeFrame } from '../src/values';
import type { StockBar, StockTrade, CryptoTrade, OptionTrade, StockQuote, CryptoQuote, OptionQuote } from '../src/market-data';

const stockBar: StockBar = {
    o: 10, h: 12, l: 9, c: 11, v: 1000, vw: 10.5, n: 42,
    t: new Date('2024-01-02T00:00:00Z'),
};

describe('toBar', () => {
    it('maps compact wire keys onto the canonical Bar', () => {
        expect(marketDataShapes.toBar(stockBar, 'AAPL')).toEqual({
            symbol: 'AAPL',
            timestamp: new Date('2024-01-02T00:00:00Z'),
            open: 10, high: 12, low: 9, close: 11,
            volume: 1000, vwap: 10.5, tradeCount: 42,
        });
    });

    it('coerces a still-raw string timestamp into a Date', () => {
        const raw = { ...stockBar, t: '2024-01-02T00:00:00Z' as unknown as Date };
        const bar = marketDataShapes.toBar(raw);
        expect(bar.timestamp).toBeInstanceOf(Date);
        expect(bar.timestamp.toISOString()).toBe('2024-01-02T00:00:00.000Z');
        expect(bar.symbol).toBeUndefined();
    });
});

describe('trade mappers normalize conditions and asset-specific fields', () => {
    it('passes a StockTrade condition array through', () => {
        const trade: StockTrade = { c: ['@', 'T'], i: 7, p: 99.5, s: 5, t: new Date('2024-01-02T00:00:00Z'), u: 'corrected', x: 'V', z: 'C' };
        expect(marketDataShapes.toStockTrade(trade, 'AAPL')).toMatchObject({
            symbol: 'AAPL', price: 99.5, size: 5, id: 7, exchange: 'V',
            conditions: ['@', 'T'], tape: 'C', update: 'corrected',
        });
    });

    it('wraps a single OptionTrade condition string into an array', () => {
        const trade: OptionTrade = { c: 'I', p: 1.2, s: 3, t: new Date('2024-01-02T00:00:00Z'), x: 'C' };
        expect(marketDataShapes.toOptionTrade(trade).conditions).toEqual(['I']);
    });

    it('maps a CryptoTrade taker side and leaves conditions absent', () => {
        const trade: CryptoTrade = { i: 1, p: 50000, s: 0.1, t: new Date('2024-01-02T00:00:00Z'), tks: 'B' };
        const mapped = marketDataShapes.toCryptoTrade(trade, 'BTC/USD');
        expect(mapped.takerSide).toBe('B');
        expect(mapped.conditions).toBeUndefined();
        expect(mapped.symbol).toBe('BTC/USD');
    });
});

describe('quote mappers', () => {
    it('maps a full StockQuote with exchanges, conditions, and tape', () => {
        const quote: StockQuote = { ap: 11, as: 2, ax: 'V', bp: 10, bs: 3, bx: 'P', c: ['R'], t: new Date('2024-01-02T00:00:00Z'), z: 'C' };
        expect(marketDataShapes.toStockQuote(quote, 'AAPL')).toEqual({
            symbol: 'AAPL', timestamp: new Date('2024-01-02T00:00:00Z'),
            bidPrice: 10, bidSize: 3, bidExchange: 'P',
            askPrice: 11, askSize: 2, askExchange: 'V',
            conditions: ['R'], tape: 'C',
        });
    });

    it('maps a CryptoQuote without exchanges/conditions', () => {
        const quote: CryptoQuote = { ap: 50010, as: 1, bp: 49990, bs: 2, t: new Date('2024-01-02T00:00:00Z') };
        const mapped = marketDataShapes.toCryptoQuote(quote);
        expect(mapped).toMatchObject({ bidPrice: 49990, askPrice: 50010, bidSize: 2, askSize: 1 });
        expect(mapped.bidExchange).toBeUndefined();
        expect(mapped.conditions).toBeUndefined();
    });

    it('wraps a single OptionQuote condition string into an array', () => {
        const quote: OptionQuote = { ap: 1.3, as: 4, ax: 'C', bp: 1.1, bs: 6, bx: 'C', c: 'B', t: new Date('2024-01-02T00:00:00Z') };
        expect(marketDataShapes.toOptionQuote(quote).conditions).toEqual(['B']);
    });
});

describe('symbol-map helpers', () => {
    it('stamps the symbol from the map key onto every record', () => {
        const out = marketDataShapes.toBarsBySymbol({ AAPL: [stockBar], MSFT: [stockBar, stockBar] });
        expect(out.AAPL).toHaveLength(1);
        expect(out.MSFT).toHaveLength(2);
        expect(out.AAPL[0].symbol).toBe('AAPL');
        expect(out.MSFT[1].symbol).toBe('MSFT');
    });

    it('routes trades/quotes through the provided per-record mapper', () => {
        const trades = marketDataShapes.toTradesBySymbol(
            { 'BTC/USD': [{ i: 1, p: 1, s: 1, t: new Date('2024-01-02T00:00:00Z'), tks: 'S' } as CryptoTrade] },
            marketDataShapes.toCryptoTrade,
        );
        expect(trades['BTC/USD'][0]).toMatchObject({ symbol: 'BTC/USD', takerSide: 'S' });
    });
});

describe('chart helpers', () => {
    const bars = [
        marketDataShapes.toBar({ ...stockBar, t: new Date('2024-01-02T00:00:00Z') }, 'AAPL'),
        marketDataShapes.toBar({ ...stockBar, o: 11, c: 13, t: new Date('2024-01-03T00:00:00Z') }, 'AAPL'),
    ];

    it('toCandles produces parallel columns with epoch-ms time by default', () => {
        const candles = marketDataShapes.toCandles(bars);
        expect(candles.symbol).toBe('AAPL');
        expect(candles.time).toEqual([
            Date.parse('2024-01-02T00:00:00Z'),
            Date.parse('2024-01-03T00:00:00Z'),
        ]);
        expect(candles.open).toEqual([10, 11]);
        expect(candles.close).toEqual([11, 13]);
        expect(candles.volume).toHaveLength(2);
    });

    it('toCandles can emit unix seconds', () => {
        const candles = marketDataShapes.toCandles(bars, { time: 'seconds' });
        expect(candles.time[0]).toBe(Math.floor(Date.parse('2024-01-02T00:00:00Z') / 1000));
    });

    it('toCandlestickSeries emits one OHLC point per bar', () => {
        const series = marketDataShapes.toCandlestickSeries(bars);
        expect(series).toHaveLength(2);
        expect(series[1]).toMatchObject({ open: 11, high: 12, low: 9, close: 13 });
    });

    it('toLineSeries selects the requested field and skips missing values', () => {
        const close = marketDataShapes.toLineSeries(bars);
        expect(close.map((p) => p.value)).toEqual([11, 13]);

        const noVwap = [{ ...bars[0], vwap: undefined }];
        expect(marketDataShapes.toLineSeries(noVwap, 'vwap')).toEqual([]);
    });
});

describe('MarketDataClient normalized accessors', () => {
    const barsBody = {
        bars: {
            AAPL: [
                { o: 10, h: 12, l: 9, c: 11, v: 1000, vw: 10.5, n: 42, t: '2024-01-02T00:00:00Z' },
                { o: 11, h: 13, l: 10, c: 12, v: 2000, vw: 11.5, n: 50, t: '2024-01-03T00:00:00Z' },
            ],
        },
        next_page_token: null,
    };

    it('getStockBars returns canonical Bars with Date timestamps and symbols', async () => {
        const alpaca = createMockAlpaca([{ method: 'GET', path: '/v2/stocks/bars', body: barsBody }]);
        const bars = await alpaca.marketData.getStockBars({ symbols: ['AAPL'], timeframe: TimeFrame.Day });
        expect(bars.AAPL).toHaveLength(2);
        expect(bars.AAPL[0]).toMatchObject({ symbol: 'AAPL', open: 10, close: 11, vwap: 10.5, tradeCount: 42 });
        expect(bars.AAPL[0].timestamp).toBeInstanceOf(Date);
        expect(bars.AAPL[0].timestamp.toISOString()).toBe('2024-01-02T00:00:00.000Z');
    });

    it('getStockCandles returns chart-ready columns', async () => {
        const alpaca = createMockAlpaca([{ method: 'GET', path: '/v2/stocks/bars', body: barsBody }]);
        const candles = await alpaca.marketData.getStockCandles({ symbols: 'AAPL', timeframe: TimeFrame.Day });
        expect(candles.AAPL.close).toEqual([11, 12]);
        expect(candles.AAPL.time[0]).toBe(Date.parse('2024-01-02T00:00:00Z'));
    });
});
