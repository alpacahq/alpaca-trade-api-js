import { afterEach, describe, expect, it, vi } from 'vitest';
import { decode as mpDecode, encode as mpEncode } from '@msgpack/msgpack';

import * as streaming from '../src/streaming';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

/** Minimal fake satisfying WebSocketLike, with event injection + sent capture. */
class FakeSocket {
    sent: Array<string | Uint8Array> = [];
    listeners: Record<string, Array<(...args: any[]) => void>> = {};
    pings = 0;
    terminated = false;
    closed = false;

    on(event: string, cb: (...args: any[]) => void): this {
        (this.listeners[event] ??= []).push(cb);
        return this;
    }
    emitEvent(event: string, ...args: any[]): void {
        (this.listeners[event] ?? []).forEach((cb) => cb(...args));
    }
    send(data: string | Uint8Array): void {
        this.sent.push(data);
    }
    close(): void {
        this.closed = true;
        this.emitEvent('close');
    }
    terminate(): void {
        this.terminated = true;
    }
    ping(): void {
        this.pings++;
    }
}

function sentMsgpack(sock: FakeSocket): any[] {
    return sock.sent.map((d) => mpDecode(d as Uint8Array) as any);
}
function sentJson(sock: FakeSocket): any[] {
    return sock.sent.map((d) => JSON.parse(d as string));
}
function findFrame(frames: any[], action: string): any {
    return frames.find((f) => f.action === action);
}

/** Drive a market-data socket to the authenticated state. */
function authenticateMd(sock: FakeSocket): void {
    sock.emitEvent('open');
    sock.emitEvent('message', mpEncode([{ T: 'success', msg: 'connected' }]));
    sock.emitEvent('message', mpEncode([{ T: 'success', msg: 'authenticated' }]));
}

/** Drive a trading socket to the authorized state. */
function authorizeTrading(sock: FakeSocket): void {
    sock.emitEvent('open');
    sock.emitEvent('message', JSON.stringify({ stream: 'authorization', data: { status: 'authorized' } }));
}

