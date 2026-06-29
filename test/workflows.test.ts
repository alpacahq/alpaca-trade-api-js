import { describe, expect, it } from 'vitest';

import { Alpaca } from '../src/client';
import * as streaming from '../src/streaming';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

/** Minimal fake satisfying WebSocketLike, with event injection. */
class FakeSocket {
    listeners: Record<string, Array<(...args: any[]) => void>> = {};
    closed = false;
    on(event: string, cb: (...args: any[]) => void): this {
        (this.listeners[event] ??= []).push(cb);
        return this;
    }
    emitEvent(event: string, ...args: any[]): void {
        (this.listeners[event] ?? []).forEach((cb) => cb(...args));
    }
    send(): void {}
    close(): void {
        this.closed = true;
        this.emitEvent('close');
    }
    terminate(): void {}
    ping(): void {}
}

/** Drive a trading socket to the authorized (ready) state. */
function authorizeTrading(sock: FakeSocket): void {
    sock.emitEvent('open');
    sock.emitEvent('message', JSON.stringify({ stream: 'authorization', data: { status: 'authorized' } }));
}

function tradeUpdateFrame(event: string, order: Record<string, unknown>): string {
    return JSON.stringify({ stream: 'trade_updates', data: { event, order } });
}

type Route = (method: string, url: string) => Response | undefined;

/** A tiny route-matching fetch stand-in for the REST calls under test. */
function routedFetch(route: Route): (url: string, init?: RequestInit) => Promise<Response> {
    return async (url, init) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        const res = route(method, String(url));
        if (!res) {
            throw new Error(`unexpected request: ${method} ${url}`);
        }
        return res;
    };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('MarketDataClient.getLatestPrice', () => {
    it('returns the latest trade price as a number', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'GET' && url.includes('/v2/stocks/AAPL/trades/latest')) {
                    return json({
                        symbol: 'AAPL',
                        trade: { c: [], i: 1, p: 150.25, s: 10, t: '2024-01-01T00:00:00Z', x: 'V', z: 'C' },
                    });
                }
                return undefined;
            }),
        });
        await expect(alpaca.marketData.getLatestPrice('AAPL')).resolves.toBe(150.25);
    });
});

describe('TradingClient.closeAllPositions', () => {
    it('delegates to deleteAllOpenPositions and returns the closures', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'DELETE' && url.includes('/v2/positions')) {
                    return json([{ symbol: 'AAPL', status: 200 }]);
                }
                return undefined;
            }),
        });
        const closed = await alpaca.trading.closeAllPositions({ cancelOrders: true });
        expect(closed).toHaveLength(1);
        expect(closed[0].symbol).toBe('AAPL');
    });
});

describe('TradingClient.submitAndWait', () => {
    function alpacaWithOrderFetch(order: Record<string, unknown>): Alpaca {
        return new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    return json(order);
                }
                return undefined;
            }),
        });
    }

    function readyStream(): { stream: streaming.TradingStream; sock: FakeSocket } {
        const sock = new FakeSocket();
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock as unknown as streaming.WebSocketLike,
        });
        stream.connect();
        authorizeTrading(sock);
        return { stream, sock };
    }

    it('resolves with the terminal order on a matching fill (buffered before placement)', async () => {
        const alpaca = alpacaWithOrderFetch({ id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'accepted' });
        const { stream, sock } = readyStream();

        const p = alpaca.trading.submitAndWait(
            { type: 'market', symbol: 'AAPL', qty: 1, side: 'buy' },
            { stream, timeoutMs: 1_000 },
        );
        // Arrives before the order id is known -> buffered, then replayed.
        sock.emitEvent(
            'message',
            tradeUpdateFrame('fill', { id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'filled', filled_avg_price: '150.00' }),
        );

        const order = await p;
        expect(order.status).toBe('filled');
        expect(order.clientOrderId).toBe('cid-1');
    });

    it('ignores updates for other orders', async () => {
        const alpaca = alpacaWithOrderFetch({ id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'accepted' });
        const { stream, sock } = readyStream();

        const p = alpaca.trading.submitAndWait(
            { type: 'market', symbol: 'AAPL', qty: 1, side: 'buy' },
            { stream, timeoutMs: 50 },
        );
        // A fill for a different order must not resolve our promise.
        sock.emitEvent('message', tradeUpdateFrame('fill', { id: 'other', client_order_id: 'someone-else', status: 'filled' }));
        await expect(p).rejects.toThrow(/timed out/);
    });

    it('rejects on a stream error', async () => {
        const alpaca = alpacaWithOrderFetch({ id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'accepted' });
        const { stream, sock } = readyStream();

        const p = alpaca.trading.submitAndWait(
            { type: 'market', symbol: 'AAPL', qty: 1, side: 'buy' },
            { stream },
        );
        sock.emitEvent('error', new Error('socket exploded'));
        await expect(p).rejects.toThrow(/socket exploded/);
    });

    it('rejects when the order placement itself fails', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    return json({ code: 40010001, message: 'insufficient buying power' }, 403);
                }
                return undefined;
            }),
        });
        const { stream } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { type: 'market', symbol: 'AAPL', qty: 1, side: 'buy' },
            { stream },
        );
        await expect(p).rejects.toBeTruthy();
    });
});
