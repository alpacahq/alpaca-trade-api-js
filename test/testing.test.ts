import { describe, expect, it } from 'vitest';

import { mockFetch, createMockAlpaca } from '../src/testing';

describe('mockFetch', () => {
    it('answers matching routes and 404s the rest', async () => {
        const fetchApi = mockFetch([
            { method: 'GET', path: '/v2/account', body: { account_number: 'PA1' } },
        ]) as unknown as (url: string, init?: RequestInit) => Promise<Response>;

        const ok = await fetchApi('https://paper-api.alpaca.markets/v2/account');
        expect(ok.status).toBe(200);
        await expect(ok.json()).resolves.toMatchObject({ account_number: 'PA1' });

        const miss = await fetchApi('https://paper-api.alpaca.markets/v2/orders', { method: 'GET' });
        expect(miss.status).toBe(404);
    });

    it('supports RegExp paths and dynamic responders', async () => {
        const fetchApi = mockFetch([
            {
                path: /\/v2\/stocks\/[A-Z]+\/trades\/latest$/,
                respond: ({ url }) => ({ symbol: url.pathname.split('/')[3], trade: { p: 42 } }),
            },
        ]) as unknown as (url: string, init?: RequestInit) => Promise<Response>;

        const res = await fetchApi('https://data.alpaca.markets/v2/stocks/AAPL/trades/latest');
        await expect(res.json()).resolves.toMatchObject({ symbol: 'AAPL', trade: { p: 42 } });
    });
});

describe('createMockAlpaca', () => {
    it('builds a working Alpaca client off canned routes', async () => {
        const alpaca = createMockAlpaca([
            { method: 'GET', path: '/v2/account', body: { id: 'a', account_number: 'PA42', status: 'ACTIVE' } },
            {
                path: /\/v2\/stocks\/[A-Z]+\/trades\/latest$/,
                body: { symbol: 'AAPL', trade: { c: [], i: 1, p: 99.5, s: 1, t: '2024-01-01T00:00:00Z', x: 'V', z: 'C' } },
            },
        ]);

        const account = await alpaca.trading.account.getAccount();
        expect(account.accountNumber).toBe('PA42');

        const price = await alpaca.marketData.getLatestPrice('AAPL');
        expect(price).toBe(99.5);
    });

    it('uses the fallback for unmatched routes', async () => {
        const alpaca = createMockAlpaca([], {
            fallback: () => new Response(JSON.stringify({ code: 40410000, message: 'nope' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            }),
        });
        await expect(alpaca.trading.account.getAccount()).rejects.toMatchObject({ status: 404 });
    });
});
