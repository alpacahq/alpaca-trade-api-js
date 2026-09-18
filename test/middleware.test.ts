import { describe, expect, it, vi } from 'vitest';

import { loggingMiddleware, metricsMiddleware, type RequestMetric } from '../src/middleware';
import { Alpaca } from '../src/client';
import type * as trading from '../src/trading';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

function fetchReturning(body: unknown, status = 200): trading.FetchAPI {
    return (async () =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })) as unknown as trading.FetchAPI;
}

function fetchThrowing(error: Error): trading.FetchAPI {
    return (async () => {
        throw error;
    }) as unknown as trading.FetchAPI;
}

function requestIdOf(init: RequestInit | undefined): string | undefined {
    return new Headers(init?.headers).get('X-Request-ID') ?? undefined;
}

describe('metricsMiddleware', () => {
    it('emits a metric for a successful request', async () => {
        const metrics: RequestMetric[] = [];
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' }),
            middleware: [metricsMiddleware({ onRequest: (m) => metrics.push(m) })],
        });

        await alpaca.trading.account.getAccount();

        expect(metrics).toHaveLength(1);
        expect(metrics[0]).toMatchObject({ method: 'GET', status: 200, ok: true });
        expect(metrics[0].url).toContain('/v2/account');
        expect(metrics[0].requestId).toBeTruthy();
        expect(metrics[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('emits a failure metric on a network error', async () => {
        const metrics: RequestMetric[] = [];
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: false, // observe a single failed attempt, not the default retries
            fetchApi: fetchThrowing(new Error('boom')),
            middleware: [metricsMiddleware({ onRequest: (m) => metrics.push(m) })],
        });

        await expect(alpaca.trading.account.getAccount()).rejects.toMatchObject({ name: 'FetchError' });
        expect(metrics).toHaveLength(1);
        expect(metrics[0]).toMatchObject({ ok: false, status: undefined });
        expect(metrics[0].error).toBeInstanceOf(Error);
    });

    it('does not reject an accepted order when the metric sink throws', async () => {
        let metrics = 0;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'order-1', status: 'accepted' }),
            middleware: [
                metricsMiddleware({
                    onRequest: () => {
                        metrics++;
                        throw new Error('metrics backend unavailable');
                    },
                }),
            ],
        });

        await expect(
            alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' }),
        ).resolves.toMatchObject({ id: 'order-1', status: 'accepted' });
        expect(metrics).toBe(1);
    });

    it('consumes a rejected promise returned by the metric sink', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'order-1', status: 'accepted' }),
            middleware: [
                metricsMiddleware({
                    onRequest: async () => {
                        throw new Error('async metrics backend unavailable');
                    },
                }),
            ],
        });

        await expect(
            alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' }),
        ).resolves.toMatchObject({ id: 'order-1', status: 'accepted' });
        await Promise.resolve();
    });

    it('preserves the original network failure when the metric sink throws', async () => {
        const networkError = new Error('connection reset');
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: false,
            fetchApi: fetchThrowing(networkError),
            middleware: [
                metricsMiddleware({
                    onRequest: () => {
                        throw new Error('metrics backend unavailable');
                    },
                }),
            ],
        });

        await expect(alpaca.trading.account.getAccount()).rejects.toMatchObject({
            name: 'FetchError',
            cause: networkError,
        });
    });

    it('falls back to an internal request id when the custom generator throws', async () => {
        const metrics: RequestMetric[] = [];
        let seen: RequestInit | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: (async (url, init) => {
                seen = init;
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [
                metricsMiddleware({
                    genRequestId: () => {
                        throw new Error('id generator unavailable');
                    },
                    onRequest: (metric) => metrics.push(metric),
                }),
            ],
        });

        await alpaca.trading.account.getAccount();

        expect(metrics).toHaveLength(1);
        expect(metrics[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(requestIdOf(seen)).toBe(metrics[0].requestId);
    });

    it('falls back to a UUID when the custom generator returns a non-UUID', async () => {
        let seen: RequestInit | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: (async (url, init) => {
                seen = init;
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [
                metricsMiddleware({
                    genRequestId: () => 'local-correlation-id',
                    onRequest: () => {},
                }),
            ],
        });

        await alpaca.trading.account.getAccount();

        expect(requestIdOf(seen)).toMatch(/^[0-9a-f-]{36}$/i);
        expect(requestIdOf(seen)).not.toBe('local-correlation-id');
    });

    it('sends a valid custom UUID as X-Request-ID', async () => {
        const requestId = '550e8400-e29b-41d4-a716-446655440000';
        const metrics: RequestMetric[] = [];
        let seen: RequestInit | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: (async (url, init) => {
                seen = init;
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [
                metricsMiddleware({
                    genRequestId: () => requestId,
                    onRequest: (metric) => metrics.push(metric),
                }),
            ],
        });

        await alpaca.trading.account.getAccount();

        expect(requestIdOf(seen)).toBe(requestId);
        expect(metrics[0].requestId).toBe(requestId);
    });

    it('preserves a valid caller-supplied X-Request-ID', async () => {
        const requestId = '550e8400-e29b-41d4-a716-446655440001';
        const generate = vi.fn(() => '550e8400-e29b-41d4-a716-446655440002');
        const metrics: RequestMetric[] = [];
        let seen: RequestInit | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            headers: { 'x-request-id': requestId },
            fetchApi: (async (url, init) => {
                seen = init;
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [
                metricsMiddleware({
                    genRequestId: generate,
                    onRequest: (metric) => metrics.push(metric),
                }),
            ],
        });

        await alpaca.trading.account.getAccount();

        expect(requestIdOf(seen)).toBe(requestId);
        expect(metrics[0].requestId).toBe(requestId);
        expect(generate).not.toHaveBeenCalled();
    });

    it('replaces an invalid caller-supplied X-Request-ID', async () => {
        const requestId = '550e8400-e29b-41d4-a716-446655440002';
        let seen: RequestInit | undefined;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            headers: { 'X-Request-ID': 'not-a-uuid' },
            fetchApi: (async (url, init) => {
                seen = init;
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [
                metricsMiddleware({
                    genRequestId: () => requestId,
                    onRequest: () => {},
                }),
            ],
        });

        await alpaca.trading.account.getAccount();

        expect(requestIdOf(seen)).toBe(requestId);
    });

    it.each([
        ['frozen object', Object.freeze({ 'X-Trace': 'frozen' })],
        ['Headers', new Headers({ 'X-Trace': 'headers' })],
        ['tuple array', [['X-Trace', 'tuples']] as [string, string][]],
    ])('copies reusable %s headers before stamping a per-request UUID', async (_name, headers) => {
        const ids: string[] = [];
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: (async (url, init) => {
                ids.push(requestIdOf(init) ?? '');
                return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
            }) as trading.FetchAPI,
            middleware: [metricsMiddleware({ onRequest: () => {} })],
        });

        await alpaca.trading.account.getAccount({ headers });
        await alpaca.trading.account.getAccount({ headers });

        expect(ids).toHaveLength(2);
        expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/i);
        expect(ids[1]).toMatch(/^[0-9a-f-]{36}$/i);
        expect(ids[0]).not.toBe(ids[1]);
        expect(new Headers(headers).has('X-Request-ID')).toBe(false);
    });

    it('generates a valid fallback UUID when crypto.randomUUID fails', async () => {
        const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
            throw new Error('randomUUID unavailable');
        });
        try {
            let seen: RequestInit | undefined;
            const alpaca = new Alpaca({
                ...CREDS,
                rateLimit: false,
                fetchApi: (async (url, init) => {
                    seen = init;
                    return fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' })(url, init);
                }) as trading.FetchAPI,
                middleware: [metricsMiddleware({ onRequest: () => {} })],
            });

            await alpaca.trading.account.getAccount();

            expect(requestIdOf(seen)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        } finally {
            randomUUID.mockRestore();
        }
    });

    it('shares one UUID across middleware, retries, and an echoed ApiError', async () => {
        const requestId = '550e8400-e29b-41d4-a716-446655440003';
        const generate = vi.fn(() => requestId);
        const outboundIds: string[] = [];
        const metrics: RequestMetric[] = [];
        let calls = 0;
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: { maxRetries: 1, retryDelayMs: 1 },
            fetchApi: (async (_url, init) => {
                calls++;
                const outboundId = requestIdOf(init) ?? '';
                outboundIds.push(outboundId);
                return new Response(
                    JSON.stringify({ code: 50010000, message: 'unavailable' }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', 'X-Request-ID': outboundId },
                    },
                );
            }) as trading.FetchAPI,
            middleware: [
                loggingMiddleware({ logger: {}, genRequestId: generate }),
                metricsMiddleware({
                    genRequestId: () => '550e8400-e29b-41d4-a716-446655440004',
                    onRequest: (metric) => metrics.push(metric),
                }),
            ],
        });

        await expect(alpaca.trading.account.getAccount()).rejects.toMatchObject({
            requestId,
        });

        expect(calls).toBe(2);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(outboundIds).toEqual([requestId, requestId]);
        expect(metrics.map((metric) => metric.requestId)).toEqual([requestId, requestId]);
    });
});

