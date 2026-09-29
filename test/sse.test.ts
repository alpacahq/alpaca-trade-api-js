import { describe, expect, it, vi } from 'vitest';

import {
    SSEApiResponse,
    SseDeserializationError,
    SseProtocolError,
} from '../src/trading';
import { Alpaca } from '../src/client';
import * as trading from '../src/trading';
import * as marketData from '../src/market-data';

function chunkedResponse(chunks: Array<string | Uint8Array>, onCancel?: () => void): Response {
    const encoder = new TextEncoder();
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
                }
                controller.close();
            },
            cancel() {
                onCancel?.();
            },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
    );
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const values: T[] = [];
    for await (const value of iterable) values.push(value);
    return values;
}

describe('typed SSE subscription', () => {
    it('parses fragmented framing, comments, persistent ids, empty-id reset, and retry', async () => {
        const comments: string[] = [];
        const bytes = new TextEncoder().encode(
            ': heartbeat\r\nid: evt-1\r\n\r\ndata: first\r\n\r\nid:\ndata: second\n\nretry: 1500\ndata: third\n\n',
        );
        const response = chunkedResponse([
            bytes.slice(0, 3),
            bytes.slice(3, 17),
            bytes.slice(17, 38),
            bytes.slice(38),
        ]);
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => data,
            { reconnect: false, onComment: (comment) => comments.push(comment) },
        );
        const stream = await raw.value();
        const messages = [];
        for await (const message of stream.messages()) messages.push(message);

        expect(comments).toEqual(['heartbeat']);
        expect(messages).toEqual([
            { data: 'first', id: 'evt-1', retry: undefined, event: undefined },
            { data: 'second', id: '', retry: undefined, event: undefined },
            { data: 'third', id: '', retry: 1500, event: undefined },
        ]);
        expect(stream.lastEventId).toBe('');
    });

    it('joins multiline data and preserves split UTF-8 code points', async () => {
        const bytes = new TextEncoder().encode('event: update\ndata: hello\ndata: 🌍\n\n');
        const globe = bytes.indexOf(0xf0);
        const response = chunkedResponse([
            bytes.slice(0, globe + 1),
            bytes.slice(globe + 1, globe + 3),
            bytes.slice(globe + 3),
        ]);
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => data,
            { reconnect: false },
        );

        await expect(collect((await raw.value()).messages())).resolves.toEqual([
            {
                data: 'hello\n🌍',
                event: 'update',
                id: undefined,
                retry: undefined,
            },
        ]);
    });

    it('handles a BOM, unknown fields, and CR-only framing at EOF', async () => {
        const response = chunkedResponse([
            '\uFEFFunknown: ignored\rdata: cr-only\r\r',
        ]);
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => data,
            { reconnect: false },
        );

        await expect(collect(await raw.value())).resolves.toEqual(['cr-only']);
    });

    it('turns JSON/model conversion failures into terminal typed errors', async () => {
        const response = chunkedResponse(['data: not-json\n\n']);
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => JSON.parse(data),
            { reconnect: { initialDelayMs: 0, maxAttempts: 1 } },
            { reconnect: true },
        );
        const stream = await raw.value();

        await expect(collect(stream)).rejects.toBeInstanceOf(
            SseDeserializationError,
        );
        await expect(stream.closed).resolves.toMatchObject({
            reason: 'error',
            error: expect.any(SseDeserializationError),
        });
    });

    it('enforces event resource limits before transformation', async () => {
        const response = chunkedResponse(['data: 123456\n\n']);
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => data,
            { reconnect: false, maxEventBytes: 4 },
        );

        await expect(collect(await raw.value())).rejects.toBeInstanceOf(
            SseProtocolError,
        );
    });

    it('reconnects with the latest event id and stops when iteration returns', async () => {
        const seenIds: Array<string | undefined> = [];
        const reconnects = vi.fn();
        let call = 0;
        const raw = await SSEApiResponse.open(
            async (lastEventId) => {
                seenIds.push(lastEventId);
                call += 1;
                return {
                    response: chunkedResponse([
                        call === 1
                            ? 'id: evt-1\ndata: {"n":1}\n\n'
                            : 'id: evt-2\ndata: {"n":2}\n\n',
                    ]),
                    url: 'https://stream.example.test/events',
                };
            },
            (data) => JSON.parse(data) as { n: number },
            {
                reconnect: { initialDelayMs: 0, maxDelayMs: 0 },
                onReconnect: reconnects,
            },
            { reconnect: true },
        );
        const stream = await raw.value();
        const iterator = stream[Symbol.asyncIterator]();

        await expect(iterator.next()).resolves.toEqual({ value: { n: 1 }, done: false });
        await expect(iterator.next()).resolves.toEqual({ value: { n: 2 }, done: false });
        await iterator.return?.();

        expect(seenIds).toEqual([undefined, 'evt-1']);
        expect(reconnects).toHaveBeenCalledTimes(1);
    });

    it('does not resume past an event interrupted before dispatch', async () => {
        const seenIds: Array<string | undefined> = [];
        let call = 0;
        const raw = await SSEApiResponse.open(
            async (lastEventId) => {
                seenIds.push(lastEventId);
                call += 1;
                return {
                    response: chunkedResponse([
                        call === 1
                            ? 'id: evt-1\ndata: {"n":1}\n\nid: evt-2\ndata: {"n":2}'
                            : 'id: evt-2\ndata: {"n":2}\n\n',
                    ]),
                    url: 'https://stream.example.test/events',
                };
            },
            (data) => JSON.parse(data) as { n: number },
            { reconnect: { initialDelayMs: 0, maxDelayMs: 0 } },
            { reconnect: true },
        );
        const iterator = (await raw.value())[Symbol.asyncIterator]();

        await expect(iterator.next()).resolves.toEqual({
            value: { n: 1 },
            done: false,
        });
        await expect(iterator.next()).resolves.toEqual({
            value: { n: 2 },
            done: false,
        });
        await iterator.return?.();

        expect(seenIds).toEqual([undefined, 'evt-1']);
    });

    it('retries the initial connection and honors Retry-After', async () => {
        vi.useFakeTimers();
        try {
            const reconnect = vi.fn();
            const connector = vi.fn(async () => {
                if (connector.mock.calls.length === 1) {
                    throw new trading.ApiError(
                        new Response(null, { status: 503 }),
                        503,
                        undefined,
                        'unavailable',
                        undefined,
                        40,
                    );
                }
                return {
                    response: chunkedResponse(['data: ready\n\n']),
                    url: 'https://stream.example.test/events',
                };
            });
            const opening = SSEApiResponse.open(
                connector,
                (data) => data,
                {
                    reconnect: { initialDelayMs: 0, maxDelayMs: 100, maxAttempts: 1 },
                    onReconnect: reconnect,
                },
                { reconnect: true, bounded: true },
            );

            await vi.advanceTimersByTimeAsync(39);
            expect(connector).toHaveBeenCalledOnce();
            await vi.advanceTimersByTimeAsync(1);
            const stream = await (await opening).value();

            await expect(collect(stream)).resolves.toEqual(['ready']);
            expect(reconnect).toHaveBeenCalledWith(
                expect.objectContaining({ attempt: 1, delayMs: 40 }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it('retries an initial connect timeout', async () => {
        const connector = vi.fn(async () => {
            if (connector.mock.calls.length === 1) {
                throw new trading.FetchError(
                    new DOMException('connect timed out', 'TimeoutError'),
                );
            }
            return {
                response: chunkedResponse(['data: recovered\n\n']),
                url: 'https://stream.example.test/events',
            };
        });
        const raw = await SSEApiResponse.open(
            connector,
            (data) => data,
            {
                reconnect: { initialDelayMs: 0, maxDelayMs: 0, maxAttempts: 1 },
            },
            { reconnect: true, bounded: true },
        );

        await expect(collect(await raw.value())).resolves.toEqual(['recovered']);
        expect(connector).toHaveBeenCalledTimes(2);
    });

    it('bounds initial retries by default', async () => {
        const connector = vi.fn(async () => {
            throw new trading.ApiError(
                new Response(null, { status: 503 }),
                503,
                undefined,
                'unavailable',
            );
        });

        await expect(
            SSEApiResponse.open(
                connector,
                (data) => data,
                { reconnect: { initialDelayMs: 0, maxDelayMs: 0 } },
                { reconnect: true },
            ),
        ).rejects.toMatchObject({ status: 503 });
        expect(connector).toHaveBeenCalledTimes(3);
    });

    it('treats bounded EOF and HTTP 204 as terminal', async () => {
        for (const response of [
            chunkedResponse(['data: one\n\n']),
            new Response(null, { status: 204 }),
        ]) {
            const connector = vi.fn(async () => ({
                response,
                url: 'https://stream.example.test/events',
            }));
            const raw = await SSEApiResponse.open(
                connector,
                (data) => data,
                { reconnect: { initialDelayMs: 0, maxDelayMs: 0 } },
                { reconnect: true, bounded: response.status !== 204 },
            );

            await collect(await raw.value());
            expect(connector).toHaveBeenCalledOnce();
        }
    });

    it('honors reconnect attempt limits across connections without events', async () => {
        const connector = vi.fn(async () => ({
            response: chunkedResponse([]),
            url: 'https://stream.example.test/events',
        }));
        const raw = await SSEApiResponse.open(
            connector,
            (data) => data,
            {
                reconnect: {
                    initialDelayMs: 0,
                    maxDelayMs: 0,
                    maxAttempts: 1,
                },
            },
            { reconnect: true },
        );

        await expect(collect(await raw.value())).resolves.toEqual([]);
        expect(connector).toHaveBeenCalledTimes(2);
    });

    it('does not schedule a reconnect beyond the elapsed-time budget', async () => {
        const connector = vi.fn(async () => ({
            response: chunkedResponse([]),
            url: 'https://stream.example.test/events',
        }));
        const raw = await SSEApiResponse.open(
            connector,
            (data) => data,
            {
                reconnect: {
                    initialDelayMs: 100,
                    maxElapsedMs: 50,
                },
            },
            { reconnect: true },
        );

        await expect(collect(await raw.value())).resolves.toEqual([]);
        expect(connector).toHaveBeenCalledOnce();
    });

    it('does not deduplicate inclusive replay after reconnect', async () => {
        const connector = vi.fn(async () => ({
            response: chunkedResponse(['id: same\ndata: repeated\n\n']),
            url: 'https://stream.example.test/events',
        }));
        const raw = await SSEApiResponse.open(
            connector,
            (data) => data,
            { reconnect: { initialDelayMs: 0, maxDelayMs: 0 } },
            { reconnect: true },
        );
        const iterator = (await raw.value())[Symbol.asyncIterator]();

        await expect(iterator.next()).resolves.toMatchObject({ value: 'repeated' });
        await expect(iterator.next()).resolves.toMatchObject({ value: 'repeated' });
        await iterator.return?.();

        expect(connector.mock.calls[1]?.[0]).toBe('same');
    });

    it('cancels the reader exactly once when a consumer breaks iteration', async () => {
        const cancel = vi.fn();
        const encoder = new TextEncoder();
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode('data: first\n\n'));
                },
                cancel,
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
        );
        const raw = await SSEApiResponse.open(
            async () => ({ response, url: 'https://stream.example.test/events' }),
            (data) => data,
            { reconnect: false },
        );
        const stream = await raw.value();

        for await (const value of stream) {
            expect(value).toBe('first');
            break;
        }

        await expect(stream.closed).resolves.toEqual({ reason: 'eof' });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it.each([
        ['top-level signal', (signal: AbortSignal) => ({ signal, reconnect: false })],
        ['requestInit.signal', (signal: AbortSignal) => ({
            requestInit: { signal },
            reconnect: false,
        })],
    ])('actively cancels a pending read through %s', async (_label, options) => {
        const cancel = vi.fn();
        const controller = new AbortController();
        const raw = await SSEApiResponse.open(
            async () => ({
                response: new Response(
                    new ReadableStream<Uint8Array>({
                        pull: () => new Promise<void>(() => {}),
                        cancel,
                    }),
                    { headers: { 'Content-Type': 'text/event-stream' } },
                ),
                url: 'https://stream.example.test/events',
            }),
            (data) => data,
            options(controller.signal),
        );
        const stream = await raw.value();
        const next = stream[Symbol.asyncIterator]().next();
        await Promise.resolve();

        controller.abort(new DOMException('cancelled', 'AbortError'));

        await expect(next).resolves.toEqual({ value: undefined, done: true });
        await expect(stream.closed).resolves.toEqual({ reason: 'aborted' });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('finalizes an opened subscription aborted before consumption', async () => {
        const cancel = vi.fn();
        const controller = new AbortController();
        const raw = await SSEApiResponse.open(
            async () => ({
                response: new Response(
                    new ReadableStream<Uint8Array>({ cancel }),
                    { headers: { 'Content-Type': 'text/event-stream' } },
                ),
                url: 'https://stream.example.test/events',
            }),
            (data) => data,
            { signal: controller.signal, reconnect: false },
        );
        const stream = await raw.value();

        controller.abort(new DOMException('cancelled', 'AbortError'));

        await expect(stream.closed).resolves.toEqual({ reason: 'aborted' });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('actively cancels a pending read at maxDurationMs', async () => {
        vi.useFakeTimers();
        try {
            const cancel = vi.fn();
            const raw = await SSEApiResponse.open(
                async () => ({
                    response: new Response(
                        new ReadableStream<Uint8Array>({
                            pull: () => new Promise<void>(() => {}),
                            cancel,
                        }),
                        { headers: { 'Content-Type': 'text/event-stream' } },
                    ),
                    url: 'https://stream.example.test/events',
                }),
                (data) => data,
                { maxDurationMs: 10, reconnect: false },
            );
            const stream = await raw.value();
            const next = stream[Symbol.asyncIterator]().next();

            await vi.advanceTimersByTimeAsync(10);

            await expect(next).resolves.toEqual({ value: undefined, done: true });
            await expect(stream.closed).resolves.toEqual({ reason: 'aborted' });
            expect(cancel).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it.each([
        ['top-level signal', (signal: AbortSignal) => ({ signal })],
        ['requestInit.signal', (signal: AbortSignal) => ({
            requestInit: { signal },
        })],
    ])('cancels an initial reconnect sleep promptly through %s', async (_label, signalOptions) => {
        vi.useFakeTimers();
        try {
            const controller = new AbortController();
            const connector = vi.fn(async () => {
                throw new trading.ApiError(
                    new Response(null, { status: 503 }),
                    503,
                    undefined,
                    'unavailable',
                );
            });
            const opening = SSEApiResponse.open(
                connector,
                (data) => data,
                {
                    ...signalOptions(controller.signal),
                    reconnect: { initialDelayMs: 10_000, maxDelayMs: 10_000 },
                },
                { reconnect: true },
            );
            await Promise.resolve();

            controller.abort(new DOMException('cancelled', 'AbortError'));

            await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
            expect(connector).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('rejects an already-aborted subscription before invoking the connector', async () => {
        const controller = new AbortController();
        controller.abort(new DOMException('cancelled', 'AbortError'));
        const connector = vi.fn(async () => ({
            response: chunkedResponse([]),
            url: 'https://stream.example.test/events',
        }));

        await expect(
            SSEApiResponse.open(connector, (data) => data, {
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(connector).not.toHaveBeenCalled();
    });

    it('rejects and disposes a connector response that resolves after cancellation', async () => {
        const controller = new AbortController();
        const cancel = vi.fn();
        let resolveConnection!: (connection: {
            response: Response;
            url: string;
        }) => void;
        const connector = vi.fn(
            () =>
                new Promise<{ response: Response; url: string }>((resolve) => {
                    resolveConnection = resolve;
                }),
        );
        const opening = SSEApiResponse.open(
            connector,
            (data) => data,
            { signal: controller.signal, reconnect: false },
        );
        await Promise.resolve();

        controller.abort(new DOMException('cancelled', 'AbortError'));
        resolveConnection({
            response: new Response(
                new ReadableStream<Uint8Array>({ cancel }),
                { headers: { 'Content-Type': 'text/event-stream' } },
            ),
            url: 'https://stream.example.test/events',
        });

        await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it.each(['top-level', 'nested'])(
        'composes top-level and nested signals when the %s signal aborts',
        async (source) => {
            const topLevel = new AbortController();
            const nested = new AbortController();
            const cancel = vi.fn();
            const raw = await SSEApiResponse.open(
                async () => ({
                    response: new Response(
                        new ReadableStream<Uint8Array>({
                            pull: () => new Promise<void>(() => {}),
                            cancel,
                        }),
                        {
                            headers: {
                                'Content-Type': 'text/event-stream',
                            },
                        },
                    ),
                    url: 'https://stream.example.test/events',
                }),
                (data) => data,
                {
                    signal: topLevel.signal,
                    requestInit: { signal: nested.signal },
                    reconnect: false,
                },
            );
            const next = raw.value().then((stream) =>
                stream[Symbol.asyncIterator]().next(),
            );
            await Promise.resolve();

            (source === 'top-level' ? topLevel : nested).abort(
                new DOMException('cancelled', 'AbortError'),
            );

            await expect(next).resolves.toEqual({
                value: undefined,
                done: true,
            });
            expect(cancel).toHaveBeenCalledOnce();
        },
    );

    it('enforces single-consumer semantics across data and message iterators', async () => {
        const raw = await SSEApiResponse.open(
            async () => ({
                response: chunkedResponse(['data: one\n\n']),
                url: 'https://stream.example.test/events',
            }),
            (data) => data,
            { reconnect: false },
        );
        const stream = await raw.value();

        await expect(collect(stream.messages())).resolves.toHaveLength(1);
        await expect(collect(stream)).rejects.toThrow(
            'An SSE subscription can only be consumed once',
        );
    });

    it('ignores NUL ids and incomplete events at EOF', async () => {
        const raw = await SSEApiResponse.open(
            async () => ({
                response: chunkedResponse([
                    'id: kept\ndata: first\n\nid: ignored\u0000value\ndata: second\n\nid: not-dispatched\ndata: incomplete',
                ]),
                url: 'https://stream.example.test/events',
            }),
            (data) => data,
            { reconnect: false },
        );
        const stream = await raw.value();

        await expect(collect(stream.messages())).resolves.toEqual([
            { data: 'first', id: 'kept', event: undefined, retry: undefined },
            { data: 'second', id: 'kept', event: undefined, retry: undefined },
        ]);
        expect(stream.lastEventId).toBe('kept');
    });

    it('honors the server retry field before reconnecting', async () => {
        vi.useFakeTimers();
        try {
            let attempt = 0;
            const reconnect = vi.fn();
            const connector = vi.fn(async () => {
                attempt += 1;
                return {
                    response: chunkedResponse([
                        attempt === 1
                            ? 'retry: 25\ndata: first\n\n'
                            : 'data: second\n\n',
                    ]),
                    url: 'https://stream.example.test/events',
                };
            });
            const raw = await SSEApiResponse.open(
                connector,
                (data) => data,
                {
                    reconnect: { initialDelayMs: 0, maxDelayMs: 100 },
                    onReconnect: reconnect,
                },
                { reconnect: true },
            );
            const iterator = (await raw.value())[Symbol.asyncIterator]();

            await expect(iterator.next()).resolves.toMatchObject({ value: 'first' });
            const next = iterator.next();
            await vi.advanceTimersByTimeAsync(24);
            expect(connector).toHaveBeenCalledOnce();
            await vi.advanceTimersByTimeAsync(1);
            await expect(next).resolves.toMatchObject({ value: 'second' });
            await iterator.return?.();

            expect(reconnect).toHaveBeenCalledWith(
                expect.objectContaining({ delayMs: 25 }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it('persists the server retry interval across connections', async () => {
        vi.useFakeTimers();
        try {
            let attempt = 0;
            const reconnect = vi.fn();
            const connector = vi.fn(async () => {
                attempt += 1;
                return {
                    response: chunkedResponse([
                        attempt === 1
                            ? 'retry: 25\ndata: first\n\n'
                            : `data: event-${attempt}\n\n`,
                    ]),
                    url: 'https://stream.example.test/events',
                };
            });
            const raw = await SSEApiResponse.open(
                connector,
                (data) => data,
                {
                    reconnect: { initialDelayMs: 0, maxDelayMs: 100 },
                    onReconnect: reconnect,
                },
                { reconnect: true },
            );
            const iterator = (await raw.value()).messages()[Symbol.asyncIterator]();

            await expect(iterator.next()).resolves.toMatchObject({
                value: { data: 'first', retry: 25 },
            });
            const second = iterator.next();
            await vi.advanceTimersByTimeAsync(25);
            await expect(second).resolves.toMatchObject({
                value: { data: 'event-2', retry: 25 },
            });
            const third = iterator.next();
            await vi.advanceTimersByTimeAsync(25);
            await expect(third).resolves.toMatchObject({
                value: { data: 'event-3', retry: 25 },
            });
            await iterator.return?.();

            expect(reconnect).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ delayMs: 25 }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it('cancels and reconnects a connection after the configured idle timeout', async () => {
        vi.useFakeTimers();
        try {
            const cancel = vi.fn();
            let attempt = 0;
            const connector = vi.fn(async () => {
                attempt += 1;
                return {
                    response:
                        attempt === 1
                            ? new Response(new ReadableStream({ cancel }), {
                                  headers: {
                                      'Content-Type': 'text/event-stream',
                                  },
                              })
                            : chunkedResponse(['data: recovered\n\n']),
                    url: 'https://stream.example.test/events',
                };
            });
            const raw = await SSEApiResponse.open(
                connector,
                (data) => data,
                {
                    idleTimeoutMs: 10,
                    reconnect: { initialDelayMs: 0, maxDelayMs: 0 },
                },
                { reconnect: true },
            );
            const iterator = (await raw.value())[Symbol.asyncIterator]();
            const next = iterator.next();

            await vi.advanceTimersByTimeAsync(10);
            await vi.runOnlyPendingTimersAsync();
            await expect(next).resolves.toMatchObject({ value: 'recovered' });
            await iterator.return?.();

            expect(cancel).toHaveBeenCalledOnce();
            expect(connector).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('generated SSE operation metadata', () => {
    it('merges legacy top-level RequestInit fields with generated SSE headers', async () => {
        let seenInit: RequestInit | undefined;
        const api = new trading.EventsApi(
            new trading.Configuration({
                keyId: 'AKTEST',
                secret: 'sekret',
                headers: { 'X-Configured': 'configured' },
                userAgent: 'alpaca-sse-test',
                fetchApi: async (_url, init) => {
                    seenInit = init;
                    return chunkedResponse([]);
                },
            }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            {
                headers: {
                    Authorization: 'Bearer custom',
                    'X-Compatibility': 'preserved',
                },
                requestInit: {
                    headers: { 'X-Nested': 'nested' },
                },
                credentials: 'include',
                reconnect: false,
            },
        );

        expect(new Headers(seenInit?.headers).get('X-Compatibility')).toBe(
            'preserved',
        );
        expect(new Headers(seenInit?.headers).get('X-Nested')).toBe('nested');
        expect(new Headers(seenInit?.headers).get('Authorization')).toBe(
            'Bearer custom',
        );
        expect(new Headers(seenInit?.headers).get('Accept')).toBe(
            'text/event-stream',
        );
        expect(new Headers(seenInit?.headers).get('APCA-API-KEY-ID')).toBe(
            'AKTEST',
        );
        expect(
            new Headers(seenInit?.headers).get('APCA-API-SECRET-KEY'),
        ).toBe('sekret');
        expect(new Headers(seenInit?.headers).get('X-Configured')).toBe(
            'configured',
        );
        expect(new Headers(seenInit?.headers).get('User-Agent')).toBe(
            'alpaca-sse-test',
        );
        expect(seenInit?.credentials).toBe('include');
        stream.close();
    });

    it.each([
        ['updates', 'id: fresh-1\ndata: {}\n\n', 'fresh-1'],
        ['resets', 'id:\ndata: {}\n\n', null],
    ])(
        '%s a custom initial Last-Event-ID before reconnecting',
        async (_behavior, firstBody, expectedReconnectId) => {
            const seenIds: Array<string | null> = [];
            let attempt = 0;
            const api = new trading.EventsApi(
                new trading.Configuration({
                    fetchApi: async (_url, init) => {
                        seenIds.push(
                            new Headers(init?.headers).get('Last-Event-ID'),
                        );
                        attempt += 1;
                        return attempt === 1
                            ? chunkedResponse([firstBody])
                            : new Response(null, { status: 204 });
                    },
                }),
            );

            const stream = await api.subscribeToActivitiesSSE(
                {},
                {
                    headers: { 'Last-Event-ID': 'stale-initial-id' },
                    reconnect: { initialDelayMs: 0, maxDelayMs: 0 },
                },
            );

            expect(stream.lastEventId).toBe('stale-initial-id');
            await expect(collect(stream)).resolves.toHaveLength(1);
            expect(seenIds).toEqual([
                'stale-initial-id',
                expectedReconnectId,
            ]);
        },
    );

    it('refreshes function-backed API credentials before each reconnect', async () => {
        let credentialCall = 0;
        let attempt = 0;
        const seenCredentials: Array<[string | null, string | null]> = [];
        const api = new trading.EventsApi(
            new trading.Configuration({
                apiKey: async (name) => `${name}-${++credentialCall}`,
                fetchApi: async (_url, init) => {
                    const headers = new Headers(init?.headers);
                    seenCredentials.push([
                        headers.get('APCA-API-KEY-ID'),
                        headers.get('APCA-API-SECRET-KEY'),
                    ]);
                    attempt += 1;
                    return attempt === 1
                        ? chunkedResponse(['data: {}\n\n'])
                        : new Response(null, { status: 204 });
                },
            }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            { reconnect: { initialDelayMs: 0, maxDelayMs: 0 } },
        );

        await expect(collect(stream)).resolves.toHaveLength(1);
        expect(credentialCall).toBe(4);
        expect(seenCredentials).toEqual([
            ['APCA-API-KEY-ID-1', 'APCA-API-SECRET-KEY-2'],
            ['APCA-API-KEY-ID-3', 'APCA-API-SECRET-KEY-4'],
        ]);
    });

    it('lets nested headers override the observable initial Last-Event-ID', async () => {
        let seenId: string | null = null;
        const api = new trading.EventsApi(
            new trading.Configuration({
                fetchApi: async (_url, init) => {
                    seenId = new Headers(init?.headers).get('Last-Event-ID');
                    return chunkedResponse([]);
                },
            }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            {
                headers: { 'last-event-id': 'top-level' },
                requestInit: {
                    headers: { 'Last-Event-ID': 'nested' },
                },
                reconnect: false,
            },
        );

        expect(stream.lastEventId).toBe('nested');
        expect(seenId).toBe('nested');
        stream.close();
    });

    it('does not call credential providers for explicit SSE auth headers', async () => {
        const apiKey = vi.fn(async () => {
            throw new Error('credential provider should not run');
        });
        const fetchApi = vi.fn(async () => chunkedResponse([]));
        const api = new trading.EventsApi(
            new trading.Configuration({ apiKey, fetchApi }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            {
                headers: {
                    'APCA-API-KEY-ID': 'explicit-key',
                },
                requestInit: {
                    headers: {
                        'APCA-API-SECRET-KEY': 'explicit-secret',
                    },
                },
                reconnect: false,
            },
        );

        expect(apiKey).not.toHaveBeenCalled();
        const headers = new Headers(fetchApi.mock.calls[0]?.[1]?.headers);
        expect(headers.get('APCA-API-KEY-ID')).toBe('explicit-key');
        expect(headers.get('APCA-API-SECRET-KEY')).toBe('explicit-secret');
        stream.close();
    });

    it('does not call an access-token provider for explicit SSE Authorization', async () => {
        const accessToken = vi.fn(async () => {
            throw new Error('access-token provider should not run');
        });
        const fetchApi = vi.fn(async () => chunkedResponse([]));
        const api = new trading.EventsApi(
            new trading.Configuration({ accessToken, fetchApi }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            {
                headers: {
                    Authorization: 'Bearer explicit',
                },
                reconnect: false,
            },
        );

        expect(accessToken).not.toHaveBeenCalled();
        expect(
            new Headers(fetchApi.mock.calls[0]?.[1]?.headers).get(
                'Authorization',
            ),
        ).toBe('Bearer explicit');
        stream.close();
    });

    it.each([
        ['caller cancellation', 'abort'],
        ['connection timeout', 'connect-timeout'],
        ['maximum duration', 'max-duration'],
    ] as const)(
        'bounds a credential provider that never settles through %s',
        async (_label, mode) => {
            vi.useFakeTimers();
            try {
                const apiKey = vi.fn(
                    async () => new Promise<string>(() => {}),
                );
                const fetchApi = vi.fn(async () => chunkedResponse([]));
                const api = new trading.EventsApi(
                    new trading.Configuration({ apiKey, fetchApi }),
                );
                const controller = new AbortController();
                const opening = api.subscribeToActivitiesSSE(
                    {},
                    {
                        signal:
                            mode === 'abort'
                                ? controller.signal
                                : undefined,
                        connectTimeoutMs:
                            mode === 'connect-timeout' ? 10 : undefined,
                        maxDurationMs:
                            mode === 'max-duration' ? 10 : undefined,
                        reconnect: false,
                    },
                );
                await Promise.resolve();

                if (mode === 'abort') {
                    const rejected = expect(opening).rejects.toMatchObject({
                        name: 'AbortError',
                    });
                    controller.abort(
                        new DOMException('cancelled', 'AbortError'),
                    );
                    await rejected;
                } else {
                    const rejected = expect(opening).rejects.toSatisfy(
                        (error: unknown) => {
                            const candidate = error as {
                                name?: string;
                                cause?: { name?: string };
                            };
                            return (
                                candidate.name === 'TimeoutError' ||
                                candidate.cause?.name === 'TimeoutError'
                            );
                        },
                    );
                    await vi.advanceTimersByTimeAsync(10);
                    await rejected;
                }
                expect(apiKey).toHaveBeenCalledOnce();
                expect(fetchApi).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        },
    );

    it('bounds and cancels oversized SSE error bodies', async () => {
        const cancel = vi.fn();
        const body = new Uint8Array(70 * 1024);
        const api = new marketData.CorporateActionsApi(
            new marketData.Configuration({
                fetchApi: async () =>
                    new Response(
                        new ReadableStream<Uint8Array>({
                            start(controller) {
                                controller.enqueue(body);
                            },
                            cancel,
                        }),
                        {
                            status: 503,
                            headers: {
                                'Content-Type': 'application/json',
                                'Retry-After': '1',
                                'X-Request-ID': 'request-id',
                            },
                        },
                    ),
            }),
        );

        await expect(
            api.subscribeToCorporateActionsEventsSSE(
                {},
                { reconnect: false, maxErrorBodyBytes: 1024 },
            ),
        ).rejects.toMatchObject({
            status: 503,
            retryAfterMs: 1000,
            requestId: 'request-id',
        });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('uses the default connection deadline for a non-2xx body that never ends', async () => {
        vi.useFakeTimers();
        const cancel = vi.fn();
        try {
            const api = new marketData.CorporateActionsApi(
                new marketData.Configuration({
                    fetchApi: async () =>
                        new Response(
                            new ReadableStream<Uint8Array>({
                                start(controller) {
                                    controller.enqueue(
                                        new TextEncoder().encode('{"message":"partial'),
                                    );
                                },
                                cancel,
                            }),
                            {
                                status: 503,
                                headers: { 'X-Request-ID': 'request-id' },
                            },
                        ),
                }),
            );

            const opening = api.subscribeToCorporateActionsEventsSSE(
                {},
                {
                    reconnect: false,
                    maxErrorBodyBytes: 1024,
                },
            );
            const rejected = expect(opening).rejects.toMatchObject({
                status: 503,
                requestId: 'request-id',
            });

            await vi.advanceTimersByTimeAsync(30_000);
            await rejected;
            expect(cancel).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('deserializes snake_case activity detail unions into typed models', async () => {
        const api = new trading.EventsApi(
            new trading.Configuration({
                fetchApi: async () =>
                    chunkedResponse([
                        'data: {"activity_type":"TRD","at":"2026-01-02T14:43:59Z","currency":"USD","event_id":"evt-1","executed_at":"2026-01-02T14:43:59Z","ref_id":"ref-1","settle_date":"2026-01-05","status":"executed","details":{"asset_id":"asset-1","cum_qty":"1","execution_type":"fill","leaves_qty":"0","order_id":"order-1","order_status":"filled","side":"buy","symbol":"AAPL"}}\n\n',
                    ]),
            }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            { reconnect: false },
        );

        await expect(collect(stream)).resolves.toEqual([
            expect.objectContaining({
                activityType: 'TRD',
                details: expect.objectContaining({
                    assetId: 'asset-1',
                    cumQty: '1',
                    orderId: 'order-1',
                    symbol: 'AAPL',
                }),
            }),
        ]);
    });

    it('preserves string-valued dividend flags through the activity SSE client', async () => {
        const api = new trading.EventsApi(
            new trading.Configuration({
                fetchApi: async () =>
                    chunkedResponse([
                        'data: {"activity_type":"DIV","activity_subtype":"CDIV","at":"2026-01-02T14:43:59Z","currency":"USD","event_id":"evt-div-1","executed_at":"2026-01-02T14:43:59Z","ref_id":"ref-div-1","settle_date":"2026-01-05","status":"executed","details":{"system_date":"2026-01-02","position_date":"2026-01-02","cusip":"037833100","rate":"0.24","foreign":"false","special":"true","symbol":"AAPL","cash_payout":"24","entitled_qty":"100"}}\n\n',
                    ]),
            }),
        );

        const stream = await api.subscribeToActivitiesSSE(
            {},
            { reconnect: false },
        );

        await expect(collect(stream)).resolves.toEqual([
            expect.objectContaining({
                activityType: 'DIV',
                activitySubtype: 'CDIV',
                details: expect.objectContaining({
                    foreign: 'false',
                    special: 'true',
                }),
            }),
        ]);
    });

    it.each([
        [false, 'https://stream.data.alpaca.markets'],
        [true, 'https://stream.data.sandbox.alpaca.markets'],
    ])(
        'selects the corporate-actions operation host (sandbox=%s)',
        async (sandbox, expectedHost) => {
            let seenUrl = '';
            let seenInit: RequestInit | undefined;
            const api = new marketData.CorporateActionsApi(
                new marketData.Configuration({
                    sandbox,
                    fetchApi: async (url, init) => {
                        seenUrl = String(url);
                        seenInit = init;
                        return chunkedResponse([]);
                    },
                }),
            );

            const stream = await api.subscribeToCorporateActionsEventsSSE(
                { lastEventId: 'resume-from-here' },
                { reconnect: false },
            );

            expect(seenUrl).toBe(
                `${expectedHost}/v1beta1/events/corporate-actions`,
            );
            expect(new Headers(seenInit?.headers).get('Last-Event-Id')).toBe(
                'resume-from-here',
            );
            stream.close();
        },
    );
});

describe('ergonomic SSE facade', () => {
    it('forwards trading activity filters and SSE options to the generated operation', async () => {
        let seenUrl = '';
        let seenInit: RequestInit | undefined;
        const alpaca = new Alpaca({
            keyId: 'AKTEST',
            secret: 'sekret',
            fetchApi: async (url, init) => {
                seenUrl = String(url);
                seenInit = init;
                return chunkedResponse([]);
            },
        });
        const since = new Date('2026-01-02T03:04:05.000Z');

        const stream = await alpaca.trading.subscribeActivities(
            { since },
            {
                headers: { 'X-Correlation-ID': 'correlation-1' },
                reconnect: false,
            },
        );

        const url = new URL(seenUrl);
        expect(url.pathname).toBe('/v2beta1/events/activities');
        expect(url.searchParams.get('since')).toBe(since.toISOString());
        const headers = new Headers(seenInit?.headers);
        expect(headers.get('X-Correlation-ID')).toBe('correlation-1');
        expect(headers.get('APCA-API-KEY-ID')).toBe('AKTEST');
        expect(headers.get('APCA-API-SECRET-KEY')).toBe('sekret');
        stream.close();
    });

    it('forwards corporate-action filters and inherits sandbox host selection', async () => {
        let seenUrl = '';
        const alpaca = new Alpaca({
            keyId: 'AKTEST',
            secret: 'sekret',
            sandbox: true,
            fetchApi: async (url) => {
                seenUrl = String(url);
                return chunkedResponse([]);
            },
        });

        const stream = await alpaca.marketData.subscribeCorporateActions(
            {
                region: 'us',
                type: ['cash_dividend_corporateaction_event'],
            },
            { reconnect: false },
        );

        const url = new URL(seenUrl);
        expect(url.origin).toBe('https://stream.data.sandbox.alpaca.markets');
        expect(url.pathname).toBe('/v1beta1/events/corporate-actions');
        expect(url.searchParams.get('region')).toBe('us');
        expect(url.searchParams.get('type')).toBe(
            'cash_dividend_corporateaction_event',
        );
        stream.close();
    });
});
