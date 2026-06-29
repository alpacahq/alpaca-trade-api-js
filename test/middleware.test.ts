import { describe, expect, it } from 'vitest';

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
});
