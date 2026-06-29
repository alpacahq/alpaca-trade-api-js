import { describe, it, expect } from 'vitest';

import {
    buildMarketOrder,
    buildLimitOrder,
    buildStopOrder,
    buildStopLimitOrder,
    buildTrailingStopOrder,
    buildBracketOrder,
    buildOcoOrder,
    buildOtoOrder,
    buildOrder,
    toAmountString,
} from '../src/orders';
import { Alpaca, OrdersApi } from '../src/client';
import * as trading from '../src/trading';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

describe('toAmountString', () => {
    it('stringifies finite numbers', () => {
        expect(toAmountString(1)).toBe('1');
        expect(toAmountString(150.25)).toBe('150.25');
        expect(toAmountString(0)).toBe('0');
    });

    it('trims and passes through non-empty strings', () => {
        expect(toAmountString('  12.5 ')).toBe('12.5');
        expect(toAmountString('1000000.123456789')).toBe('1000000.123456789');
    });

    it('throws for non-finite numbers and empty/invalid input', () => {
        expect(() => toAmountString(NaN, 'qty')).toThrow(/finite number/);
        expect(() => toAmountString(Infinity, 'qty')).toThrow(/finite number/);
        expect(() => toAmountString('', 'qty')).toThrow(/non-empty/);
        expect(() => toAmountString('   ', 'qty')).toThrow(/non-empty/);
        expect(() => toAmountString(undefined as never, 'qty')).toThrow(/number or string/);
    });
});

describe('buildMarketOrder', () => {
    it('builds a qty market order with default day TIF', () => {
        const req = buildMarketOrder({ symbol: 'AAPL', qty: 1, side: 'buy' });
        expect(req).toMatchObject({
            symbol: 'AAPL',
            qty: '1',
            side: 'buy',
            type: 'market',
            timeInForce: 'day',
        });
        expect(req.notional).toBeUndefined();
    });

    it('builds a notional market order', () => {
        const req = buildMarketOrder({ symbol: 'AAPL', notional: 1000, side: 'buy' });
        expect(req.notional).toBe('1000');
        expect(req.qty).toBeUndefined();
    });

    it('honors an explicit time-in-force and common fields', () => {
        const req = buildMarketOrder({
            symbol: 'AAPL',
            qty: '2',
            side: 'sell',
            timeInForce: 'gtc',
            clientOrderId: 'abc-123',
            extendedHours: true,
            positionIntent: 'sell_to_close',
        });
        expect(req.timeInForce).toBe('gtc');
        expect(req.clientOrderId).toBe('abc-123');
        expect(req.extendedHours).toBe(true);
        expect(req.positionIntent).toBe('sell_to_close');
    });
});

describe('buildLimitOrder / buildStopOrder / buildStopLimitOrder', () => {
    it('builds a limit order', () => {
        const req = buildLimitOrder({ symbol: 'AAPL', qty: 10, side: 'buy', limitPrice: 150 });
        expect(req).toMatchObject({ type: 'limit', qty: '10', limitPrice: '150' });
    });

    it('builds a stop order', () => {
        const req = buildStopOrder({ symbol: 'AAPL', qty: 10, side: 'sell', stopPrice: 140 });
        expect(req).toMatchObject({ type: 'stop', stopPrice: '140' });
    });

    it('builds a stop-limit order', () => {
        const req = buildStopLimitOrder({
            symbol: 'AAPL',
            qty: 10,
            side: 'sell',
            stopPrice: 140,
            limitPrice: '139.50',
        });
        expect(req).toMatchObject({ type: 'stop_limit', stopPrice: '140', limitPrice: '139.50' });
    });
});

describe('buildTrailingStopOrder', () => {
    it('builds a trail-price variant', () => {
        const req = buildTrailingStopOrder({ symbol: 'AAPL', qty: 10, side: 'sell', trailPrice: 2.5 });
        expect(req).toMatchObject({ type: 'trailing_stop', trailPrice: '2.5' });
        expect(req.trailPercent).toBeUndefined();
    });

    it('builds a trail-percent variant', () => {
        const req = buildTrailingStopOrder({ symbol: 'AAPL', qty: 10, side: 'sell', trailPercent: 5 });
        expect(req).toMatchObject({ type: 'trailing_stop', trailPercent: '5' });
        expect(req.trailPrice).toBeUndefined();
    });
});

