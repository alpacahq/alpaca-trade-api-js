import { describe, it, expect, vi, afterEach } from 'vitest';

import * as trading from '../src/trading';
import * as marketData from '../src/market-data';

/**
 * The transport (`runtime.ts`) is a duplicated copy in each namespace. These
 * tests run the full battery against BOTH so the suite fails if the copies
 * drift apart (e.g. a fix applied to one runtime but not the other).
 */
type RuntimeModule = {
    Configuration: typeof trading.Configuration;
    BaseAPI: typeof trading.BaseAPI;
    ApiError: typeof trading.ApiError;
    USER_AGENT: string;
};

const RUNTIMES: Array<{ name: string; rt: RuntimeModule }> = [
    { name: 'trading', rt: trading },
    { name: 'market-data', rt: marketData },
];

const OK_BODY = { ok: true };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(payload, {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

/** Read a header regardless of whether the runtime used a plain object, array, or Headers. */
function headerValue(init: RequestInit | undefined, name: string): string | undefined {
    const h = init?.headers;
    if (!h) return undefined;
    if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(name) ?? undefined;
    if (Array.isArray(h)) {
        const found = h.find(([k]) => k.toLowerCase() === name.toLowerCase());
        return found?.[1];
    }
    const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? (h as Record<string, string>)[key] : undefined;
}

/**
 * Builds a caller that drives `BaseAPI.request` directly for an arbitrary HTTP
 * method, so we can test verb-dependent behavior (idempotency gating) without
 * depending on which generated endpoints happen to be GET vs POST.
 */
function callerFor(rt: RuntimeModule) {
    class RawApi extends rt.BaseAPI {
        exec(method: string, initOverrides?: RequestInit): Promise<Response> {
            return this.request({ path: '/probe', method: method as never, headers: {} }, initOverrides);
        }
    }
    return (cfg: InstanceType<RuntimeModule['Configuration']>, method: string, initOverrides?: RequestInit) =>
        new RawApi(cfg).exec(method, initOverrides);
}

for (const { name, rt } of RUNTIMES) {
    const call = callerFor(rt);

    describe(`[${name}] G07 User-Agent header`, () => {
        it('sends the default User-Agent on every request', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');
            expect(headerValue(seen, 'User-Agent')).toBe(rt.USER_AGENT);
        });

        it('omits the User-Agent when explicitly disabled with ""', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                userAgent: '',
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');
            expect(headerValue(seen, 'User-Agent')).toBeUndefined();
        });

        it('lets the caller override the User-Agent', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                userAgent: 'my-app/9.9',
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');
            expect(headerValue(seen, 'User-Agent')).toBe('my-app/9.9');
        });
    });

    describe(`[${name}] G03 retry/backoff`, () => {
        it('does not retry when no policy is configured', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                fetchApi: async () => {
                    calls += 1;
                    return jsonResponse(503, { message: 'unavailable' });
                },
            });
            await expect(call(cfg, 'GET')).rejects.toBeInstanceOf(rt.ApiError);
            expect(calls).toBe(1);
        });

        it('retries an idempotent GET on transient 5xx then succeeds', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    if (calls < 3) return jsonResponse(503, { message: 'try later' });
                    return jsonResponse(200, OK_BODY);
                },
            });
            const res = await call(cfg, 'GET');
            expect(res.status).toBe(200);
            expect(calls).toBe(3);
        });

        it('throws a typed ApiError after exhausting retries', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 1, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    return jsonResponse(500, { code: 50010000, message: 'boom' });
                },
            });
            await expect(call(cfg, 'GET')).rejects.toMatchObject({
                name: 'ApiError',
                status: 500,
                code: 50010000,
                message: 'boom',
            });
            expect(calls).toBe(2); // initial + 1 retry
        });

        // Idempotency safety: the core property for a trading SDK.
        it('does NOT retry a non-idempotent POST on 5xx', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    return jsonResponse(500, { message: 'server error' });
                },
            });
            await expect(call(cfg, 'POST')).rejects.toBeInstanceOf(rt.ApiError);
            expect(calls).toBe(1);
        });

        // Idempotency safety: a non-idempotent POST is never auto-retried, even on
        // 429. Retrying could duplicate an order; use an Idempotency-Key to make a
        // POST safely retryable yourself.
        it('does NOT retry a non-idempotent POST on 429', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    return jsonResponse(429, { message: 'slow down' });
                },
            });
            await expect(call(cfg, 'POST')).rejects.toBeInstanceOf(rt.ApiError);
            expect(calls).toBe(1);
        });

        it('retries the newly-added 408 and 425 statuses on an idempotent GET', async () => {
            for (const status of [408, 425]) {
                let calls = 0;
                const cfg = new rt.Configuration({
                    retry: { maxRetries: 3, retryDelayMs: 1 },
                    fetchApi: async () => {
                        calls += 1;
                        if (calls === 1) return jsonResponse(status, { message: 'retry me' });
                        return jsonResponse(200, OK_BODY);
                    },
                });
                const res = await call(cfg, 'GET');
                expect(res.status).toBe(200);
                expect(calls).toBe(2);
            }
        });

        it('honors Retry-After (seconds) over the configured base delay', async () => {
            vi.useFakeTimers();
            try {
                let calls = 0;
                const cfg = new rt.Configuration({
                    // Large base delay so that, if Retry-After were ignored, the
                    // retry would NOT fire within the window we advance.
                    retry: { maxRetries: 1, retryDelayMs: 999_000 },
                    fetchApi: async () => {
                        calls += 1;
                        if (calls === 1) return jsonResponse(429, { message: 'slow down' }, { 'Retry-After': '2' });
                        return jsonResponse(200, OK_BODY);
                    },
                });
                const p = call(cfg, 'GET');
                const settled = expect(p).resolves.toHaveProperty('status', 200);

                await vi.advanceTimersByTimeAsync(1_900);
                expect(calls).toBe(1); // still waiting out the 2s Retry-After

                await vi.advanceTimersByTimeAsync(200);
                expect(calls).toBe(2); // fired at ~2s, not ~999s

                await settled;
            } finally {
                vi.useRealTimers();
            }
        });

        it('caps the backoff delay at maxDelayMs', async () => {
            vi.useFakeTimers();
            try {
                let calls = 0;
                const cfg = new rt.Configuration({
                    retry: { maxRetries: 1, retryDelayMs: 999_000, maxDelayMs: 50 },
                    fetchApi: async () => {
                        calls += 1;
                        if (calls === 1) return jsonResponse(503, { message: 'later' });
                        return jsonResponse(200, OK_BODY);
                    },
                });
                const p = call(cfg, 'GET');
                const settled = expect(p).resolves.toHaveProperty('status', 200);

                // jitter adds up to +20%, so cap+jitter <= 60ms.
                await vi.advanceTimersByTimeAsync(60);
                expect(calls).toBe(2);
                await settled;
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe(`[${name}] network-error retry`, () => {
        it('retries an idempotent GET on a transient network error then succeeds', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    if (calls < 3) throw new Error('ECONNRESET');
                    return jsonResponse(200, OK_BODY);
                },
            });
            const res = await call(cfg, 'GET');
            expect(res.status).toBe(200);
            expect(calls).toBe(3);
        });

        it('surfaces a FetchError after exhausting network-error retries', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 1, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    throw new Error('socket hang up');
                },
            });
            await expect(call(cfg, 'GET')).rejects.toMatchObject({ name: 'FetchError' });
            expect(calls).toBe(2); // initial + 1 retry
        });

        // Idempotency safety: a network error mid-POST might have reached the
        // server, so it must never be silently re-sent.
        it('does NOT retry a non-idempotent POST on a network error', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    throw new Error('ECONNRESET');
                },
            });
            await expect(call(cfg, 'POST')).rejects.toMatchObject({ name: 'FetchError' });
            expect(calls).toBe(1);
        });

        it('does NOT retry a deliberate abort (AbortError cause)', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: { maxRetries: 3, retryDelayMs: 1 },
                fetchApi: async () => {
                    calls += 1;
                    throw new DOMException('aborted', 'AbortError');
                },
            });
            await expect(call(cfg, 'GET')).rejects.toMatchObject({
                name: 'FetchError',
                cause: { name: 'AbortError' },
            });
            expect(calls).toBe(1);
        });

        it('does not retry network errors when no policy is configured', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                fetchApi: async () => {
                    calls += 1;
                    throw new Error('ECONNRESET');
                },
            });
            await expect(call(cfg, 'GET')).rejects.toMatchObject({ name: 'FetchError' });
            expect(calls).toBe(1);
        });
    });

    describe(`[${name}] G06 typed errors`, () => {
        it('parses the {code,message} envelope into an ApiError', async () => {
            const cfg = new rt.Configuration({
                fetchApi: async () => jsonResponse(403, { code: 40310000, message: 'forbidden' }),
            });
            const err = await call(cfg, 'GET').catch((e) => e);
            expect(err).toBeInstanceOf(rt.ApiError);
            expect(err.status).toBe(403);
            expect(err.code).toBe(40310000);
            expect(err.message).toBe('forbidden');
            expect(err.response).toBeInstanceOf(Response);
        });

        it('does not consume the response body (caller can still read it)', async () => {
            const cfg = new rt.Configuration({
                fetchApi: async () => jsonResponse(400, { code: 1, message: 'bad' }),
            });
            const err = await call(cfg, 'GET').catch((e) => e);
            // The original Response must remain readable since the error builder cloned it.
            await expect(err.response.json()).resolves.toMatchObject({ code: 1, message: 'bad' });
        });

        it('falls back to the raw body for non-JSON errors', async () => {
            const cfg = new rt.Configuration({
                fetchApi: async () => new Response('Not Found', { status: 404 }),
            });
            const err = await call(cfg, 'GET').catch((e) => e);
            expect(err).toBeInstanceOf(rt.ApiError);
            expect(err.status).toBe(404);
            expect(err.message).toBe('Not Found');
        });

        it('produces a sensible message for an empty error body', async () => {
            const cfg = new rt.Configuration({
                fetchApi: async () => new Response(null, { status: 502 }),
            });
            const err = await call(cfg, 'GET').catch((e) => e);
            expect(err.status).toBe(502);
            expect(err.message).toContain('502');
        });
    });

    describe(`[${name}] G05 timeout / AbortSignal`, () => {
        it('completes normally when the response arrives before the timeout', async () => {
            const cfg = new rt.Configuration({
                timeoutMs: 1_000,
                fetchApi: async () => jsonResponse(200, OK_BODY),
            });
            const res = await call(cfg, 'GET');
            expect(res.status).toBe(200);
        });

        it('aborts a stalled request once timeoutMs elapses', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: (_url, init) =>
                        new Promise<Response>((_resolve, reject) => {
                            init?.signal?.addEventListener('abort', () =>
                                reject((init.signal as AbortSignal).reason ?? new Error('aborted')),
                            );
                        }),
                });
                const p = call(cfg, 'GET');
                // FetchError wraps the underlying TimeoutError DOMException.
                const expectation = expect(p).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });
                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
            } finally {
                vi.useRealTimers();
            }
        });

        it('applies the default 30s timeout when none is configured', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    fetchApi: (_url, init) =>
                        new Promise<Response>((_resolve, reject) => {
                            init?.signal?.addEventListener('abort', () =>
                                reject((init.signal as AbortSignal).reason ?? new Error('aborted')),
                            );
                        }),
                });
                const p = call(cfg, 'GET');
                const expectation = expect(p).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });
                await vi.advanceTimersByTimeAsync(30_000);
                await expectation;
            } finally {
                vi.useRealTimers();
            }
        });

        it('disables the deadline entirely when timeoutMs is 0', async () => {
            vi.useFakeTimers();
            try {
                let settled = false;
                const cfg = new rt.Configuration({
                    timeoutMs: 0,
                    fetchApi: (_url, init) =>
                        new Promise<Response>((resolve, reject) => {
                            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                            // Resolve far in the future; with no deadline it must not abort.
                            setTimeout(() => {
                                settled = true;
                                resolve(jsonResponse(200, OK_BODY));
                            }, 120_000);
                        }),
                });
                const p = call(cfg, 'GET');
                await vi.advanceTimersByTimeAsync(60_000);
                expect(settled).toBe(false); // still waiting, not aborted
                await vi.advanceTimersByTimeAsync(60_000);
                await expect(p).resolves.toHaveProperty('status', 200);
            } finally {
                vi.useRealTimers();
            }
        });

        it('respects a caller-supplied AbortSignal that is already aborted', async () => {
            const ac = new AbortController();
            ac.abort(new Error('caller cancelled'));
            const cfg = new rt.Configuration({
                fetchApi: (_url, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        const signal = init?.signal as AbortSignal | undefined;
                        if (signal?.aborted) reject(signal.reason);
                        else signal?.addEventListener('abort', () => reject(signal.reason));
                    }),
            });
            await expect(call(cfg, 'GET', { signal: ac.signal })).rejects.toBeTruthy();
        });

        it('propagates a caller abort even when a timeout is also configured', async () => {
            const ac = new AbortController();
            ac.abort(new Error('caller cancelled'));
            const cfg = new rt.Configuration({
                timeoutMs: 60_000,
                fetchApi: (_url, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        const signal = init?.signal as AbortSignal | undefined;
                        if (signal?.aborted) reject(signal.reason);
                        else signal?.addEventListener('abort', () => reject(signal.reason));
                    }),
            });
            await expect(call(cfg, 'GET', { signal: ac.signal })).rejects.toBeTruthy();
        });
    });
}