/** A wsFactory that records every socket it hands out. */
function trackingFactory(sockets: FakeSocket[]): () => FakeSocket {
    return () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('StockDataStream (market data)', () => {
    it('sends a msgpack auth frame on open', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            feed: 'iex',
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.connect();
        sock.emitEvent('open');

        const auth = findFrame(sentMsgpack(sock), 'auth');
        expect(auth).toEqual({ action: 'auth', key: 'AKTEST', secret: 'sekret' });
    });

    it('builds the data URL from the feed', () => {
        let seenUrl = '';
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            feed: 'sip',
            pingIntervalMs: 0,
            wsFactory: (url) => {
                seenUrl = url;
                return new FakeSocket();
            },
        });
        stream.connect();
        expect(seenUrl).toBe('wss://stream.data.alpaca.markets/v2/sip');
    });

    it('subscribes for queued symbols once authenticated', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.subscribeForBars(['AAPL', 'MSFT']);
        stream.connect();
        authenticateMd(sock);

        const sub = findFrame(sentMsgpack(sock), 'subscribe');
        expect(sub.bars).toEqual(['AAPL', 'MSFT']);
    });

    it('sends an incremental subscribe after authentication', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.connect();
        authenticateMd(sock);
        stream.subscribeForQuotes(['TSLA']);

        const subs = sentMsgpack(sock).filter((f) => f.action === 'subscribe');
        expect(subs.at(-1)).toEqual({ action: 'subscribe', quotes: ['TSLA'] });
    });

    it('maps and emits typed trade/quote/bar events', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const trades: streaming.StreamTrade[] = [];
        const bars: streaming.StreamBar[] = [];
        stream.onTrade((t) => trades.push(t));
        stream.onBar((b) => bars.push(b));
        stream.connect();
        authenticateMd(sock);

        const ts = new Date('2026-01-02T15:04:05Z');
        sock.emitEvent(
            'message',
            mpEncode([
                { T: 't', S: 'AAPL', i: 42, x: 'V', p: 187.25, s: 100, t: ts, c: ['@'], z: 'C' },
                { T: 'b', S: 'AAPL', o: 1, h: 2, l: 0.5, c: 1.5, v: 1000, t: ts, vw: 1.4, n: 10 },
            ]),
        );

        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({ symbol: 'AAPL', id: 42, price: 187.25, size: 100, tape: 'C' });
        expect(trades[0].timestamp).toBeInstanceOf(Date);
        expect(bars[0]).toMatchObject({ symbol: 'AAPL', open: 1, high: 2, low: 0.5, close: 1.5, volume: 1000, vwap: 1.4, tradeCount: 10 });
    });

    it('maps numeric error codes to messages', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const errors: string[] = [];
        stream.onError((e) => errors.push(e));
        stream.connect();
        sock.emitEvent('open');
        sock.emitEvent('message', mpEncode([{ T: 'error', code: 402, msg: 'auth failed' }]));

        expect(errors).toContain('auth failed');
    });

    it('re-subscribes with full state after a reconnect', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            backoff: false,
            reconnectJitter: 0,
            wsFactory: () => {
                const s = new FakeSocket();
                sockets.push(s);
                return s;
            },
        });
        stream.subscribeForTrades(['AAPL']);
        stream.connect();
        authenticateMd(sockets[0]);

        // Drop the connection; reconnect is scheduled at the initial 1s delay.
        sockets[0].emitEvent('close');
        vi.advanceTimersByTime(1000);
        expect(sockets).toHaveLength(2);

        authenticateMd(sockets[1]);
        const sub = findFrame(sentMsgpack(sockets[1]), 'subscribe');
        expect(sub.trades).toEqual(['AAPL']);
    });

    it('pings on an interval and terminates when no pong arrives', () => {
        vi.useFakeTimers();
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 10_000,
            pongWaitMs: 5_000,
            reconnect: false,
            wsFactory: () => sock,
        });
        stream.connect();
        sock.emitEvent('open');

        vi.advanceTimersByTime(10_000);
        expect(sock.pings).toBe(1);

        // Pong never arrives -> socket terminated.
        vi.advanceTimersByTime(5_000);
        expect(sock.terminated).toBe(true);
    });

    it('clears the pong timeout when a pong is received', () => {
        vi.useFakeTimers();
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 10_000,
            pongWaitMs: 5_000,
            reconnect: false,
            wsFactory: () => sock,
        });
        stream.connect();
        sock.emitEvent('open');
        vi.advanceTimersByTime(10_000);
        sock.emitEvent('pong');
        vi.advanceTimersByTime(5_000);
        expect(sock.terminated).toBe(false);
    });
});

describe('CryptoDataStream / NewsStream URLs', () => {
    it('derives crypto and news endpoints', () => {
        const urls: string[] = [];
        const factory = (url: string) => {
            urls.push(url);
            return new FakeSocket();
        };
        new streaming.CryptoDataStream({ credentials: CREDS, pingIntervalMs: 0, wsFactory: factory }).connect();
        new streaming.NewsStream({ credentials: CREDS, pingIntervalMs: 0, wsFactory: factory }).connect();
        expect(urls[0]).toBe('wss://stream.data.alpaca.markets/v1beta3/crypto/us');
        expect(urls[1]).toBe('wss://stream.data.alpaca.markets/v1beta1/news');
    });

    it('uses the market-data sandbox host when sandbox is set', () => {
        const urls: string[] = [];
        const factory = (url: string) => {
            urls.push(url);
            return new FakeSocket();
        };
        expect(streaming.MARKET_DATA_STREAM_SANDBOX_HOST).toBe('wss://stream.data.sandbox.alpaca.markets');
        new streaming.StockDataStream({ credentials: CREDS, feed: 'iex', sandbox: true, pingIntervalMs: 0, wsFactory: factory }).connect();
        new streaming.CryptoDataStream({ credentials: CREDS, sandbox: true, pingIntervalMs: 0, wsFactory: factory }).connect();
        expect(urls[0]).toBe('wss://stream.data.sandbox.alpaca.markets/v2/iex');
        expect(urls[1]).toBe('wss://stream.data.sandbox.alpaca.markets/v1beta3/crypto/us');
    });
});

