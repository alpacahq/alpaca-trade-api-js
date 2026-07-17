import { describe, it, expect } from 'vitest';

import {
    buildApiError,
    ResponseError,
    ApiError,
    AuthError,
    PermissionError,
    NotFoundError,
    ValidationError,
    RateLimitError,
} from '../src/errors';
import * as trading from '../src/trading';
import * as marketData from '../src/market-data';

function errorResponse(status: number, body: unknown = '', headers: Record<string, string> = {}): Response {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(payload, {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

describe('buildApiError - status to subclass mapping', () => {
    const cases: Array<{ status: number; ctor: Function; name: string }> = [
        { status: 401, ctor: AuthError, name: 'AuthError' },
        { status: 403, ctor: PermissionError, name: 'PermissionError' },
        { status: 404, ctor: NotFoundError, name: 'NotFoundError' },
        { status: 400, ctor: ValidationError, name: 'ValidationError' },
        { status: 422, ctor: ValidationError, name: 'ValidationError' },
        { status: 429, ctor: RateLimitError, name: 'RateLimitError' },
        { status: 500, ctor: ApiError, name: 'ApiError' },
        { status: 418, ctor: ApiError, name: 'ApiError' },
    ];

    for (const { status, ctor, name } of cases) {
        it(`maps HTTP ${status} to ${name}`, async () => {
            const err = await buildApiError(errorResponse(status, { code: 40010001, message: 'boom' }));
            expect(err).toBeInstanceOf(ctor);
            // Every subclass is still an ApiError and a ResponseError.
            expect(err).toBeInstanceOf(ApiError);
            expect(err).toBeInstanceOf(ResponseError);
            expect(err.name).toBe(name);
            expect(err.status).toBe(status);
            expect(err.code).toBe(40010001);
            expect(err.message).toBe('boom');
        });
    }
});

describe('buildApiError - market-data 403 feed hint', () => {
    it('appends a feed/SIP hint when a 403 mentions SIP subscription', async () => {
        const err = await buildApiError(
            errorResponse(403, { message: 'subscription does not permit querying recent SIP data' }),
        );
        expect(err).toBeInstanceOf(PermissionError);
        expect(err.status).toBe(403);
        // Original message is preserved; guidance is appended.
        expect(err.message).toContain('subscription does not permit querying recent SIP data');
        expect(err.message).toContain('{ feed: "iex" }');
        expect(err.message).toContain('15 minutes');
    });

    it('does not alter unrelated 403 messages', async () => {
        const err = await buildApiError(
            errorResponse(403, { code: 40310000, message: 'forbidden' }),
        );
        expect(err).toBeInstanceOf(PermissionError);
        expect(err.message).toBe('forbidden');
    });

    it('does not append the hint to non-403 statuses mentioning sip', async () => {
        const err = await buildApiError(
            errorResponse(400, { message: 'invalid sip parameter' }),
        );
        expect(err.message).toBe('invalid sip parameter');
    });
});

describe('buildApiError - rate-limit metadata', () => {
    it('parses X-RateLimit-* headers into rateLimit', async () => {
        const resetSecs = Math.floor(Date.now() / 1000) + 30;
        const err = await buildApiError(
            errorResponse(429, { message: 'slow down' }, {
                'X-RateLimit-Limit': '200',
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(resetSecs),
            }),
        );
        expect(err.rateLimit?.limit).toBe(200);
        expect(err.rateLimit?.remaining).toBe(0);
        expect(err.rateLimit?.reset).toBeInstanceOf(Date);
        expect(err.rateLimit?.reset?.getTime()).toBe(resetSecs * 1000);
    });

    it('derives retryAfterMs from Retry-After (seconds)', async () => {
        const err = await buildApiError(
            errorResponse(429, '', { 'Retry-After': '5' }),
        );
        expect(err.retryAfterMs).toBe(5000);
    });

    it('derives retryAfterMs from X-RateLimit-Reset when Retry-After absent', async () => {
        const resetSecs = Math.floor(Date.now() / 1000) + 10;
        const err = await buildApiError(
            errorResponse(429, '', { 'X-RateLimit-Reset': String(resetSecs) }),
        );
        expect(err.retryAfterMs).toBeGreaterThan(0);
        expect(err.retryAfterMs).toBeLessThanOrEqual(10_000);
    });

    it('leaves rate-limit fields undefined when no headers are present', async () => {
        const err = await buildApiError(errorResponse(500, { message: 'oops' }));
        expect(err.rateLimit).toBeUndefined();
        expect(err.retryAfterMs).toBeUndefined();
    });
});

describe('buildApiError - request id', () => {
    it('surfaces X-Request-ID onto the error', async () => {
        const err = await buildApiError(
            errorResponse(500, { message: 'oops' }, { 'X-Request-ID': 'abc-123' }),
        );
        expect(err.requestId).toBe('abc-123');
    });

    it('reads the header case-insensitively', async () => {
        const err = await buildApiError(
            errorResponse(404, { message: 'missing' }, { 'x-request-id': 'lower-456' }),
        );
        expect(err.requestId).toBe('lower-456');
    });

    it('leaves requestId undefined when the header is absent', async () => {
        const err = await buildApiError(errorResponse(400, { message: 'bad' }));
        expect(err.requestId).toBeUndefined();
    });
});

describe('buildApiError - body parsing fallbacks', () => {
    it('keeps the raw Response and a default message for an empty body', async () => {
        const res = errorResponse(503, '');
        const err = await buildApiError(res);
        expect(err.response).toBe(res);
        expect(err.message).toContain('HTTP 503');
    });

    it('uses non-JSON text as the message', async () => {
        const err = await buildApiError(
            new Response('upstream exploded', { status: 502 }),
        );
        expect(err.message).toBe('upstream exploded');
    });

    it('does not consume the original response body', async () => {
        const res = errorResponse(400, { message: 'bad' });
        await buildApiError(res);
        await expect(res.json()).resolves.toEqual({ message: 'bad' });
    });
});

describe('single error identity across runtimes', () => {
    it('trading and market-data re-export the SAME classes', () => {
        expect(trading.ApiError).toBe(marketData.ApiError);
        expect(trading.ApiError).toBe(ApiError);
        expect(trading.RateLimitError).toBe(marketData.RateLimitError);
        expect(trading.RateLimitError).toBe(RateLimitError);
        expect(trading.AuthError).toBe(marketData.AuthError);
        expect(trading.FetchError).toBe(marketData.FetchError);
    });

    it('an error built here is instanceof the runtime-exported class', async () => {
        const err = await buildApiError(errorResponse(429, ''));
        expect(err).toBeInstanceOf(trading.RateLimitError);
        expect(err).toBeInstanceOf(marketData.ApiError);
    });
});