describe('buildBracketOrder', () => {
    it('builds a market-entry bracket with both legs', () => {
        const req = buildBracketOrder({
            symbol: 'AAPL',
            qty: 10,
            side: 'buy',
            takeProfit: { limitPrice: 155 },
            stopLoss: { stopPrice: 145 },
        });
        expect(req.type).toBe('market');
        expect(req.orderClass).toBe('bracket');
        expect(req.takeProfit).toEqual({ limitPrice: '155' });
        expect(req.stopLoss).toEqual({ stopPrice: '145' });
        expect(req.limitPrice).toBeUndefined();
    });

    it('builds a limit-entry bracket and a stop-limit loss leg', () => {
        const req = buildBracketOrder({
            symbol: 'AAPL',
            qty: 10,
            side: 'buy',
            limitPrice: 150,
            takeProfit: { limitPrice: 155 },
            stopLoss: { stopPrice: 145, limitPrice: 144.5 },
        });
        expect(req.type).toBe('limit');
        expect(req.limitPrice).toBe('150');
        expect(req.stopLoss).toEqual({ stopPrice: '145', limitPrice: '144.5' });
    });
});

describe('buildOcoOrder / buildOtoOrder', () => {
    it('builds an OCO order as a limit with both legs', () => {
        const req = buildOcoOrder({
            symbol: 'AAPL',
            qty: 10,
            side: 'sell',
            takeProfit: { limitPrice: 155 },
            stopLoss: { stopPrice: 145 },
        });
        expect(req).toMatchObject({ type: 'limit', orderClass: 'oco' });
        expect(req.takeProfit).toEqual({ limitPrice: '155' });
        expect(req.stopLoss).toEqual({ stopPrice: '145' });
    });

    it('builds an OTO order with a single take-profit leg (market entry)', () => {
        const req = buildOtoOrder({ symbol: 'AAPL', qty: 10, side: 'buy', takeProfit: { limitPrice: 155 } });
        expect(req).toMatchObject({ type: 'market', orderClass: 'oto' });
        expect(req.takeProfit).toEqual({ limitPrice: '155' });
        expect(req.stopLoss).toBeUndefined();
    });

    it('builds an OTO order with a single stop-loss leg (limit entry)', () => {
        const req = buildOtoOrder({ symbol: 'AAPL', qty: 10, side: 'buy', limitPrice: 150, stopLoss: { stopPrice: 145 } });
        expect(req).toMatchObject({ type: 'limit', orderClass: 'oto', limitPrice: '150' });
        expect(req.stopLoss).toEqual({ stopPrice: '145' });
        expect(req.takeProfit).toBeUndefined();
    });
});

describe('buildOrder (generic escape hatch)', () => {
    it('normalizes amount fields and passes through the rest', () => {
        const req = buildOrder({
            type: 'limit',
            symbol: 'AAPL',
            side: 'buy',
            qty: 5,
            limitPrice: 150,
            orderClass: 'simple',
        });
        expect(req).toMatchObject({
            type: 'limit',
            symbol: 'AAPL',
            side: 'buy',
            qty: '5',
            limitPrice: '150',
            orderClass: 'simple',
            timeInForce: 'day',
        });
    });
});

