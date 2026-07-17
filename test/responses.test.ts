import { describe, it, expect } from 'vitest';

import { withResponse } from '../src';
import * as trading from '../src/trading';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

const RATE_LIMIT_HEADERS = {
    'X-RateLimit-Limit': '200',
    'X-RateLimit-Remaining': '199',
    'X-RateLimit-Reset': '1700000000',
};

describe('withResponse (typed response-with-headers)', () => {
    it('pairs the deserialized body with status, headers, and rate-limit metadata', async () => {
        const cfg = new trading.Configuration({
            fetchApi: async () => jsonResponse(200, { id: 'acct-123', status: 'ACTIVE' }, RATE_LIMIT_HEADERS),
        });
        const api = new trading.AccountsApi(cfg);

        const res = await withResponse(api.getAccountRaw());

        expect(res.status).toBe(200);
        expect(res.data.id).toBe('acct-123');
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('199');
        expect(res.rateLimit).toMatchObject({ limit: 200, remaining: 199 });
        expect(res.rateLimit?.reset).toBeInstanceOf(Date);
    });

    it('accepts an already-resolved ApiResponse, not just a promise', async () => {
        const cfg = new trading.Configuration({
            fetchApi: async () => jsonResponse(200, { id: 'acct-9' }),
        });
        const api = new trading.AccountsApi(cfg);

        const raw = await api.getAccountRaw();
        const res = await withResponse(raw);

        expect(res.status).toBe(200);
        expect(res.data.id).toBe('acct-9');
    });

    it('leaves rateLimit undefined when no X-RateLimit-* headers are present', async () => {
        const cfg = new trading.Configuration({
            fetchApi: async () => jsonResponse(200, { id: 'acct-1' }),
        });
        const api = new trading.AccountsApi(cfg);

        const res = await withResponse(api.getAccountRaw());

        expect(res.rateLimit).toBeUndefined();
        expect(res.headers).toBeInstanceOf(Headers);
    });
});