describe('TradingStream (order updates)', () => {
    it('sends a JSON authenticate frame then listens for trade_updates', () => {
        const sock = new FakeSocket();
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            paper: true,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.subscribeTradeUpdates();
        stream.connect();
        sock.emitEvent('open');

        const auth = findFrame(sentJson(sock), 'authenticate');
        expect(auth).toEqual({ action: 'authenticate', data: { key_id: 'AKTEST', secret_key: 'sekret' } });

        sock.emitEvent('message', JSON.stringify({ stream: 'authorization', data: { status: 'authorized' } }));
        const listen = findFrame(sentJson(sock), 'listen');
        expect(listen).toEqual({ action: 'listen', data: { streams: ['trade_updates'] } });
    });

    it('uses the live endpoint when paper is false', () => {
        let seenUrl = '';
        new streaming.TradingStream({
            credentials: CREDS,
            paper: false,
            pingIntervalMs: 0,
            wsFactory: (url) => {
                seenUrl = url;
                return new FakeSocket();
            },
        }).connect();
        expect(seenUrl).toBe('wss://api.alpaca.markets/stream');
    });

    it('maps trade_updates payloads', () => {
        const sock = new FakeSocket();
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const updates: streaming.TradeUpdate[] = [];
        stream.onTradeUpdate((u) => updates.push(u));
        stream.subscribeTradeUpdates();
        stream.connect();
        sock.emitEvent('open');
        sock.emitEvent('message', JSON.stringify({ stream: 'authorization', data: { status: 'authorized' } }));
        sock.emitEvent(
            'message',
            JSON.stringify({
                stream: 'trade_updates',
                data: { event: 'fill', price: '187.25', qty: '10', order: { symbol: 'AAPL' } },
            }),
        );

        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatchObject({ event: 'fill', price: '187.25', qty: '10' });
        expect(updates[0].order.symbol).toBe('AAPL');
    });

    it('errors and disconnects on failed authorization', () => {
        const sock = new FakeSocket();
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnect: false,
            wsFactory: () => sock,
        });
        const errors: string[] = [];
        stream.onError((e) => errors.push(e));
        stream.connect();
        sock.emitEvent('open');
        sock.emitEvent('message', JSON.stringify({ stream: 'authorization', data: { status: 'unauthorized' } }));

        expect(errors).toContain('auth failed');
        expect(sock.closed).toBe(true);
    });
});

describe('credential validation', () => {
    it('throws when credentials are incomplete', () => {
        expect(
            () => new streaming.StockDataStream({ credentials: { keyId: '', secret: '' } as any }),
        ).toThrow(/credentials/i);
    });
});