describe('paper/live environment switching', () => {
    it('exposes named trading host constants', () => {
        expect(trading.TRADING_PAPER_HOST).toBe('https://paper-api.alpaca.markets');
        expect(trading.TRADING_LIVE_HOST).toBe('https://api.alpaca.markets');
        expect(trading.BASE_PATH).toBe('https://paper-api.alpaca.markets');
    });

    it('exposes the market-data host constant', () => {
        expect(marketData.MARKET_DATA_HOST).toBe('https://data.alpaca.markets');
        expect(marketData.BASE_PATH).toBe('https://data.alpaca.markets');
    });

    it('defaults the trading host to paper', () => {
        expect(new trading.Configuration({}).basePath).toBe(trading.TRADING_PAPER_HOST);
        expect(new trading.Configuration({ paper: true }).basePath).toBe(trading.TRADING_PAPER_HOST);
    });

    it('switches the trading host to live when paper is false', () => {
        expect(new trading.Configuration({ paper: false }).basePath).toBe(trading.TRADING_LIVE_HOST);
    });

    it('lets an explicit basePath override the paper flag', () => {
        const custom = 'https://example.test';
        expect(new trading.Configuration({ paper: false, basePath: custom }).basePath).toBe(custom);
        expect(new trading.Configuration({ paper: true, basePath: custom }).basePath).toBe(custom);
    });

    it('ignores the paper flag for market data (single host)', () => {
        expect(new marketData.Configuration({ paper: false }).basePath).toBe(marketData.MARKET_DATA_HOST);
        expect(new marketData.Configuration({ paper: true }).basePath).toBe(marketData.MARKET_DATA_HOST);
    });

    it('selects the market-data sandbox host when sandbox is true', () => {
        expect(marketData.MARKET_DATA_SANDBOX_HOST).toBe('https://data.sandbox.alpaca.markets');
        expect(new marketData.Configuration({ sandbox: true }).basePath).toBe(marketData.MARKET_DATA_SANDBOX_HOST);
        expect(new marketData.Configuration({ sandbox: false }).basePath).toBe(marketData.MARKET_DATA_HOST);
    });

    it('ignores the sandbox flag for trading (no sandbox host)', () => {
        expect(new trading.Configuration({ sandbox: true }).basePath).toBe(trading.TRADING_PAPER_HOST);
    });
});

describe('no-argument API construction defaults to the package host', () => {
    /** Capture the URL of the next global-fetch call and return a canned 200. */
    function stubGlobalFetch(): { urls: string[] } {
        const urls: string[] = [];
        vi.stubGlobal('fetch', async (url: string | URL | Request) => {
            urls.push(String(url));
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        return { urls };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('a trading API built with no Configuration targets the paper host', async () => {
        const { urls } = stubGlobalFetch();
        // No config => uses the package DefaultConfig (paper) and global fetch.
        await new trading.AccountsApi().getAccount();
        expect(urls[0]).toContain(trading.TRADING_PAPER_HOST);
    });

    it('a market-data API built with no Configuration targets the data host', async () => {
        const { urls } = stubGlobalFetch();
        await new marketData.StockApi().stockMetaExchanges();
        expect(urls[0]).toContain(marketData.MARKET_DATA_HOST);
    });

    it('keeps the public DefaultConfig in sync with that default', () => {
        expect(trading.DefaultConfig.basePath).toBe(trading.TRADING_PAPER_HOST);
        expect(marketData.DefaultConfig.basePath).toBe(marketData.MARKET_DATA_HOST);
    });
});
