import { describe, it, expect, vi, afterEach } from 'vitest';

import { Alpaca, TradingClient, MarketDataClient, LIVE_TRADING_BASE_PATH, DEFAULT_RATE_LIMIT } from '../src/client';
import * as trading from '../src/trading';
import * as marketData from '../src/market-data';
import * as streaming from '../src/streaming';
import {
    capabilities,
    streamingCapabilities,
    findCapabilities,
    ergonomicCapabilities,
    findErgonomic,
} from '../src/capabilities';
import { TimeFrame } from '../src/values';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

/** Captures the URL + headers of the single request a fetchApi receives. */
function capturingFetch() {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchApi = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    return { calls, fetchApi: fetchApi as unknown as trading.FetchAPI };
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
    const h = init?.headers;
    if (!h) return undefined;
    if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(name) ?? undefined;
    if (Array.isArray(h)) {
        const found = (h as [string, string][]).find(([k]) => k.toLowerCase() === name.toLowerCase());
        return found?.[1];
    }
    const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? (h as Record<string, string>)[key] : undefined;
}

/** Snapshot + clear the Alpaca credential env vars so the host environment can't leak in. */
function withCleanEnv() {
    const names = ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY', 'APCA_API_OAUTH_TOKEN'];
    const saved: Record<string, string | undefined> = {};
    for (const n of names) {
        saved[n] = process.env[n];
        delete process.env[n];
    }
    return () => {
        for (const n of names) {
            if (saved[n] === undefined) delete process.env[n];
            else process.env[n] = saved[n];
        }
    };
}

describe('Alpaca client construction', () => {
    let restoreEnv: () => void;
    afterEach(() => restoreEnv?.());

    it('throws when credentials are missing', () => {
        restoreEnv = withCleanEnv();
        expect(() => new Alpaca({})).toThrow(/accessToken|keyId/i);
        expect(() => new Alpaca({ keyId: 'x' })).toThrow(/keyId.*secret/i);
        expect(() => new Alpaca({ secret: 'y' })).toThrow(/keyId.*secret/i);
    });

    it('accepts an OAuth accessToken without keyId/secret', () => {
        restoreEnv = withCleanEnv();
        expect(() => new Alpaca({ accessToken: 'tok-123' })).not.toThrow();
    });

    it('defaults to the paper environment', () => {
        expect(new Alpaca({ ...CREDS }).paper).toBe(true);
        expect(new Alpaca({ ...CREDS, paper: false }).paper).toBe(false);
    });

    it('exposes grouped trading and marketData sub-clients', () => {
        const alpaca = new Alpaca({ ...CREDS });
        expect(alpaca.trading).toBeInstanceOf(TradingClient);
        expect(alpaca.marketData).toBeInstanceOf(MarketDataClient);
        // Sub-clients are memoized.
        expect(alpaca.trading).toBe(alpaca.trading);
        expect(alpaca.marketData).toBe(alpaca.marketData);
    });

    it('exposes `data` as an alias of `marketData`', () => {
        const alpaca = new Alpaca({ ...CREDS });
        expect(alpaca.data).toBe(alpaca.marketData);
    });
});