describe('base lifecycle & transport', () => {
    it('walks through the lifecycle states', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnect: false,
            wsFactory: () => sock,
        });
        expect(stream.getState()).toBe(streaming.STATE.DISCONNECTED);
        stream.connect();
        expect(stream.getState()).toBe(streaming.STATE.CONNECTING);
        sock.emitEvent('open');
        expect(stream.getState()).toBe(streaming.STATE.CONNECTED);
        sock.emitEvent('message', mpEncode([{ T: 'success', msg: 'authenticated' }]));
        expect(stream.getState()).toBe(streaming.STATE.AUTHENTICATED);
        stream.disconnect();
        expect(stream.getState()).toBe(streaming.STATE.DISCONNECTED);
    });

    it('fires onConnect / onDisconnect / onStateChange / AUTHORIZED listeners', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnect: false,
            wsFactory: () => sock,
        });
        const states: string[] = [];
        let connected = false;
        let disconnected = false;
        let authorized = false;
        stream.onStateChange((s) => states.push(s));
        stream.onConnect(() => (connected = true));
        stream.onDisconnect(() => (disconnected = true));
        stream.on(streaming.EVENT.AUTHORIZED, () => (authorized = true));

        stream.connect();
        authenticateMd(sock);
        stream.disconnect();

        expect(connected).toBe(true);
        expect(authorized).toBe(true);
        expect(disconnected).toBe(true);
        expect(states).toContain(streaming.STATE.CONNECTING);
        expect(states).toContain(streaming.STATE.AUTHENTICATED);
        expect(states).toContain(streaming.STATE.DISCONNECTED);
    });

    it('disconnect() closes the socket and suppresses auto-reconnect', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: trackingFactory(sockets),
        });
        stream.connect();
        authenticateMd(sockets[0]);
        stream.disconnect();

        expect(sockets[0].closed).toBe(true);
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(1);
    });

    it('does not reconnect when reconnect is disabled', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnect: false,
            wsFactory: trackingFactory(sockets),
        });
        stream.connect();
        authenticateMd(sockets[0]);
        sockets[0].emitEvent('close');
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(1);
    });

    it('grows the reconnect backoff delay exponentially between attempts', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            backoff: true,
            reconnectJitter: 0,
            wsFactory: trackingFactory(sockets),
        });
        stream.connect();

        // First drop: scheduled with the initial 1s delay.
        sockets[0].emitEvent('close');
        vi.advanceTimersByTime(999);
        expect(sockets).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(2);

        // Second drop: delay doubled to 2s.
        sockets[1].emitEvent('close');
        vi.advanceTimersByTime(1999);
        expect(sockets).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(3);
    });

    it('stops reconnecting after maxReconnectAttempts is reached', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            backoff: false,
            reconnectJitter: 0,
            maxReconnectAttempts: 2,
            wsFactory: trackingFactory(sockets),
        });
        stream.connect();

        // Two reconnects are allowed, then it gives up.
        for (let i = 0; i < 5; i++) {
            sockets[sockets.length - 1].emitEvent('close');
            vi.advanceTimersByTime(1000);
        }
        // initial socket + 2 reconnect attempts = 3 total.
        expect(sockets).toHaveLength(3);
    });

    it('treats a market-data auth failure as terminal (no reconnect)', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnectJitter: 0,
            wsFactory: trackingFactory(sockets),
        });
        const errors: string[] = [];
        stream.onError((e) => errors.push(e));
        stream.connect();
        sockets[0].emitEvent('open');
        // 402 = auth failed -> terminal.
        sockets[0].emitEvent('message', mpEncode([{ T: 'error', code: 402, msg: 'auth failed' }]));

        expect(errors).toContain('auth failed');
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(1); // never reconnected
    });

    it('is idempotent: a second connect() while connected is a no-op', () => {
        const sockets: FakeSocket[] = [];
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: trackingFactory(sockets),
        });
        stream.connect();
        stream.connect();
        expect(sockets).toHaveLength(1);
    });

    it('emits an error when a frame cannot be decoded', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const errors: string[] = [];
        stream.onError((e) => errors.push(e));
        stream.connect();
        sock.emitEvent('open');
        // 0xc1 is a reserved/never-used msgpack byte -> decode throws.
        sock.emitEvent('message', new Uint8Array([0xc1]));
        expect(errors.some((e) => /failed to decode message/.test(e))).toBe(true);
    });

    it('surfaces socket-level error events via onError', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const errors: string[] = [];
        stream.onError((e) => errors.push(e));
        stream.connect();
        sock.emitEvent('error', new Error('boom'));
        expect(errors).toContain('boom');
    });

    it('does not ping when pingIntervalMs is 0', () => {
        vi.useFakeTimers();
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            reconnect: false,
            wsFactory: () => sock,
        });
        stream.connect();
        sock.emitEvent('open');
        vi.advanceTimersByTime(60_000);
        expect(sock.pings).toBe(0);
    });
});

