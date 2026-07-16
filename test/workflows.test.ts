import { afterEach, describe, expect, it, vi } from 'vitest';

import { Alpaca } from '../src/client';
import * as streaming from '../src/streaming';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/** Minimal fake satisfying WebSocketLike, with event injection. */
class FakeSocket {
    listeners: Record<string, Array<(...args: any[]) => void>> = {};
    closed = false;
    sent: string[] = [];
    on(event: string, cb: (...args: any[]) => void): this {
        (this.listeners[event] ??= []).push(cb);
        return this;
    }
    emitEvent(event: string, ...args: any[]): void {
        (this.listeners[event] ?? []).forEach((cb) => cb(...args));
    }
    send(data: string | Uint8Array): void {
        this.sent.push(String(data));
    }
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

function acknowledgeTradeUpdates(sock: FakeSocket): void {
    sock.emitEvent('message', JSON.stringify({ stream: 'listening', data: { streams: ['trade_updates'] } }));
}

function tradeUpdateFrame(event: string, order: Record<string, unknown>): string {
    return JSON.stringify({ stream: 'trade_updates', data: { event, order } });
}

type Route = (method: string, url: string, init?: RequestInit) => Response | Promise<Response> | undefined;

/** A tiny route-matching fetch stand-in for the REST calls under test. */
function routedFetch(route: Route): (url: string, init?: RequestInit) => Promise<Response> {
    return async (url, init) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        const res = await route(method, String(url), init);
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

function expectReconciliationQuery(url: string, clientOrderId: string): void {
    expect(new URL(url).searchParams.getAll('client_order_id')).toEqual([clientOrderId]);
}

async function waitUntil(predicate: () => boolean, timeoutMs = 250): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() >= deadline) throw new Error('condition was not met before test deadline');
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

async function flushAsyncContinuations(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function pendingUntilAborted(
    init: RequestInit | undefined,
    onAbort: (signal: AbortSignal) => void,
): Promise<Response> {
    return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        const abort = (): void => {
            onAbort(signal);
            reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
        };
        if (signal.aborted) {
            abort();
        } else {
            signal.addEventListener('abort', abort, { once: true });
        }
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

describe('TradingClient.validateConnection', () => {
    it('returns ok with the account when credentials work', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'GET' && url.includes('/v2/account')) {
                    return json({ id: 'acct-1', status: 'ACTIVE' });
                }
                return undefined;
            }),
        });
        const check = await alpaca.trading.validateConnection();
        expect(check.ok).toBe(true);
        if (check.ok) expect(check.account.id).toBe('acct-1');
    });

    it('returns ok:false with the status/code on an auth failure (no throw)', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: routedFetch((method, url) => {
                if (method === 'GET' && url.includes('/v2/account')) {
                    return json({ code: 40110000, message: 'access key verification failed' }, 401);
                }
                return undefined;
            }),
        });
        const check = await alpaca.trading.validateConnection();
        expect(check.ok).toBe(false);
        if (!check.ok) {
            expect(check.status).toBe(401);
            expect(check.code).toBe(40110000);
            expect(check.message).toContain('verification failed');
        }
    });

    it('returns ok:false with a message on a network error (no throw)', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: async () => {
                throw new Error('network down');
            },
        });
        const check = await alpaca.trading.validateConnection();
        expect(check).toEqual({ ok: false, message: 'network down' });
    });
});

