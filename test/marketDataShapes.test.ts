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
            timestampRaw: '2024-01-02T00:00:00.000Z',
            open: 10, high: 12, low: 9, close: 11,
            volume: 1000, vwap: 10.5, tradeCount: 42,
        });
    });

    it('preserves a raw RFC-3339 nanosecond string verbatim when the source is a string', () => {
        const raw = { ...stockBar, t: '2024-01-02T00:00:00.678099211Z' as unknown as Date };
        const bar = marketDataShapes.toBar(raw, 'AAPL');
        // timestamp truncates to ms; timestampRaw keeps every nanosecond digit.
        expect(bar.timestamp.toISOString()).toBe('2024-01-02T00:00:00.678Z');
        expect(bar.timestampRaw).toBe('2024-01-02T00:00:00.678099211Z');
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

    it('preserves a 64-bit crypto trade id past 2^53 as an exact idRaw string', () => {
        // The lossless transport hands the mapper an id > Number.MAX_SAFE_INTEGER
        // as a string; `id` stays a (lossy) number, `idRaw` is exact.
        const trade = { i: '8857581800245878123' as unknown as number, p: 50000, s: 0.1, t: new Date('2024-01-02T00:00:00Z'), tks: 'B' } satisfies CryptoTrade;
        const mapped = marketDataShapes.toCryptoTrade(trade, 'BTC/USD');
        expect(mapped.idRaw).toBe('8857581800245878123');
        expect(typeof mapped.id).toBe('number');
        expect(mapped.id).toBe(Number('8857581800245878123')); // best-effort float64
    });

    it('exposes idRaw for a safe stock trade id too', () => {
        const trade: StockTrade = { c: ['@'], i: 7, p: 99.5, s: 5, t: new Date('2024-01-02T00:00:00Z'), x: 'V', z: 'C' };
        const mapped = marketDataShapes.toStockTrade(trade, 'AAPL');
        expect(mapped.id).toBe(7);
        expect(mapped.idRaw).toBe('7');
    });
});

describe('quote mappers', () => {
    it('maps a full StockQuote with exchanges, conditions, and tape', () => {
        const quote: StockQuote = { ap: 11, as: 2, ax: 'V', bp: 10, bs: 3, bx: 'P', c: ['R'], t: new Date('2024-01-02T00:00:00Z'), z: 'C' };
        expect(marketDataShapes.toStockQuote(quote, 'AAPL')).toEqual({
            symbol: 'AAPL', timestamp: new Date('2024-01-02T00:00:00Z'),
            timestampRaw: '2024-01-02T00:00:00.000Z',
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

describe('index values', () => {
    it('preserves the verbatim nanosecond string while exposing a Date', () => {
        // Index-value responses deserialize verbatim, so `t` is still a raw
        // full-precision string at runtime despite the generated `Date` type.
        const raw = { t: '2024-01-02T15:04:05.678099211Z' as unknown as Date, v: 4321.5 };
        const value = marketDataShapes.toIndexValue(raw, 'SPX');
        expect(value.symbol).toBe('SPX');
        expect(value.value).toBe(4321.5);
        expect(value.timestamp.toISOString()).toBe('2024-01-02T15:04:05.678Z');
        expect(value.timestampRaw).toBe('2024-01-02T15:04:05.678099211Z');
    });

    it('stamps the symbol from the map key across a { [symbol]: IndexValue[] } map', () => {
        const out = marketDataShapes.toIndexValuesBySymbol({
            SPX: [{ t: '2024-01-02T15:04:05.5Z' as unknown as Date, v: 1 }],
        });
        expect(out.SPX[0].symbol).toBe('SPX');
        expect(out.SPX[0].timestampRaw).toBe('2024-01-02T15:04:05.5Z');
    });
});

describe('stock auctions', () => {
    it('maps opening/closing prints and preserves each nanosecond timestamp', () => {
        const daily = {
            d: '2024-01-02' as unknown as Date,
            o: [{ c: 'Q', p: 187.1, s: 100, t: '2024-01-02T14:30:00.123456789Z' as unknown as Date, x: 'V' }],
            c: [{ c: 'M', p: 188.9, t: '2024-01-02T21:00:00.987654321Z' as unknown as Date, x: 'V' }],
        };
        const mapped = marketDataShapes.toDailyAuctions(daily, 'AAPL');
        expect(mapped.symbol).toBe('AAPL');
        expect(mapped.dateRaw).toBe('2024-01-02');
        expect(mapped.opening[0]).toMatchObject({ price: 187.1, size: 100, exchange: 'V', condition: 'Q' });
        expect(mapped.opening[0].timestampRaw).toBe('2024-01-02T14:30:00.123456789Z');
        expect(mapped.closing[0].timestampRaw).toBe('2024-01-02T21:00:00.987654321Z');
        // Size is optional on closing auctions.
        expect(mapped.closing[0].size).toBeUndefined();
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

    it('getCryptoTrades preserves a 64-bit id losslessly end-to-end via idRaw', async () => {
        // Raw JSON body (sent verbatim) with an id and nanosecond timestamp that
        // native JSON.parse / new Date would both truncate. The market-data
        // transport parses losslessly, so idRaw survives to the canonical shape.
        const rawBody =
            '{"trades":{"BTC/USD":[{"t":"2024-01-02T00:00:00.123456789Z","p":50000,"s":0.1,"tks":"B","i":8857581800245878123}]},"next_page_token":null}';
        const alpaca = createMockAlpaca([{ method: 'GET', path: '/v1beta3/crypto/us/trades', body: rawBody }]);
        const trades = await alpaca.marketData.getCryptoTrades({ symbols: ['BTC/USD'], loc: 'us' });
        expect(trades['BTC/USD']).toHaveLength(1);
        const trade = trades['BTC/USD'][0];
        expect(trade.idRaw).toBe('8857581800245878123');
        expect(typeof trade.id).toBe('number');
        expect(trade.timestampRaw).toBe('2024-01-02T00:00:00.123456789Z');
    });
});