describe('MarketDataStream subscription management', () => {
    it('sends an unsubscribe frame for a channel when authenticated', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.connect();
        authenticateMd(sock);
        stream.subscribeForTrades(['AAPL', 'MSFT']);
        stream.unsubscribeFromTrades(['AAPL']);

        const unsub = findFrame(sentMsgpack(sock), 'unsubscribe');
        expect(unsub).toEqual({ action: 'unsubscribe', trades: ['AAPL'] });
        expect(stream.getSubscriptions().trades).toEqual(['MSFT']);
    });

    it('only mutates local state (no frames) while not authenticated', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.subscribeForQuotes(['AAPL']);
        stream.unsubscribeFromQuotes(['AAPL']);
        expect(sock.sent).toHaveLength(0);
        expect(stream.getSubscriptions().quotes).toEqual([]);
    });

    it('getSubscriptions returns an independent copy', () => {
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => new FakeSocket(),
        });
        stream.subscribeForBars(['AAPL']);
        const snapshot = stream.getSubscriptions();
        snapshot.bars.push('ZZZ');
        expect(stream.getSubscriptions().bars).toEqual(['AAPL']);
    });

    it('syncs state and emits SUBSCRIPTION on a subscription control frame', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        let snapshot: Record<string, string[]> | undefined;
        stream.on(streaming.EVENT.SUBSCRIPTION, (s) => (snapshot = s));
        stream.connect();
        authenticateMd(sock);
        sock.emitEvent(
            'message',
            mpEncode([{ T: 'subscription', trades: ['AAPL'], quotes: ['MSFT'] }]),
        );

        expect(snapshot?.trades).toEqual(['AAPL']);
        expect(stream.getSubscriptions().quotes).toEqual(['MSFT']);
    });

    it('dedupes symbols and only sends newly-added ones incrementally', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        stream.connect();
        authenticateMd(sock);
        stream.subscribeForTrades(['AAPL']);
        stream.subscribeForTrades(['AAPL', 'MSFT']);

        expect(stream.getSubscriptions().trades).toEqual(['AAPL', 'MSFT']);
        const subs = sentMsgpack(sock).filter((f) => f.action === 'subscribe');
        expect(subs.at(-1)).toEqual({ action: 'subscribe', trades: ['MSFT'] });
    });

    it('defaults the stock feed to iex and derives the option URL', () => {
        const urls: string[] = [];
        const factory = (url: string) => {
            urls.push(url);
            return new FakeSocket();
        };
        new streaming.StockDataStream({ credentials: CREDS, pingIntervalMs: 0, wsFactory: factory }).connect();
        new streaming.OptionDataStream({ credentials: CREDS, pingIntervalMs: 0, wsFactory: factory }).connect();
        expect(urls[0]).toBe('wss://stream.data.alpaca.markets/v2/iex');
        expect(urls[1]).toBe('wss://stream.data.alpaca.markets/v1beta1/indicative');
    });
});