/** Captures the URL, method, and parsed JSON body of each request. */
function capturingFetch() {
    const calls: Array<{ url: string; method?: string; body: unknown }> = [];
    const fetchApi = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        let body: unknown;
        if (typeof init?.body === 'string') {
            try {
                body = JSON.parse(init.body);
            } catch {
                body = init.body;
            }
        }
        calls.push({ url: String(url), method: init?.method, body });
        return new Response(JSON.stringify({ id: 'order-1', status: 'accepted' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    return { calls, fetchApi: fetchApi as unknown as trading.FetchAPI };
}

describe('Alpaca client default retry policy', () => {
    /** A fetch that fails the first `failures` GET calls with `status`, then 200s. */
    function flakyGetFetch(failures: number, status: number) {
        let calls = 0;
        const fetchApi = (async () => {
            calls += 1;
            if (calls <= failures) {
                return new Response(JSON.stringify({ message: 'try later' }), {
                    status,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({ id: 'acct-1' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as trading.FetchAPI;
        return { fetchApi, getCalls: () => calls };
    }

    it('retries a transient 503 GET by default (3 attempts) without any retry config', async () => {
        const { fetchApi, getCalls } = flakyGetFetch(2, 503);
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false, retry: { retryDelayMs: 1 } });
        const acct = await alpaca.trading.account.getAccount();
        expect(acct).toMatchObject({ id: 'acct-1' });
        expect(getCalls()).toBe(3); // 1 initial + 2 retries
    });

    it('disables retries when retry: false', async () => {
        const { fetchApi, getCalls } = flakyGetFetch(2, 503);
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false, retry: false });
        await expect(alpaca.trading.account.getAccount()).rejects.toBeInstanceOf(trading.ApiError);
        expect(getCalls()).toBe(1);
    });

    it('caps the default policy at 3 attempts (1 initial + 2 retries)', async () => {
        const { fetchApi, getCalls } = flakyGetFetch(99, 503);
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false, retry: { retryDelayMs: 1 } });
        await expect(alpaca.trading.account.getAccount()).rejects.toBeInstanceOf(trading.ApiError);
        expect(getCalls()).toBe(3);
    });
});

describe('alpaca.trading.orders helper methods', () => {
    it('exposes the enhanced OrdersApi (instanceof generated OrdersApi)', () => {
        const alpaca = new Alpaca({ ...CREDS });
        expect(alpaca.trading.orders).toBeInstanceOf(OrdersApi);
        expect(alpaca.trading.orders).toBeInstanceOf(trading.OrdersApi);
    });

    it('market() POSTs the unwrapped, snake_cased order body', async () => {
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        await alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' });

        expect(calls).toHaveLength(1);
        expect(calls[0].method).toBe('POST');
        expect(calls[0].url).toContain('/v2/orders');
        expect(calls[0].body).toMatchObject({
            symbol: 'AAPL',
            qty: '1',
            side: 'buy',
            type: 'market',
            time_in_force: 'day',
        });
    });

    it('bracket() POSTs nested take_profit / stop_loss in snake_case', async () => {
        const { calls, fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        await alpaca.trading.orders.bracket({
            symbol: 'AAPL',
            qty: 10,
            side: 'buy',
            limitPrice: 150,
            takeProfit: { limitPrice: 155 },
            stopLoss: { stopPrice: 145, limitPrice: 144.5 },
        });

        expect(calls[0].body).toMatchObject({
            symbol: 'AAPL',
            qty: '10',
            side: 'buy',
            type: 'limit',
            limit_price: '150',
            order_class: 'bracket',
            take_profit: { limit_price: '155' },
            stop_loss: { stop_price: '145', limit_price: '144.5' },
        });
    });

    it('returns the deserialized Order', async () => {
        const { fetchApi } = capturingFetch();
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        const order = await alpaca.trading.orders.limit({ symbol: 'AAPL', qty: 1, side: 'buy', limitPrice: 150 });
        expect(order.status).toBe('accepted');
    });

    it('sends an Idempotency-Key header (preserving auth headers) when provided', async () => {
        let seen: RequestInit | undefined;
        const fetchApi = (async (_url: string | URL | Request, init?: RequestInit) => {
            seen = init;
            return new Response(JSON.stringify({ id: 'order-1', status: 'accepted' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as trading.FetchAPI;
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        await alpaca.trading.orders.market(
            { symbol: 'AAPL', qty: 1, side: 'buy' },
            { idempotencyKey: 'abc-123' },
        );

        const headers = seen?.headers as Record<string, string>;
        expect(headers['Idempotency-Key']).toBe('abc-123');
        // The idempotency override must merge, not clobber the auth headers.
        expect(headers['APCA-API-KEY-ID']).toBe('AKTEST');
        expect(headers['APCA-API-SECRET-KEY']).toBe('sekret');
    });

    it('omits the Idempotency-Key header when no key is given', async () => {
        let seen: RequestInit | undefined;
        const fetchApi = (async (_url: string | URL | Request, init?: RequestInit) => {
            seen = init;
            return new Response(JSON.stringify({ id: 'order-1', status: 'accepted' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as unknown as trading.FetchAPI;
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });
        await alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' });

        const headers = seen?.headers as Record<string, string>;
        expect(headers['Idempotency-Key']).toBeUndefined();
    });

    it('getAllOrders() joins a symbols[] and passes a typed side', async () => {
        let seenUrl = '';
        const fetchApi = (async (url: string | URL | Request) => {
            seenUrl = String(url);
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }) as unknown as trading.FetchAPI;
        const alpaca = new Alpaca({ ...CREDS, fetchApi, rateLimit: false });

        const orders = await alpaca.trading.orders.getAllOrders({ symbols: ['AAPL', 'MSFT'], side: 'buy', status: 'open' });
        expect(orders).toEqual([]);

        const decoded = decodeURIComponent(seenUrl);
        expect(decoded).toContain('symbols=AAPL,MSFT');
        expect(decoded).toContain('side=buy');
        expect(decoded).toContain('status=open');
    });
});