describe('Credential resolution (env + OAuth)', () => {
    let restoreEnv: () => void;
    afterEach(() => restoreEnv?.());

    it('falls back to APCA_API_KEY_ID / APCA_API_SECRET_KEY env vars', async () => {
        restoreEnv = withCleanEnv();
        process.env.APCA_API_KEY_ID = 'AKENV';
        process.env.APCA_API_SECRET_KEY = 'env-secret';
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ fetchApi });
        await alpaca.trading.account.getAccount();
        expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBe('AKENV');
        expect(headerValue(calls[0].init, 'APCA-API-SECRET-KEY')).toBe('env-secret');
    });

    it('lets explicit credentials win over the environment', async () => {
        restoreEnv = withCleanEnv();
        process.env.APCA_API_KEY_ID = 'AKENV';
        process.env.APCA_API_SECRET_KEY = 'env-secret';
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, fetchApi });
        await alpaca.trading.account.getAccount();
        expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBe(CREDS.keyId);
    });

    it('sends an Authorization: Bearer header for an OAuth accessToken', async () => {
        restoreEnv = withCleanEnv();
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ accessToken: 'tok-abc', fetchApi });
        await alpaca.trading.account.getAccount();
        expect(headerValue(calls[0].init, 'Authorization')).toBe('Bearer tok-abc');
        // OAuth is mutually exclusive with key/secret: no key headers are sent.
        expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBeUndefined();
        expect(headerValue(calls[0].init, 'APCA-API-SECRET-KEY')).toBeUndefined();
    });

    it('falls back to the APCA_API_OAUTH_TOKEN env var', async () => {
        restoreEnv = withCleanEnv();
        process.env.APCA_API_OAUTH_TOKEN = 'env-tok';
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ fetchApi });
        await alpaca.marketData.stocks.stockMetaExchanges();
        expect(headerValue(calls[0].init, 'Authorization')).toBe('Bearer env-tok');
    });

    it('prefers OAuth over key/secret when both are provided', async () => {
        restoreEnv = withCleanEnv();
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, accessToken: 'tok-win', fetchApi });
        await alpaca.trading.account.getAccount();
        expect(headerValue(calls[0].init, 'Authorization')).toBe('Bearer tok-win');
        expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBeUndefined();
    });
});

describe('Trading sub-client', () => {
    it('exposes every trading API as the right instance', () => {
        const { trading: t } = new Alpaca({ ...CREDS });
        expect(t.account).toBeInstanceOf(trading.AccountsApi);
        expect(t.accountActivities).toBeInstanceOf(trading.AccountActivitiesApi);
        expect(t.accountConfigurations).toBeInstanceOf(trading.AccountConfigurationsApi);
        expect(t.assets).toBeInstanceOf(trading.AssetsApi);
        expect(t.calendar).toBeInstanceOf(trading.CalendarApi);
        expect(t.corporateActions).toBeInstanceOf(trading.CorporateActionsApi);
        expect(t.cryptoFunding).toBeInstanceOf(trading.CryptoFundingApi);
        expect(t.cryptoPerpetualsAccountVitals).toBeInstanceOf(trading.CryptoPerpetualsAccountVitalsBetaApi);
        expect(t.cryptoPerpetualsFunding).toBeInstanceOf(trading.CryptoPerpetualsFundingBetaApi);
        expect(t.cryptoPerpetualsLeverage).toBeInstanceOf(trading.CryptoPerpetualsLeverageBetaApi);
        expect(t.events).toBeInstanceOf(trading.EventsApi);
        expect(t.orders).toBeInstanceOf(trading.OrdersApi);
        expect(t.portfolioHistory).toBeInstanceOf(trading.PortfolioHistoryApi);
        expect(t.positions).toBeInstanceOf(trading.PositionsApi);
        expect(t.tokenization).toBeInstanceOf(trading.TokenizationApi);
        expect(t.watchlists).toBeInstanceOf(trading.WatchlistsApi);
    });

    it('memoizes each API instance', () => {
        const { trading: t } = new Alpaca({ ...CREDS });
        expect(t.orders).toBe(t.orders);
        expect(t.positions).toBe(t.positions);
    });

    it('uses the paper host by default and sends auth headers', async () => {
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, fetchApi });
        await alpaca.trading.account.getAccount();
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toContain('https://paper-api.alpaca.markets');
        expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBe(CREDS.keyId);
        expect(headerValue(calls[0].init, 'APCA-API-SECRET-KEY')).toBe(CREDS.secret);
    });

    it('uses the live host when paper is false', async () => {
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, paper: false, fetchApi });
        await alpaca.trading.account.getAccount();
        expect(calls[0].url).toContain(LIVE_TRADING_BASE_PATH);
        expect(calls[0].url).not.toContain('paper-api');
    });
});