describe('stream mappers', () => {
    const ts = new Date('2026-01-02T15:04:05Z');

    it('mapQuote maps bid/ask fields', () => {
        const q = streaming.mapQuote({
            T: 'q', S: 'AAPL', bx: 'V', bp: 1.1, bs: 2, ax: 'W', ap: 1.2, as: 3, t: ts, c: ['R'], z: 'C',
        });
        expect(q).toMatchObject({
            symbol: 'AAPL', bidExchange: 'V', bidPrice: 1.1, bidSize: 2,
            askExchange: 'W', askPrice: 1.2, askSize: 3, conditions: ['R'], tape: 'C',
        });
        expect(q.timestamp).toBeInstanceOf(Date);
    });

    it('mapQuote defaults conditions to an empty array', () => {
        const q = streaming.mapQuote({ T: 'q', S: 'AAPL', bp: 1, bs: 1, ap: 2, as: 1, t: ts } as any);
        expect(q.conditions).toEqual([]);
    });

    it('mapStatus maps status/reason codes', () => {
        const s = streaming.mapStatus({
            T: 's', S: 'AAPL', sc: 'H', sm: 'Halted', rc: 'T12', rm: 'News', t: ts, z: 'C',
        });
        expect(s).toMatchObject({
            symbol: 'AAPL', statusCode: 'H', statusMessage: 'Halted',
            reasonCode: 'T12', reasonMessage: 'News', tape: 'C',
        });
    });

    it('mapLuld maps limit up/down prices', () => {
        const l = streaming.mapLuld({ T: 'l', S: 'AAPL', u: 10.5, d: 9.5, i: 'B', t: ts, z: 'C' });
        expect(l).toMatchObject({ symbol: 'AAPL', limitUpPrice: 10.5, limitDownPrice: 9.5, indicator: 'B', tape: 'C' });
    });

    it('mapCorrection maps original/corrected fields', () => {
        const c = streaming.mapCorrection({
            T: 'c', S: 'AAPL', x: 'V', oi: 1, op: 10, os: 5, oc: ['@'], ci: 2, cp: 11, cs: 6, cc: ['@', 'I'], t: ts, z: 'C',
        });
        expect(c).toMatchObject({
            symbol: 'AAPL', exchange: 'V', originalId: 1, originalPrice: 10, originalSize: 5,
            originalConditions: ['@'], correctedId: 2, correctedPrice: 11, correctedSize: 6, correctedConditions: ['@', 'I'],
        });
    });

    it('mapCancelError maps cancel fields', () => {
        const x = streaming.mapCancelError({ T: 'x', S: 'AAPL', i: 7, x: 'V', p: 10, s: 100, a: 'X', z: 'C', t: ts });
        expect(x).toMatchObject({ symbol: 'AAPL', id: 7, exchange: 'V', price: 10, size: 100, action: 'X', tape: 'C' });
    });

    it('mapOrderbook maps bid/ask levels and reset flag', () => {
        const o = streaming.mapOrderbook({
            T: 'o', S: 'BTC/USD', t: ts, b: [{ p: 100, s: 1 }], a: [{ p: 101, s: 2 }], r: true,
        });
        expect(o.symbol).toBe('BTC/USD');
        expect(o.bids).toEqual([{ price: 100, size: 1 }]);
        expect(o.asks).toEqual([{ price: 101, size: 2 }]);
        expect(o.reset).toBe(true);
    });

    it('mapOrderbook defaults missing levels and reset', () => {
        const o = streaming.mapOrderbook({ T: 'o', S: 'BTC/USD', t: ts } as any);
        expect(o.bids).toEqual([]);
        expect(o.asks).toEqual([]);
        expect(o.reset).toBe(false);
    });

    it('mapNews maps news fields and parses dates', () => {
        const n = streaming.mapNews({
            T: 'n', id: 9, headline: 'H', summary: 'S', author: 'A',
            created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:01Z',
            url: 'http://x', content: 'C', symbols: ['AAPL'], source: 'src',
        });
        expect(n).toMatchObject({ id: 9, headline: 'H', summary: 'S', author: 'A', url: 'http://x', content: 'C', symbols: ['AAPL'], source: 'src' });
        expect(n.createdAt).toBeInstanceOf(Date);
        expect(n.updatedAt).toBeInstanceOf(Date);
    });

    it('mapTradeUpdate parses timestamp, renames fields, and preserves extras', () => {
        const u = streaming.mapTradeUpdate({
            event: 'fill',
            timestamp: '2026-01-02T00:00:00Z',
            execution_id: 'exec-1',
            position_qty: '5',
            price: '187.25',
            qty: '10',
            order: { symbol: 'AAPL', client_order_id: 'cid-1', filled_qty: '10' },
            extra: 'keep-me',
        });
        expect(u.event).toBe('fill');
        expect(u.timestamp).toBeInstanceOf(Date);
        expect(u.executionId).toBe('exec-1');
        expect(u.positionQty).toBe('5');
        expect(u.order.symbol).toBe('AAPL');
        // order is a deserialized Order: snake_case wire keys are mapped to camelCase...
        expect(u.order.clientOrderId).toBe('cid-1');
        expect(u.order.filledQty).toBe('10');
        // ...and the raw snake_case keys are still preserved via passthrough.
        expect(u.order.client_order_id).toBe('cid-1');
        expect((u as any).extra).toBe('keep-me');
    });

    it('mapTradeUpdate tolerates an empty payload', () => {
        const u = streaming.mapTradeUpdate({});
        expect(u.event).toBe('');
        expect(u.order).toEqual({});
        expect(u.timestamp).toBeUndefined();
    });
});

