import { describe, it, expect, vi, afterEach } from 'vitest';

import * as trading from '../src/trading';
import * as marketData from '../src/market-data';

/**
 * Both namespaces re-export the shared core transport through their runtime
 * shims. These tests run the full battery against BOTH public surfaces.
 */
type RuntimeModule = {
    Configuration: typeof trading.Configuration;
    BaseAPI: typeof trading.BaseAPI;
    ApiError: typeof trading.ApiError;
    JSONApiResponse: typeof trading.JSONApiResponse;
    VoidApiResponse: typeof trading.VoidApiResponse;
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

function stalledResponse(status = 200): Response {
    return new Response(
        new ReadableStream({
            start() {
                // Deliberately never enqueue or close: body consumption hangs.
            },
        }),
        {
            status,
            headers: { 'Content-Type': 'application/json' },
        },
    );
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
 * method, so we can test verb-dependent retry gating without
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

    describe(`[${name}] redirect hardening`, () => {
        it('blocks redirects by default (redirect: "error") so secret headers can\'t follow off-host', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');
            expect(seen?.redirect).toBe('error');
        });

        it('lets the caller opt back into following redirects via config', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                redirect: 'follow',
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');
            expect(seen?.redirect).toBe('follow');
        });

        it('lets a per-call initOverride win over the configured redirect mode', async () => {
            let seen: RequestInit | undefined;
            const cfg = new rt.Configuration({
                redirect: 'follow',
                fetchApi: async (_url, init) => {
                    seen = init;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET', { redirect: 'manual' });
            expect(seen?.redirect).toBe('manual');
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

        // Submission safety: state-changing requests must not be replayed.
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

        // A non-idempotent POST is never auto-retried, even on 429. Retrying
        // could duplicate an order when the original request reached the server.
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

        it('does not replay an order POST body after retryable response or network failures', async () => {
            const body = JSON.stringify({ client_order_id: 'stable-order-123' });

            for (const failure of ['response', 'network'] as const) {
                let calls = 0;
                const cfg = new rt.Configuration({
                    retry: { maxRetries: 3, retryDelayMs: 1 },
                    fetchApi: async (_url, init) => {
                        calls += 1;
                        expect(init?.body).toBe(body);
                        if (failure === 'network') throw new Error('ECONNRESET');
                        return jsonResponse(503, { message: 'unavailable' });
                    },
                });

                await expect(call(cfg, 'POST', { body })).rejects.toMatchObject({
                    name: failure === 'network' ? 'FetchError' : 'ApiError',
                });
                expect(calls).toBe(1);
            }
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

        it('caller abort during a status retry delay rejects promptly without a second GET', async () => {
            vi.useFakeTimers();
            try {
                const controller = new AbortController();
                const reason = new Error('caller cancelled during status backoff');
                let calls = 0;
                const cfg = new rt.Configuration({
                    retry: {
                        maxRetries: 1,
                        retryDelayMs: 60_000,
                        onRetry: () => controller.abort(reason),
                    },
                    fetchApi: async () => {
                        calls += 1;
                        return jsonResponse(503, { message: 'later' });
                    },
                });

                let rejection: unknown;
                void call(cfg, 'GET', { signal: controller.signal }).catch((error) => {
                    rejection = error;
                });
                await vi.advanceTimersByTimeAsync(0);

                expect(rejection).toMatchObject({
                    name: 'FetchError',
                    cause: reason,
                });
                expect(calls).toBe(1);
                expect(vi.getTimerCount()).toBe(0);
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

        // Submission safety: a network error mid-POST might have reached the
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

        it('does not classify a caller abort with a generic Error reason as retryable', async () => {
            const controller = new AbortController();
            const reason = new Error('caller cancelled');
            let calls = 0;
            let retries = 0;
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 3,
                    retryDelayMs: 1,
                    onRetry: () => {
                        retries += 1;
                    },
                },
                fetchApi: async (_url, init) => {
                    calls += 1;
                    const signal = init?.signal as AbortSignal;
                    return new Promise<Response>((_resolve, reject) => {
                        signal.addEventListener('abort', () => reject(signal.reason), {
                            once: true,
                        });
                    });
                },
            });

            const result = call(cfg, 'GET', { signal: controller.signal });
            await new Promise((resolve) => setTimeout(resolve, 0));
            controller.abort(reason);
            const error = await result.catch((caught) => caught);

            expect(error).toMatchObject({ name: 'FetchError' });
            expect(error.cause).toBe(reason);
            expect(calls).toBe(1);
            expect(retries).toBe(0);
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

        it('caller abort during a network retry delay rejects promptly without a second GET', async () => {
            vi.useFakeTimers();
            try {
                const controller = new AbortController();
                const reason = new Error('caller cancelled during network backoff');
                let calls = 0;
                const cfg = new rt.Configuration({
                    retry: {
                        maxRetries: 1,
                        retryDelayMs: 60_000,
                        onRetry: () => controller.abort(reason),
                    },
                    fetchApi: async () => {
                        calls += 1;
                        throw new Error('ECONNRESET');
                    },
                });

                let rejection: unknown;
                void call(cfg, 'GET', { signal: controller.signal }).catch((error) => {
                    rejection = error;
                });
                await vi.advanceTimersByTimeAsync(0);

                expect(rejection).toMatchObject({
                    name: 'FetchError',
                    cause: reason,
                });
                expect(calls).toBe(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe(`[${name}] retry observability (onRetry/onGiveUp)`, () => {
        it('fires onRetry before each delayed retry, then succeeds without onGiveUp', async () => {
            const events: trading.RetryEvent[] = [];
            const giveUps: trading.RetryEvent[] = [];
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 3,
                    retryDelayMs: 1,
                    onRetry: (e) => events.push(e),
                    onGiveUp: (e) => giveUps.push(e),
                },
                fetchApi: async () => {
                    calls += 1;
                    if (calls < 3) return jsonResponse(503, { message: 'try later' });
                    return jsonResponse(200, OK_BODY);
                },
            });
            const res = await call(cfg, 'GET');
            expect(res.status).toBe(200);
            expect(calls).toBe(3);
            expect(giveUps).toHaveLength(0);
            expect(events).toHaveLength(2);
            expect(events.map((e) => e.attempt)).toEqual([1, 2]);
            for (const e of events) {
                expect(e.method).toBe('GET');
                expect(e.url).toContain('/probe');
                expect(e.maxRetries).toBe(3);
                expect(e.status).toBe(503);
                expect(e.error).toBeUndefined();
                expect(e.delayMs).toBeGreaterThan(0);
            }
        });

        it('fires onGiveUp exactly once after a retryable status exhausts all retries', async () => {
            const events: trading.RetryEvent[] = [];
            const giveUps: trading.RetryEvent[] = [];
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 2,
                    retryDelayMs: 1,
                    onRetry: (e) => events.push(e),
                    onGiveUp: (e) => giveUps.push(e),
                },
                fetchApi: async () => jsonResponse(500, { message: 'boom' }),
            });
            await expect(call(cfg, 'GET')).rejects.toBeInstanceOf(rt.ApiError);
            expect(events.map((e) => e.attempt)).toEqual([1, 2]);
            expect(giveUps).toHaveLength(1);
            expect(giveUps[0]).toMatchObject({ attempt: 2, maxRetries: 2, status: 500, delayMs: 0 });
            expect(giveUps[0].error).toBeUndefined();
        });

        it('passes the network error (not a status) on network-error retries and give-up', async () => {
            const events: trading.RetryEvent[] = [];
            const giveUps: trading.RetryEvent[] = [];
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 1,
                    retryDelayMs: 1,
                    onRetry: (e) => events.push(e),
                    onGiveUp: (e) => giveUps.push(e),
                },
                fetchApi: async () => {
                    throw new Error('ECONNRESET');
                },
            });
            await expect(call(cfg, 'GET')).rejects.toMatchObject({ name: 'FetchError' });
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({ attempt: 1, maxRetries: 1 });
            expect(events[0].status).toBeUndefined();
            expect(events[0].error).toBeInstanceOf(trading.FetchError);
            expect(giveUps).toHaveLength(1);
            expect(giveUps[0]).toMatchObject({ attempt: 1, delayMs: 0 });
            expect(giveUps[0].status).toBeUndefined();
            expect(giveUps[0].error).toBeInstanceOf(trading.FetchError);
        });

        it('does not fire either hook for a non-retryable status', async () => {
            const events: trading.RetryEvent[] = [];
            const giveUps: trading.RetryEvent[] = [];
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 3,
                    retryDelayMs: 1,
                    onRetry: (e) => events.push(e),
                    onGiveUp: (e) => giveUps.push(e),
                },
                fetchApi: async () => jsonResponse(400, { message: 'bad request' }),
            });
            await expect(call(cfg, 'GET')).rejects.toBeInstanceOf(rt.ApiError);
            expect(events).toHaveLength(0);
            expect(giveUps).toHaveLength(0);
        });

        it('does not fire either hook for a non-idempotent POST', async () => {
            const events: trading.RetryEvent[] = [];
            const giveUps: trading.RetryEvent[] = [];
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 3,
                    retryDelayMs: 1,
                    onRetry: (e) => events.push(e),
                    onGiveUp: (e) => giveUps.push(e),
                },
                fetchApi: async () => jsonResponse(503, { message: 'later' }),
            });
            await expect(call(cfg, 'POST')).rejects.toBeInstanceOf(rt.ApiError);
            expect(events).toHaveLength(0);
            expect(giveUps).toHaveLength(0);
        });

        it('swallows a throwing listener so observability never breaks the request', async () => {
            let calls = 0;
            const cfg = new rt.Configuration({
                retry: {
                    maxRetries: 2,
                    retryDelayMs: 1,
                    onRetry: () => {
                        throw new Error('listener blew up');
                    },
                    onGiveUp: () => {
                        throw new Error('listener blew up');
                    },
                },
                fetchApi: async () => {
                    calls += 1;
                    if (calls < 2) return jsonResponse(503, { message: 'later' });
                    return jsonResponse(200, OK_BODY);
                },
            });
            const res = await call(cfg, 'GET');
            expect(res.status).toBe(200);
            expect(calls).toBe(2);
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

        it('keeps the attempt timeout live while a successful JSON body is consumed', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => stalledResponse(),
                });
                const result = call(cfg, 'GET').then((response) =>
                    new rt.JSONApiResponse(response).value(),
                );
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('cancels an active successful body reader exactly once on timeout', async () => {
            vi.useFakeTimers();
            try {
                const cancel = vi.fn();
                const cfg = new rt.Configuration({
                    timeoutMs: 1_000,
                    fetchApi: async () =>
                        new Response(
                            new ReadableStream({
                                cancel,
                            }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        ),
                });
                const result = call(cfg, 'GET').then((response) =>
                    new rt.JSONApiResponse(response).value(),
                );
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(1_000);
                await expectation;
                expect(cancel).toHaveBeenCalledTimes(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('keeps the attempt timeout live while arrayBuffer() consumes a body', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => stalledResponse(),
                });
                const result = call(cfg, 'GET').then((response) => response.arrayBuffer());
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('feature-detects bytes() and wraps it only when the Response provides it', async () => {
            vi.useFakeTimers();
            try {
                type ResponseWithBytes = Response & {
                    bytes?: () => Promise<Uint8Array>;
                };
                const withoutBytes = jsonResponse(200, OK_BODY) as ResponseWithBytes;
                Object.defineProperty(withoutBytes, 'bytes', {
                    configurable: true,
                    value: undefined,
                });
                const cfgWithoutBytes = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => withoutBytes,
                });
                const unchanged = await call(cfgWithoutBytes, 'GET');
                expect((unchanged as ResponseWithBytes).bytes).toBeUndefined();
                await unchanged.json();

                const withBytes = stalledResponse() as ResponseWithBytes;
                const originalBytes = () => new Promise<Uint8Array>(() => {});
                Object.defineProperty(withBytes, 'bytes', {
                    configurable: true,
                    value: originalBytes,
                });
                const cfgWithBytes = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => withBytes,
                });
                const wrapped = await call(cfgWithBytes, 'GET');
                expect((wrapped as ResponseWithBytes).bytes).not.toBe(originalBytes);
                const result = (wrapped as ResponseWithBytes).bytes?.();
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('cancels an unexpected body before VoidApiResponse releases its deadline', async () => {
            vi.useFakeTimers();
            try {
                const cancel = vi.fn();
                const response = new Response(
                    new ReadableStream({
                        cancel,
                    }),
                    { status: 200 },
                );
                const cfg = new rt.Configuration({
                    timeoutMs: 60_000,
                    fetchApi: async () => response,
                });
                const raw = await call(cfg, 'GET');

                await new rt.VoidApiResponse(raw).value();

                expect(cancel).toHaveBeenCalledTimes(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('preserves native Response method identity without a timeout or caller signal', async () => {
            type ResponseWithBytes = Response & {
                bytes?: () => Promise<Uint8Array>;
            };
            const response = jsonResponse(200, OK_BODY);
            const methods = {
                arrayBuffer: response.arrayBuffer,
                blob: response.blob,
                bytes: (response as ResponseWithBytes).bytes,
                formData: response.formData,
                json: response.json,
                text: response.text,
            };
            const cfg = new rt.Configuration({
                timeoutMs: 0,
                fetchApi: async () => response,
            });

            const raw = await call(cfg, 'GET');

            expect(raw.arrayBuffer).toBe(methods.arrayBuffer);
            expect(raw.blob).toBe(methods.blob);
            expect((raw as ResponseWithBytes).bytes).toBe(methods.bytes);
            expect(raw.formData).toBe(methods.formData);
            expect(raw.json).toBe(methods.json);
            expect(raw.text).toBe(methods.text);
        });

        it('releases a rate-limit handle that resolves after the acquire race aborts', async () => {
            const controller = new AbortController();
            const reason = new DOMException('caller cancelled acquire race', 'AbortError');
            const release = vi.fn();
            let fetchCalls = 0;
            const cfg = new rt.Configuration({
                timeoutMs: 0,
                rateLimit: { maxRequests: 1 },
                fetchApi: async () => {
                    fetchCalls += 1;
                    return jsonResponse(200, OK_BODY);
                },
            });
            const limiter = cfg.rateLimiter;
            if (!limiter) throw new Error('expected configured rate limiter');
            limiter.acquire = () => {
                const acquired = Promise.resolve(release);
                controller.abort(reason);
                return acquired;
            };

            const error = await call(cfg, 'GET', { signal: controller.signal }).catch(
                (caught) => caught,
            );
            await Promise.resolve();

            expect(error).toMatchObject({ name: 'FetchError' });
            expect(error.cause).toBe(reason);
            expect(release).toHaveBeenCalledTimes(1);
            expect(fetchCalls).toBe(0);
        });

        it('discards a Response that fetch resolves after the attempt timeout', async () => {
            vi.useFakeTimers();
            try {
                const cancel = vi.fn();
                const cfg = new rt.Configuration({
                    timeoutMs: 1_000,
                    fetchApi: async () =>
                        new Promise<Response>((resolve) => {
                            setTimeout(
                                () =>
                                    resolve(
                                        new Response(
                                            new ReadableStream({
                                                cancel,
                                            }),
                                            { status: 200 },
                                        ),
                                    ),
                                2_000,
                            );
                        }),
                });
                const request = call(cfg, 'GET');
                const expectation = expect(request).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(1_000);
                await expectation;
                expect(cancel).toHaveBeenCalledTimes(0);

                await vi.advanceTimersByTimeAsync(1_000);
                await Promise.resolve();
                expect(cancel).toHaveBeenCalledTimes(1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('normalizes caller abort during a successful body read and preserves its cause', async () => {
            vi.useFakeTimers();
            try {
                const controller = new AbortController();
                const reason = new DOMException('caller cancelled body read', 'AbortError');
                const cfg = new rt.Configuration({
                    timeoutMs: 60_000,
                    fetchApi: async () => stalledResponse(),
                });
                const result = call(cfg, 'GET', { signal: controller.signal }).then((response) =>
                    new rt.JSONApiResponse(response).value(),
                );

                await vi.advanceTimersByTimeAsync(0);
                controller.abort(reason);
                const error = await result.catch((caught) => caught);

                expect(error).toMatchObject({ name: 'FetchError' });
                expect(error.cause).toBe(reason);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('bounds stalled non-2xx error-body parsing with the attempt timeout', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => stalledResponse(500),
                });
                const result = call(cfg, 'POST');
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('cancels an active non-2xx error body exactly once on timeout', async () => {
            vi.useFakeTimers();
            try {
                const cancel = vi.fn();
                const cfg = new rt.Configuration({
                    timeoutMs: 1_000,
                    fetchApi: async () =>
                        new Response(
                            new ReadableStream({
                                cancel,
                            }),
                            {
                                status: 500,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        ),
                });
                const result = call(cfg, 'POST');
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(1_000);
                await expectation;
                expect(cancel).toHaveBeenCalledTimes(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('applies the same body deadline to a Response replaced by post middleware', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    middleware: [
                        {
                            post: async () => stalledResponse(),
                        },
                    ],
                    fetchApi: async () => jsonResponse(200, OK_BODY),
                });
                const result = call(cfg, 'GET').then((response) =>
                    new rt.JSONApiResponse(response).value(),
                );
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(5_000);
                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('starts a fresh timeout budget for each retry and excludes backoff', async () => {
            vi.useFakeTimers();
            const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            try {
                let calls = 0;
                const cfg = new rt.Configuration({
                    timeoutMs: 1_000,
                    retry: { maxRetries: 1, retryDelayMs: 500 },
                    fetchApi: async () => {
                        calls += 1;
                        if (calls === 2) return stalledResponse();
                        return new Promise<Response>((resolve) => {
                            setTimeout(
                                () => resolve(jsonResponse(503, { message: 'retry' })),
                                800,
                            );
                        });
                    },
                });
                const result = call(cfg, 'GET').then((response) =>
                    new rt.JSONApiResponse(response).value(),
                );
                const expectation = expect(result).rejects.toMatchObject({
                    name: 'FetchError',
                    cause: { name: 'TimeoutError' },
                });

                await vi.advanceTimersByTimeAsync(800);
                await vi.advanceTimersByTimeAsync(500);
                expect(calls).toBe(2);
                await vi.advanceTimersByTimeAsync(999);
                expect(vi.getTimerCount()).toBe(1);
                await vi.advanceTimersByTimeAsync(1);

                await expectation;
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                random.mockRestore();
                vi.useRealTimers();
            }
        });

        it('normalizes caller abort while waiting for the rate limiter', async () => {
            const controller = new AbortController();
            const reason = new DOMException('caller cancelled rate-limit wait', 'AbortError');
            let calls = 0;
            const cfg = new rt.Configuration({
                timeoutMs: 0,
                rateLimit: { maxRequests: 1, intervalMs: 60_000 },
                fetchApi: async () => {
                    calls += 1;
                    return jsonResponse(200, OK_BODY);
                },
            });
            await call(cfg, 'GET');

            const waiting = call(cfg, 'GET', { signal: controller.signal });
            await new Promise((resolve) => setTimeout(resolve, 0));
            controller.abort(reason);
            const error = await waiting.catch((caught) => caught);

            expect(error).toMatchObject({ name: 'FetchError' });
            expect(error.cause).toBe(reason);
            expect(calls).toBe(1);
        });

        it('releases an unconsumed raw response deadline when it fires', async () => {
            vi.useFakeTimers();
            try {
                const cfg = new rt.Configuration({
                    timeoutMs: 5_000,
                    fetchApi: async () => jsonResponse(200, OK_BODY),
                });

                await call(cfg, 'GET');
                expect(vi.getTimerCount()).toBe(1);
                await vi.advanceTimersByTimeAsync(5_000);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('cancels an unconsumed raw response body exactly once when its deadline fires', async () => {
            vi.useFakeTimers();
            try {
                const cancel = vi.fn();
                const cfg = new rt.Configuration({
                    timeoutMs: 1_000,
                    fetchApi: async () =>
                        new Response(
                            new ReadableStream({
                                cancel,
                            }),
                            { status: 200 },
                        ),
                });

                await call(cfg, 'GET');
                await vi.advanceTimersByTimeAsync(1_000);

                expect(cancel).toHaveBeenCalledTimes(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
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