describe('Market-data sub-client', () => {
    it('exposes every market-data API as the right instance', () => {
        const { marketData: md } = new Alpaca({ ...CREDS });
        expect(md.stocks).toBeInstanceOf(marketData.StockApi);
        expect(md.crypto).toBeInstanceOf(marketData.CryptoApi);
        expect(md.cryptoPerpetualFutures).toBeInstanceOf(marketData.CryptoPerpetualFuturesApi);
        expect(md.fixedIncome).toBeInstanceOf(marketData.FixedIncomeApi);
        expect(md.forex).toBeInstanceOf(marketData.ForexApi);
        expect(md.indices).toBeInstanceOf(marketData.IndexApi);
        expect(md.logos).toBeInstanceOf(marketData.LogosApi);
        expect(md.news).toBeInstanceOf(marketData.NewsApi);
        expect(md.options).toBeInstanceOf(marketData.OptionApi);
        expect(md.screener).toBeInstanceOf(marketData.ScreenerApi);
        expect(md.corporateActions).toBeInstanceOf(marketData.CorporateActionsApi);
    });

    it('memoizes each API instance', () => {
        const { marketData: md } = new Alpaca({ ...CREDS });
        expect(md.stocks).toBe(md.stocks);
    });

    it('uses the data host regardless of the paper flag', async () => {
        for (const paper of [true, false]) {
            const { calls, fetchApi } = capturingFetch();
            const alpaca = new Alpaca({ ...CREDS, paper, fetchApi });
            await alpaca.marketData.stocks.stockMetaExchanges();
            expect(calls[0].url).toContain('https://data.alpaca.markets');
            expect(headerValue(calls[0].init, 'APCA-API-KEY-ID')).toBe(CREDS.keyId);
        }
    });
});

describe('Streaming factories', () => {
    const wsFactory = () => ({
        on: () => undefined,
        send: () => undefined,
        close: () => undefined,
    });

    it('builds a trading stream that inherits the paper flag', () => {
        const paperStream = new Alpaca({ ...CREDS }).trading.stream({ wsFactory });
        expect(paperStream).toBeInstanceOf(streaming.TradingStream);

        const liveStream = new Alpaca({ ...CREDS, paper: false }).trading.stream({ wsFactory });
        expect(liveStream).toBeInstanceOf(streaming.TradingStream);
    });

    it('builds each market-data stream type', () => {
        const { marketData: md } = new Alpaca({ ...CREDS });
        expect(md.stockStream({ wsFactory })).toBeInstanceOf(streaming.StockDataStream);
        expect(md.cryptoStream({ wsFactory })).toBeInstanceOf(streaming.CryptoDataStream);
        expect(md.optionStream({ wsFactory })).toBeInstanceOf(streaming.OptionDataStream);
        expect(md.newsStream({ wsFactory })).toBeInstanceOf(streaming.NewsStream);
    });
});