describe('MarketDataStream dispatch wiring', () => {
    it('routes every frame type to its typed event', () => {
        const sock = new FakeSocket();
        const stream = new streaming.StockDataStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        const seen: Record<string, unknown> = {};
        stream.onQuote((q) => (seen.quote = q));
        stream.onUpdatedBar((b) => (seen.updatedBar = b));
        stream.onDailyBar((b) => (seen.dailyBar = b));
        stream.onStatus((s) => (seen.status = s));
        stream.onLuld((l) => (seen.luld = l));
        stream.onCorrection((c) => (seen.correction = c));
        stream.onCancelError((x) => (seen.cancelError = x));
        stream.onOrderbook((o) => (seen.orderbook = o));
        stream.onNews((n) => (seen.news = n));
        stream.connect();
        authenticateMd(sock);

        const ts = new Date('2026-01-02T15:04:05Z');
        sock.emitEvent(
            'message',
            mpEncode([
                { T: 'q', S: 'AAPL', bp: 1, bs: 1, ap: 2, as: 1, t: ts },
                { T: 'u', S: 'AAPL', o: 1, h: 2, l: 0.5, c: 1.5, v: 100, t: ts },
                { T: 'd', S: 'AAPL', o: 1, h: 2, l: 0.5, c: 1.5, v: 100, t: ts },
                { T: 's', S: 'AAPL', sc: 'H', t: ts },
                { T: 'l', S: 'AAPL', u: 10, d: 9, t: ts },
                { T: 'c', S: 'AAPL', oi: 1, op: 10, os: 1, ci: 2, cp: 11, cs: 1, t: ts },
                { T: 'x', S: 'AAPL', i: 1, x: 'V', p: 10, s: 1, t: ts },
                { T: 'o', S: 'BTC/USD', t: ts, b: [{ p: 100, s: 1 }], a: [{ p: 101, s: 2 }] },
                { T: 'n', id: 1, headline: 'H', symbols: ['AAPL'] },
            ]),
        );

        expect((seen.quote as streaming.StreamQuote).symbol).toBe('AAPL');
        expect((seen.updatedBar as streaming.StreamBar).close).toBe(1.5);
        expect((seen.dailyBar as streaming.StreamBar).open).toBe(1);
        expect((seen.status as streaming.StreamStatus).statusCode).toBe('H');
        expect((seen.luld as streaming.StreamLuld).limitUpPrice).toBe(10);
        expect((seen.correction as streaming.StreamCorrection).correctedPrice).toBe(11);
        expect((seen.cancelError as streaming.StreamCancelError).id).toBe(1);
        expect((seen.orderbook as streaming.StreamOrderbook).bids).toEqual([{ price: 100, size: 1 }]);
        expect((seen.news as streaming.StreamNews).headline).toBe('H');
    });
});

describe('TradingStream lifecycle', () => {
    it('emits SUBSCRIPTION on a listening frame', () => {
        const sock = new FakeSocket();
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: () => sock,
        });
        let streams: unknown;
        stream.on(streaming.EVENT.SUBSCRIPTION, (s) => (streams = s));
        stream.subscribeTradeUpdates();
        stream.connect();
        authorizeTrading(sock);
        sock.emitEvent('message', JSON.stringify({ stream: 'listening', data: { streams: ['trade_updates'] } }));
        expect(streams).toEqual(['trade_updates']);
    });

    it('re-sends the listen frame after a reconnect', () => {
        vi.useFakeTimers();
        const sockets: FakeSocket[] = [];
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            backoff: false,
            reconnectJitter: 0,
            wsFactory: trackingFactory(sockets),
        });
        stream.subscribeTradeUpdates();
        stream.connect();
        authorizeTrading(sockets[0]);
        expect(findFrame(sentJson(sockets[0]), 'listen')).toBeDefined();

        sockets[0].emitEvent('close');
        vi.advanceTimersByTime(1000);
        expect(sockets).toHaveLength(2);

        authorizeTrading(sockets[1]);
        expect(findFrame(sentJson(sockets[1]), 'listen')).toEqual({
            action: 'listen',
            data: { streams: ['trade_updates'] },
        });
    });

    it('defaults to the paper endpoint', () => {
        let seenUrl = '';
        new streaming.TradingStream({
            credentials: CREDS,
            pingIntervalMs: 0,
            wsFactory: (url) => {
                seenUrl = url;
                return new FakeSocket();
            },
        }).connect();
        expect(seenUrl).toBe('wss://paper-api.alpaca.markets/stream');
    });
});