describe('TradingClient.submitAndWait', () => {
    const input = { type: 'market', symbol: 'AAPL', qty: 1, side: 'buy' } as const;

    function alpacaWithOrderFetch(
        order: Record<string, unknown>,
        inspect?: (init?: RequestInit) => void,
    ): Alpaca {
        return new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    inspect?.(init);
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

    it('does not POST before the listening acknowledgement, then one acknowledgement places once', async () => {
        let posts = 0;
        const alpaca = alpacaWithOrderFetch(
            { id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'accepted' },
            () => posts++,
        );
        const { stream, sock } = readyStream();

        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-1' },
            { stream, timeoutMs: 1_000 },
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(posts).toBe(0);

        acknowledgeTradeUpdates(sock);
        await waitUntil(() => posts === 1);
        sock.emitEvent(
            'message',
            tradeUpdateFrame('fill', { id: 'oid-1', client_order_id: 'cid-1', symbol: 'AAPL', status: 'filled', filled_avg_price: '150.00' }),
        );

        const order = await p;
        expect(posts).toBe(1);
        expect(order.status).toBe('filled');
        expect(order.clientOrderId).toBe('cid-1');
    });

    it('never POSTs again after a real reconnect listening acknowledgement', async () => {
        vi.useFakeTimers();
        let posts = 0;
        let markPostStarted!: () => void;
        const postStarted = new Promise<void>((resolve) => {
            markPostStarted = resolve;
        });
        const alpaca = alpacaWithOrderFetch(
            { id: 'oid-1', client_order_id: 'cid-reconnect', status: 'accepted' },
            () => {
                posts++;
                markPostStarted();
            },
        );
        const sockets: FakeSocket[] = [];
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            initialReconnectMs: 0,
            maxReconnectMs: 0,
            reconnectJitter: 0,
            wsFactory: () => {
                const socket = new FakeSocket();
                sockets.push(socket);
                return socket as unknown as streaming.WebSocketLike;
            },
        });
        stream.connect();
        const first = sockets[0];
        authorizeTrading(first);

        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-reconnect' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(first);
        await postStarted;
        expect(posts).toBe(1);

        first.close();
        await vi.advanceTimersByTimeAsync(0);
        expect(sockets).toHaveLength(2);

        const replacement = sockets[1];
        authorizeTrading(replacement);
        acknowledgeTradeUpdates(replacement);
        await flushAsyncContinuations();
        expect(posts).toBe(1);

        replacement.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-1',
            client_order_id: 'cid-reconnect',
            status: 'filled',
        }));
        await expect(p).resolves.toMatchObject({ id: 'oid-1', status: 'filled' });
        expect(posts).toBe(1);
        expect(stream.listenerCount(streaming.EVENT.SUBSCRIPTION)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.TRADE_UPDATE)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.CLIENT_ERROR)).toBe(0);

        stream.disconnect();
        expect(replacement.closed).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores terminal updates for other orders', async () => {
        const alpaca = alpacaWithOrderFetch({
            id: 'oid-mine',
            client_order_id: 'cid-mine',
            status: 'accepted',
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-mine' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-other',
            client_order_id: 'cid-other',
            status: 'filled',
        }));

        await expect(p).rejects.toThrow(/cid-mine.*waiting for a terminal update/i);
    });

    it('preserves an explicit clientOrderId and never mutates caller input', async () => {
        let body: Record<string, unknown> | undefined;
        const alpaca = alpacaWithOrderFetch(
            { id: 'oid-explicit', client_order_id: 'caller-id', status: 'accepted' },
            (init) => {
                body = JSON.parse(String(init?.body));
            },
        );
        const { stream, sock } = readyStream();
        const callerInput = Object.freeze({ ...input, clientOrderId: 'caller-id' });
        const p = alpaca.trading.submitAndWait(
            callerInput,
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => body !== undefined);
        expect(body?.client_order_id).toBe('caller-id');
        expect(callerInput).toEqual({ ...input, clientOrderId: 'caller-id' });

        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-explicit',
            client_order_id: 'caller-id',
            status: 'filled',
        }));
        await p;
    });

    it('generates a missing clientOrderId exactly once and sends the copied input', async () => {
        const generated = '11111111-1111-4111-8111-111111111111';
        const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generated);
        let body: Record<string, unknown> | undefined;
        const alpaca = alpacaWithOrderFetch(
            { id: 'oid-generated', client_order_id: generated, status: 'accepted' },
            (init) => {
                body = JSON.parse(String(init?.body));
            },
        );
        const { stream, sock } = readyStream();
        const callerInput = { ...input };
        const p = alpaca.trading.submitAndWait(callerInput, { stream, timeoutMs: 1_000 });
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => body !== undefined);

        expect(randomUUID).toHaveBeenCalledTimes(1);
        expect(body?.client_order_id).toBe(generated);
        expect(callerInput).toEqual(input);

        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-generated',
            client_order_id: generated,
            status: 'filled',
        }));
        await p;
    });

    it('resolves a matching terminal update while the POST response is pending', async () => {
        let releasePost!: (response: Response) => void;
        const postResponse = new Promise<Response>((resolve) => {
            releasePost = resolve;
        });
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) return postResponse;
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-pending' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-pending',
            client_order_id: 'cid-pending',
            status: 'filled',
        }));

        let resolvedBeforePost = false;
        void p.then(() => {
            resolvedBeforePost = true;
        });
        await flushAsyncContinuations();
        const observedBeforePost = resolvedBeforePost;
        releasePost(json({ id: 'oid-pending', client_order_id: 'cid-pending', status: 'accepted' }));
        await p;
        expect(observedBeforePost).toBe(true);
    });

    it('cleans up immediately when external subscription setup throws synchronously', async () => {
        vi.useFakeTimers();
        const alpaca = alpacaWithOrderFetch({ id: 'never-placed' });
        const { stream } = readyStream();
        vi.spyOn(stream, 'subscribeTradeUpdates').mockImplementation(() => {
            throw new Error('subscribe setup exploded');
        });
        const disconnect = vi.spyOn(stream, 'disconnect');

        await expect(alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-subscribe-throw' },
            { stream, timeoutMs: 1_000 },
        )).rejects.toThrow(/subscribe setup exploded/);

        expect(disconnect).not.toHaveBeenCalled();
        expect(stream.listenerCount(streaming.EVENT.SUBSCRIPTION)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.TRADE_UPDATE)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.CLIENT_ERROR)).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cleans up an owned stream immediately when connect setup throws synchronously', async () => {
        vi.useFakeTimers();
        const alpaca = alpacaWithOrderFetch({ id: 'never-placed' });
        const owned = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike,
        });
        vi.spyOn(alpaca.trading, 'stream').mockReturnValue(owned);
        vi.spyOn(owned, 'connect').mockImplementation(() => {
            throw new Error('connect setup exploded');
        });
        const disconnect = vi.spyOn(owned, 'disconnect');

        await expect(alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-connect-throw' },
            { timeoutMs: 1_000 },
        )).rejects.toThrow(/connect setup exploded/);

        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(owned.listenerCount(streaming.EVENT.SUBSCRIPTION)).toBe(0);
        expect(owned.listenerCount(streaming.EVENT.TRADE_UPDATE)).toBe(0);
        expect(owned.listenerCount(streaming.EVENT.CLIENT_ERROR)).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts an in-flight POST when the workflow deadline expires', async () => {
        let postAborted = false;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    return pendingUntilAborted(init, () => {
                        postAborted = true;
                    });
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-post-abort' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);

        await expect(p).rejects.toThrow(/cid-post-abort.*placement outcome is ambiguous/i);
        await waitUntil(() => postAborted);
        await flushAsyncContinuations();
    });

    it('keeps terminal settlement when the pending POST later rejects', async () => {
        let postSignal: AbortSignal | null | undefined;
        let postStarted = false;
        let rejectPost!: (reason: Error) => void;
        const postResponse = new Promise<Response>((_resolve, reject) => {
            rejectPost = reject;
        });
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    postStarted = true;
                    postSignal = init?.signal;
                    return postResponse;
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-post-race' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => postStarted);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-post-race',
            client_order_id: 'cid-post-race',
            status: 'filled',
        }));

        await expect(p).resolves.toMatchObject({ id: 'oid-post-race', status: 'filled' });
        rejectPost(new Error('late POST rejection'));
        await flushAsyncContinuations();
        expect(postSignal?.aborted).toBe(true);
    });

    it('reconciles one FetchError by client ID without a second POST', async () => {
        let posts = 0;
        let gets = 0;
        let submittedClientOrderId: string | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    posts++;
                    submittedClientOrderId = JSON.parse(String(init?.body)).client_order_id;
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    gets++;
                    expectReconciliationQuery(url, 'cid-reconcile');
                    expectReconciliationQuery(url, submittedClientOrderId as string);
                    return json({ id: 'oid-reconciled', client_order_id: 'cid-reconcile', status: 'filled' });
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-reconcile' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);

        const order = await p;
        expect(order.status).toBe('filled');
        expect(posts).toBe(1);
        expect(gets).toBe(1);
    });

    it('reconciles a generated client ID exactly once and continues waiting after a 404', async () => {
        const generated = '22222222-2222-4222-8222-222222222222';
        const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generated);
        let posts = 0;
        let gets = 0;
        let submittedClientOrderId: string | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    posts++;
                    submittedClientOrderId = JSON.parse(String(init?.body)).client_order_id;
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    gets++;
                    expectReconciliationQuery(url, generated);
                    expectReconciliationQuery(url, submittedClientOrderId as string);
                    return json({ code: 40410000, message: 'order not found' }, 404);
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            input,
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => gets === 1);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-late',
            client_order_id: generated,
            status: 'filled',
        }));

        await expect(p).resolves.toMatchObject({ id: 'oid-late', status: 'filled' });
        expect(randomUUID).toHaveBeenCalledTimes(1);
        expect(submittedClientOrderId).toBe(generated);
        expect(posts).toBe(1);
        expect(gets).toBe(1);
    });

    it('keeps terminal settlement when an in-flight reconciliation later rejects', async () => {
        let postSignal: AbortSignal | null | undefined;
        let getSignal: AbortSignal | null | undefined;
        let getStarted = false;
        let rejectGet!: (reason: Error) => void;
        const getResponse = new Promise<Response>((_resolve, reject) => {
            rejectGet = reject;
        });
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    postSignal = init?.signal;
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    getStarted = true;
                    getSignal = init?.signal;
                    expectReconciliationQuery(url, 'cid-get-race');
                    return getResponse;
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-get-race' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => getStarted);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-get-race',
            client_order_id: 'cid-get-race',
            status: 'filled',
        }));

        await expect(p).resolves.toMatchObject({ id: 'oid-get-race', status: 'filled' });
        rejectGet(new Error('late reconciliation rejection'));
        await flushAsyncContinuations();
        expect(postSignal).toBe(getSignal);
        expect(getSignal?.aborted).toBe(true);
    });

    it('aborts an in-flight reconciliation GET when the workflow deadline expires', async () => {
        let getAborted = false;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    expectReconciliationQuery(url, 'cid-get-abort');
                    return pendingUntilAborted(init, () => {
                        getAborted = true;
                    });
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-get-abort' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);

        await expect(p).rejects.toThrow(/cid-get-abort.*placement outcome is ambiguous/i);
        await waitUntil(() => getAborted);
        await flushAsyncContinuations();
    });

    it('cancels reconciliation retry backoff at the workflow deadline without a delayed second GET', async () => {
        vi.useFakeTimers();
        let gets = 0;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            retry: { maxRetries: 1, retryDelayMs: 60_000 },
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    gets++;
                    expectReconciliationQuery(url, 'cid-backoff-timeout');
                    return json({ code: 50310000, message: 'temporarily unavailable' }, 503);
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-backoff-timeout' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);
        await vi.advanceTimersByTimeAsync(0);
        expect(gets).toBe(1);

        const errorPromise = p.catch((error) => error);
        await vi.advanceTimersByTimeAsync(20);
        const error = await errorPromise;
        expect(error.constructor.name).toBe('SubmitAndWaitError');
        expect(error).toMatchObject({
            clientOrderId: 'cid-backoff-timeout',
            phase: 'reconciliation',
            placementAmbiguous: true,
            cause: { name: 'TimeoutError' },
        });
        expect(error.message).toMatch(/cid-backoff-timeout.*reconcil/i);
        expect(gets).toBe(1);
        expect(vi.getTimerCount()).toBe(0);

        await vi.advanceTimersByTimeAsync(60_000);
        await flushAsyncContinuations();
        expect(gets).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('honors custom terminal events when reconciliation finds the order', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    expectReconciliationQuery(url, 'cid-custom-terminal');
                    return json({
                        id: 'oid-custom-terminal',
                        client_order_id: 'cid-custom-terminal',
                        status: 'partially_filled',
                    });
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-custom-terminal' },
            { stream, timeoutMs: 1_000, terminalEvents: ['partial_fill'] },
        );
        acknowledgeTradeUpdates(sock);

        await expect(p).resolves.toMatchObject({
            id: 'oid-custom-terminal',
            status: 'partially_filled',
        });
    });

    it('rejects a definite placement ApiError without reconciliation', async () => {
        let posts = 0;
        let gets = 0;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    posts++;
                    return json({ code: 40010001, message: 'insufficient buying power' }, 403);
                }
                if (method === 'GET') gets++;
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-definite' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        await expect(p).rejects.toMatchObject({ status: 403 });
        expect(posts).toBe(1);
        expect(gets).toBe(0);
    });

    it('wraps a non-404 reconciliation failure with the client ID and original cause', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: false,
            fetchApi: routedFetch((method, url) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    throw new Error('connection reset after write');
                }
                if (method === 'GET' && url.includes('/v2/orders:by_client_order_id')) {
                    return json({ code: 50310000, message: 'reconciliation unavailable' }, 503);
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-reconcile-failed' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);

        const error = await p.catch((cause) => cause);
        expect(error.constructor.name).toBe('SubmitAndWaitError');
        expect(error).toMatchObject({
            clientOrderId: 'cid-reconcile-failed',
            phase: 'reconciliation',
            placementAmbiguous: true,
            cause: {
                name: 'ApiError',
                status: 503,
                message: 'reconciliation unavailable',
            },
        });
        expect(error.message).toMatch(/cid-reconcile-failed.*reconcil/i);
    });

    it('times out stalled connection/auth/subscription from call start with the client ID', async () => {
        const alpaca = alpacaWithOrderFetch({ id: 'never-placed' });
        const sock = new FakeSocket();
        const owned = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock as unknown as streaming.WebSocketLike,
        });
        vi.spyOn(alpaca.trading, 'stream').mockReturnValue(owned);

        await expect(alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-stalled' },
            { timeoutMs: 20 },
        )).rejects.toThrow(/cid-stalled.*before order placement/i);
        expect(sock.closed).toBe(true);
    });

    it('distinguishes an ambiguous placement deadline from waiting for a terminal update', async () => {
        let postAborted = false;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    return pendingUntilAborted(init, () => {
                        postAborted = true;
                    });
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-ambiguous' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);

        const error = await p.catch((cause) => cause);
        expect(error.constructor.name).toBe('SubmitAndWaitError');
        expect(error).toMatchObject({
            clientOrderId: 'cid-ambiguous',
            phase: 'placement',
            placementAmbiguous: true,
            cause: { name: 'TimeoutError' },
        });
        expect(error.message).toMatch(/cid-ambiguous.*placement outcome is ambiguous/i);
        await waitUntil(() => postAborted);
        await flushAsyncContinuations();
    });

    it('reports a terminal-update deadline with the client ID', async () => {
        const alpaca = alpacaWithOrderFetch({
            id: 'oid-waiting',
            client_order_id: 'cid-waiting',
            status: 'accepted',
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-waiting' },
            { stream, timeoutMs: 20 },
        );
        acknowledgeTradeUpdates(sock);

        const error = await p.catch((cause) => cause);
        expect(error).toMatchObject({
            clientOrderId: 'cid-waiting',
            orderId: 'oid-waiting',
            phase: 'terminal',
            placementAmbiguous: false,
            cause: { name: 'TimeoutError' },
        });
        expect(error.message).toMatch(/cid-waiting.*waiting for a terminal update/i);
    });

    it('leaves an external stream open and removes its workflow listeners', async () => {
        const alpaca = alpacaWithOrderFetch({
            id: 'oid-external',
            client_order_id: 'cid-external',
            status: 'accepted',
        });
        const { stream, sock } = readyStream();
        const connect = vi.spyOn(stream, 'connect');
        const disconnect = vi.spyOn(stream, 'disconnect');
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-external' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-external',
            client_order_id: 'cid-external',
            status: 'filled',
        }));
        await p;

        expect(connect).not.toHaveBeenCalled();
        expect(disconnect).not.toHaveBeenCalled();
        expect(sock.closed).toBe(false);
        expect(stream.listenerCount(streaming.EVENT.SUBSCRIPTION)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.TRADE_UPDATE)).toBe(0);
        expect(stream.listenerCount(streaming.EVENT.CLIENT_ERROR)).toBe(0);
    });

    it('connects and closes an owned stream on settlement', async () => {
        const alpaca = alpacaWithOrderFetch({
            id: 'oid-owned',
            client_order_id: 'cid-owned',
            status: 'accepted',
        });
        const sock = new FakeSocket();
        const owned = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock as unknown as streaming.WebSocketLike,
        });
        vi.spyOn(alpaca.trading, 'stream').mockReturnValue(owned);

        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-owned' },
            { timeoutMs: 1_000 },
        );
        authorizeTrading(sock);
        acknowledgeTradeUpdates(sock);
        sock.emitEvent('message', tradeUpdateFrame('fill', {
            id: 'oid-owned',
            client_order_id: 'cid-owned',
            status: 'filled',
        }));
        await p;
        expect(sock.closed).toBe(true);
    });

    it('rejects on a stream error after subscribing', async () => {
        const alpaca = alpacaWithOrderFetch({
            id: 'oid-error',
            client_order_id: 'cid-error',
            status: 'accepted',
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(
            { ...input, clientOrderId: 'cid-error' },
            { stream, timeoutMs: 1_000 },
        );
        acknowledgeTradeUpdates(sock);
        sock.emitEvent('error', new Error('socket exploded'));
        await expect(p).rejects.toThrow(/socket exploded/);
    });

    it('preserves generated client and confirmed order IDs on a terminal-phase stream error', async () => {
        const generated = '44444444-4444-4444-8444-444444444444';
        vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generated);
        let submittedBody: Record<string, unknown> | undefined;
        const alpaca = alpacaWithOrderFetch(
            {
                id: 'oid-confirmed-stream-error',
                client_order_id: generated,
                status: 'accepted',
            },
            (init) => {
                submittedBody = JSON.parse(String(init?.body));
            },
        );
        const postOrder = vi.spyOn(alpaca.trading.orders, 'postOrder');
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(input, { stream, timeoutMs: 1_000 });
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => postOrder.mock.results.length === 1);
        await postOrder.mock.results[0].value;
        await flushAsyncContinuations();
        sock.emitEvent('error', new Error('socket exploded after confirmation'));

        const error = await p.catch((cause) => cause);
        expect(submittedBody?.client_order_id).toBe(generated);
        expect(error.constructor.name).toBe('SubmitAndWaitError');
        expect(error).toMatchObject({
            clientOrderId: generated,
            orderId: 'oid-confirmed-stream-error',
            phase: 'terminal',
            placementAmbiguous: false,
            cause: { message: 'trading stream error: socket exploded after confirmation' },
        });
        expect(error.message).toMatch(/oid-confirmed-stream-error.*monitor/i);
        expect(error.message).toContain('socket exploded after confirmation');
    });

    it('exposes a generated client ID when the stream fails after placement starts', async () => {
        const generated = '33333333-3333-4333-8333-333333333333';
        vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generated);
        let postStarted = false;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            timeoutMs: 0,
            fetchApi: routedFetch((method, url, init) => {
                if (method === 'POST' && url.includes('/v2/orders')) {
                    postStarted = true;
                    return pendingUntilAborted(init, () => {});
                }
                return undefined;
            }),
        });
        const { stream, sock } = readyStream();
        const p = alpaca.trading.submitAndWait(input, { stream, timeoutMs: 1_000 });
        acknowledgeTradeUpdates(sock);
        await waitUntil(() => postStarted);
        sock.emitEvent('error', new Error('socket exploded after placement'));

        const error = await p.catch((cause) => cause);
        expect(error.constructor.name).toBe('SubmitAndWaitError');
        expect(error).toMatchObject({
            clientOrderId: generated,
            phase: 'placement',
            placementAmbiguous: true,
            cause: { message: 'trading stream error: socket exploded after placement' },
        });
        expect(error.message).toMatch(/33333333-3333-4333-8333-333333333333.*reconcil/i);
        await flushAsyncContinuations();
    });
});