/** A fetchApi that serves a JSON body per `page_token` query value and records tokens seen. */
function pagedFetch(pagesByToken: Record<string, unknown>) {
    const tokens: Array<string | null> = [];
    const fetchApi = async (url: string | URL | Request): Promise<Response> => {
        const token = new URL(String(url)).searchParams.get('page_token');
        tokens.push(token);
        const body = pagesByToken[token ?? ''];
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    return { tokens, fetchApi: fetchApi as unknown as trading.FetchAPI };
}

describe('Pagination iterators', () => {
    it('iterates and merges multi-symbol stock bars across pages', async () => {
        const { fetchApi, tokens } = pagedFetch({
            '': { bars: { AAPL: [{ c: 1 }, { c: 2 }], MSFT: [{ c: 10 }] }, next_page_token: 'p2' },
            p2: { bars: { AAPL: [{ c: 3 }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const req = { symbols: 'AAPL,MSFT', timeframe: TimeFrame.Day };

        const flat: Array<{ symbol: string }> = [];
        for await (const rec of md.iterateStockBars(req)) flat.push(rec);
        expect(flat).toHaveLength(4);

        const bySymbol = await md.collectStockBarsBySymbol(req);
        expect(bySymbol.AAPL).toHaveLength(3);
        expect(bySymbol.MSFT).toHaveLength(1);
        // page_token threaded: undefined first, then 'p2' (x2: once per iterate/collect pass).
        expect(tokens).toContain('p2');
    });

    it('accepts a `symbols` array and joins it for the wire', async () => {
        const { calls, fetchApi } = capturingFetch();
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        await md.collectStockBarsBySymbol({ symbols: ['AAPL', 'MSFT'], timeframe: TimeFrame.Day });
        expect(new URL(calls[0].url).searchParams.get('symbols')).toBe('AAPL,MSFT');
    });

    it('accepts a forex `currencyPairs` array and joins it for the wire', async () => {
        const { calls, fetchApi } = capturingFetch();
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        await md.collectForexRatesBySymbol({ currencyPairs: ['EUR/USD', 'GBP/USD'], timeframe: TimeFrame.Day });
        expect(new URL(calls[0].url).searchParams.get('currency_pairs')).toBe('EUR/USD,GBP/USD');
    });

    it('caps each symbol at maxPerSymbol and stops paginating early', async () => {
        const { fetchApi, tokens } = pagedFetch({
            '': { bars: { AAPL: [{ c: 1 }, { c: 2 }], MSFT: [{ c: 10 }, { c: 11 }] }, next_page_token: 'p2' },
            p2: { bars: { AAPL: [{ c: 3 }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const bySymbol = await md.collectStockBarsBySymbol(
            { symbols: 'AAPL,MSFT', timeframe: TimeFrame.Day },
            { maxPerSymbol: 2 },
        );
        expect(bySymbol.AAPL).toHaveLength(2);
        expect(bySymbol.MSFT).toHaveLength(2);
        // Both symbols filled on the first page, so 'p2' is never fetched.
        expect(tokens).toEqual([null]);
    });

    it('splits symbols into concurrent per-symbol requests when concurrency > 1', async () => {
        const seen: string[] = [];
        const fetchApi = (async (url: string | URL | Request): Promise<Response> => {
            const symbols = new URL(String(url)).searchParams.get('symbols') ?? '';
            seen.push(symbols);
            const bars: Record<string, unknown[]> = {};
            for (const s of symbols.split(',')) bars[s] = [{ c: 1 }];
            return new Response(JSON.stringify({ bars, next_page_token: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as trading.FetchAPI;
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const bySymbol = await md.collectStockBarsBySymbol(
            { symbols: ['AAPL', 'MSFT', 'TSLA'], timeframe: TimeFrame.Day },
            { concurrency: 2 },
        );
        expect(Object.keys(bySymbol).sort()).toEqual(['AAPL', 'MSFT', 'TSLA']);
        // chunkSize defaults to 1, so each symbol is fetched on its own request.
        expect(seen.sort()).toEqual(['AAPL', 'MSFT', 'TSLA']);
    });

    it('groups symbols by chunkSize under concurrency', async () => {
        const seen: string[] = [];
        const fetchApi = (async (url: string | URL | Request): Promise<Response> => {
            const symbols = new URL(String(url)).searchParams.get('symbols') ?? '';
            seen.push(symbols);
            const bars: Record<string, unknown[]> = {};
            for (const s of symbols.split(',')) bars[s] = [{ c: 1 }];
            return new Response(JSON.stringify({ bars, next_page_token: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as trading.FetchAPI;
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        await md.collectStockBarsBySymbol(
            { symbols: ['A', 'B', 'C'], timeframe: TimeFrame.Day },
            { concurrency: 2, chunkSize: 2 },
        );
        expect(seen.sort()).toEqual(['A,B', 'C']);
    });

    it('collects a top-level array endpoint (news) across pages', async () => {
        const { fetchApi } = pagedFetch({
            '': { news: [{ id: 1 }, { id: 2 }], next_page_token: 'n2' },
            n2: { news: [{ id: 3 }], next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const all = await md.collectNews();
        expect(all).toHaveLength(3);
    });

    it('collects a symbol-object endpoint (option snapshots), later pages overwriting', async () => {
        const { fetchApi } = pagedFetch({
            '': { snapshots: { 'AAPL240119C': { latestTrade: { p: 1 } } }, next_page_token: 's2' },
            s2: { snapshots: { 'MSFT240119C': { latestTrade: { p: 2 } } }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const merged = await md.collectOptionSnapshotsBySymbol({ symbols: 'AAPL240119C,MSFT240119C' });
        expect(Object.keys(merged).sort()).toEqual(['AAPL240119C', 'MSFT240119C']);
    });

    it('merges corporate-action sub-arrays across pages', async () => {
        const { fetchApi } = pagedFetch({
            '': { corporate_actions: { cash_dividends: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }, next_page_token: 'c2' },
            c2: { corporate_actions: { cash_dividends: [{ symbol: 'TSLA' }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });
        const merged = await md.collectCorporateActions({ symbols: 'AAPL,MSFT,TSLA' });
        expect(merged.cashDividends).toHaveLength(3);
    });

    it('follows cursor pagination for account activities using the last id', async () => {
        const { fetchApi, tokens } = pagedFetch({
            '': [{ id: 'a' }, { id: 'b' }],
            b: [{ id: 'c' }],
            c: [],
        });
        const { trading: t } = new Alpaca({ ...CREDS, fetchApi });
        const all = await t.collectActivities();
        expect(all.map((a) => a.id)).toEqual(['a', 'b', 'c']);
        expect(tokens).toEqual([null, 'b', 'c']);
    });
});

describe('Single-symbol normalized accessors (*For)', () => {
    it('getStockBarsFor unwraps to a canonical Bar[] with the symbol stamped', async () => {
        const { fetchApi } = pagedFetch({
            '': { bars: { AAPL: [{ t: '2024-01-02T00:00:00Z', o: 1, h: 2, l: 0.5, c: 1.5, v: 100, n: 3, vw: 1.2 }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });

        const bars = await md.getStockBarsFor('AAPL', { timeframe: TimeFrame.Day });
        expect(Array.isArray(bars)).toBe(true);
        expect(bars).toHaveLength(1);
        expect(bars[0].symbol).toBe('AAPL');
        expect(bars[0].close).toBe(1.5);
        // Canonical shapes always hand back a real Date, even though the raw
        // map response carries the timestamp as an ISO string at runtime.
        expect(bars[0].timestamp).toBeInstanceOf(Date);
    });

    it('getStockCandlesFor returns a single Candles object (not a symbol map)', async () => {
        const { fetchApi } = pagedFetch({
            '': { bars: { AAPL: [{ t: '2024-01-02T00:00:00Z', o: 1, h: 2, l: 0.5, c: 1.5, v: 100, n: 3, vw: 1.2 }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });

        const candles = await md.getStockCandlesFor('AAPL', { timeframe: TimeFrame.Day });
        expect(candles.symbol).toBe('AAPL');
        expect(candles.close).toEqual([1.5]);
        expect(candles.time).toHaveLength(1);
        expect(typeof candles.time[0]).toBe('number');
    });

    it('returns an empty series / empty Candles when the symbol has no data', async () => {
        const { fetchApi } = pagedFetch({
            '': { bars: {}, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });

        expect(await md.getStockBarsFor('AAPL', { timeframe: TimeFrame.Day })).toEqual([]);
        const candles = await md.getStockCandlesFor('AAPL', { timeframe: TimeFrame.Day });
        expect(candles.close).toEqual([]);
        expect(candles.time).toEqual([]);
    });

    it('getCryptoTradesFor unwraps a single pair to canonical Trade[]', async () => {
        const { fetchApi } = pagedFetch({
            '': { trades: { 'BTC/USD': [{ t: '2024-01-02T00:00:00Z', p: 42000, s: 0.1, i: 7 }] }, next_page_token: null },
        });
        const { marketData: md } = new Alpaca({ ...CREDS, fetchApi });

        const trades = await md.getCryptoTradesFor('BTC/USD', { loc: 'us' });
        expect(trades).toHaveLength(1);
        expect(trades[0].symbol).toBe('BTC/USD');
        expect(trades[0].price).toBe(42000);
    });
});

describe('Facade rate limiting', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('exposes a sane default budget', () => {
        expect(DEFAULT_RATE_LIMIT.maxRequests).toBe(200);
        expect(DEFAULT_RATE_LIMIT.intervalMs).toBe(60_000);
    });

    it('throttles requests once the configured budget is exhausted', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        let completed = 0;
        const fetchApi = (async () =>
            new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as trading.FetchAPI;
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: { maxRequests: 1, intervalMs: 10_000 } });

        const a = alpaca.trading.account.getAccount().then(() => completed++);
        const b = alpaca.trading.account.getAccount().then(() => completed++);

        await a; // first call has a token
        await Promise.resolve();
        expect(completed).toBe(1); // second is queued, no token left

        await vi.advanceTimersByTimeAsync(10_000); // refill one token
        await b;
        expect(completed).toBe(2);
    });

    it('does not throttle when rateLimit is false', async () => {
        const calls: number[] = [];
        const fetchApi = (async () => {
            calls.push(1);
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }) as unknown as trading.FetchAPI;
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        await Promise.all(Array.from({ length: 10 }, () => alpaca.trading.account.getAccount()));
        expect(calls).toHaveLength(10);
    });
});

describe('Capability map', () => {
    it('every entry is well-formed', () => {
        for (const entry of capabilities) {
            expect(entry.accessor).toMatch(/^(trading|marketData)\.[a-zA-Z]+$/);
            expect(entry.api).toBeTruthy();
            expect(entry.methods.length).toBeGreaterThan(0);
        }
    });

    it('locates a method on its accessor / Api class', () => {
        const account = findCapabilities('getAccount');
        expect(account).toHaveLength(1);
        expect(account[0].accessor).toBe('trading.account');
        expect(account[0].api).toBe('AccountsApi');

        const bars = findCapabilities('stockBars');
        expect(bars[0].accessor).toBe('marketData.stocks');
        expect(bars[0].api).toBe('StockApi');
    });

    it('lists the streaming factories', () => {
        const tradeStream = streamingCapabilities.find((s) => s.accessor === 'trading.stream');
        expect(tradeStream?.stream).toBe('TradingStream');
    });

    it('every listed method actually exists on its Api instance', () => {
        const alpaca = new Alpaca({ ...CREDS });
        for (const entry of capabilities) {
            const [group, prop] = entry.accessor.split('.');
            const client = (alpaca as unknown as Record<string, Record<string, unknown>>)[group];
            const apiInstance = client[prop] as unknown as Record<string, unknown>;
            expect(apiInstance, entry.accessor).toBeTruthy();
            for (const method of entry.methods) {
                expect(typeof apiInstance[method], `${entry.accessor}.${method}`).toBe('function');
            }
        }
    });

    it('every ergonomic entry is well-formed', () => {
        const kinds = new Set(['orderBuilder', 'workflow', 'normalized', 'pagination']);
        for (const entry of ergonomicCapabilities) {
            expect(entry.accessor).toMatch(/^(trading|marketData)(\.[a-zA-Z]+)?$/);
            expect(entry.group === 'trading' || entry.group === 'marketData', entry.accessor).toBe(true);
            expect(kinds.has(entry.kind), entry.kind).toBe(true);
            expect(entry.summary).toBeTruthy();
            expect(entry.methods.length).toBeGreaterThan(0);
        }
    });

    it('every ergonomic helper actually exists on the facade', () => {
        const alpaca = new Alpaca({ ...CREDS });
        for (const entry of ergonomicCapabilities) {
            // Walk the dotted accessor (e.g. "trading.orders" or "marketData") from the client.
            let target = alpaca as unknown as Record<string, unknown>;
            for (const segment of entry.accessor.split('.')) {
                target = target[segment] as Record<string, unknown>;
                expect(target, entry.accessor).toBeTruthy();
            }
            for (const method of entry.methods) {
                expect(typeof target[method], `${entry.accessor}.${method}`).toBe('function');
            }
        }
    });

    it('locates an ergonomic helper by name', () => {
        const market = findErgonomic('market');
        expect(market).toHaveLength(1);
        expect(market[0].accessor).toBe('trading.orders');
        expect(market[0].kind).toBe('orderBuilder');

        const stockBars = findErgonomic('getStockBars');
        expect(stockBars[0].accessor).toBe('marketData');
        expect(stockBars[0].kind).toBe('normalized');
    });
});