describe('loggingMiddleware', () => {
    it('logs a success line with status and duration', async () => {
        const lines: Array<{ message: string; meta?: Record<string, unknown> }> = [];
        const logger = { info: (message: string, meta?: Record<string, unknown>) => lines.push({ message, meta }) };
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' }),
            middleware: [loggingMiddleware({ logger })],
        });

        await alpaca.trading.account.getAccount();

        expect(lines).toHaveLength(1);
        expect(lines[0].meta).toMatchObject({ method: 'GET', status: 200 });
        expect(lines[0].meta?.requestId).toBeTruthy();
    });

    it('redacts secret headers when logHeaders is enabled', async () => {
        const lines: Array<Record<string, unknown> | undefined> = [];
        const logger = { info: (_message: string, meta?: Record<string, unknown>) => lines.push(meta) };
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'acct-1', account_number: 'PA1', status: 'ACTIVE' }),
            middleware: [loggingMiddleware({ logger, logHeaders: true })],
        });

        await alpaca.trading.account.getAccount();

        const headers = lines[0]?.headers as Record<string, string>;
        const values = Object.values(headers);
        expect(values).not.toContain('sekret'); // secret never logged in the clear
        expect(values).toContain('[redacted]');
    });

    it('logs an error line on a network failure', async () => {
        const errors: Array<Record<string, unknown> | undefined> = [];
        const logger = { error: (_message: string, meta?: Record<string, unknown>) => errors.push(meta) };
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: false, // observe a single failed attempt, not the default retries
            fetchApi: fetchThrowing(new Error('kaboom')),
            middleware: [loggingMiddleware({ logger })],
        });

        await expect(alpaca.trading.account.getAccount()).rejects.toBeTruthy();
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ method: 'GET', error: 'kaboom' });
    });

    it('does not reject an accepted order when the logger throws', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'order-1', status: 'accepted' }),
            middleware: [
                loggingMiddleware({
                    logger: {
                        info: () => {
                            throw new Error('logger unavailable');
                        },
                    },
                }),
            ],
        });

        await expect(
            alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' }),
        ).resolves.toMatchObject({ id: 'order-1', status: 'accepted' });
    });

    it('consumes a rejected promise returned by the logger', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            fetchApi: fetchReturning({ id: 'order-1', status: 'accepted' }),
            middleware: [
                loggingMiddleware({
                    logger: {
                        info: async () => {
                            throw new Error('async logger unavailable');
                        },
                    },
                }),
            ],
        });

        await expect(
            alpaca.trading.orders.market({ symbol: 'AAPL', qty: 1, side: 'buy' }),
        ).resolves.toMatchObject({ id: 'order-1', status: 'accepted' });
        await Promise.resolve();
    });

    it('preserves the original network failure when the error logger throws', async () => {
        const networkError = new Error('connection reset');
        const alpaca = new Alpaca({
            ...CREDS,
            rateLimit: false,
            retry: false,
            fetchApi: fetchThrowing(networkError),
            middleware: [
                loggingMiddleware({
                    logger: {
                        error: () => {
                            throw new Error('logger unavailable');
                        },
                    },
                }),
            ],
        });

        await expect(alpaca.trading.account.getAccount()).rejects.toMatchObject({
            name: 'FetchError',
            cause: networkError,
        });
    });
});
