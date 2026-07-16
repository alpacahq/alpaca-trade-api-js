import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';

import * as streaming from '../src/streaming';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };
const servers = new Set<WebSocketServer>();

function listen(server: WebSocketServer): Promise<number> {
    servers.add(server);
    return new Promise((resolve, reject) => {
        server.once('listening', () => {
            const address = server.address();
            if (typeof address === 'string' || address === null) {
                reject(new Error('expected an ephemeral TCP address'));
                return;
            }
            resolve(address.port);
        });
        server.once('error', reject);
    });
}

function closeServer(server: WebSocketServer): Promise<void> {
    for (const client of server.clients) client.terminate();
    return new Promise((resolve) => server.close(() => resolve()));
}

function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = (): void => {
            if (predicate()) {
                resolve();
            } else if (Date.now() >= deadline) {
                reject(new Error('condition was not met before test deadline'));
            } else {
                setTimeout(poll, 5);
            }
        };
        poll();
    });
}

afterEach(async () => {
    await Promise.all([...servers].map(async (server) => {
        servers.delete(server);
        await closeServer(server);
    }));
});

describe('streaming transport integration', () => {
    it('does not ping during a deliberately slow WebSocket handshake, then pings after open', async () => {
        let pings = 0;
        const server = new WebSocketServer({
            port: 0,
            verifyClient: (_info, done) => setTimeout(() => done(true), 50),
        });
        server.on('connection', (socket) => {
            socket.on('ping', () => pings++);
        });
        const port = await listen(server);
        const errors: string[] = [];
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            url: `ws://127.0.0.1:${port}`,
            reconnect: false,
            pingIntervalMs: 10,
            pongWaitMs: 100,
        });
        stream.onError((message) => errors.push(message));

        stream.connect();
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(pings).toBe(0);
        expect(errors).toEqual([]);

        await waitFor(() => pings > 0);
        stream.disconnect();
    });

    it('contains malformed real payloads and Alpaca action:error frames without losing later updates', async () => {
        const server = new WebSocketServer({ port: 0 });
        server.on('connection', (socket) => {
            socket.once('message', () => {
                socket.send(JSON.stringify({
                    stream: 'authorization',
                    data: { status: 'authorized' },
                }));
                socket.send('null');
                socket.send(JSON.stringify({
                    action: 'error',
                    data: { error_message: 'bad subscription frame' },
                }));
                socket.send(JSON.stringify({
                    stream: 'trade_updates',
                    data: { event: 'fill', order: { symbol: 'AAPL' } },
                }));
            });
        });
        const port = await listen(server);
        const errors: string[] = [];
        const updates: streaming.TradeUpdate[] = [];
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            url: `ws://127.0.0.1:${port}`,
            reconnect: false,
            pingIntervalMs: 0,
        });
        stream.onError((message) => errors.push(message));
        stream.onTradeUpdate((update) => updates.push(update));

        stream.connect();
        await waitFor(() => updates.length === 1);

        expect(errors.some((message) => /failed to process message/i.test(message))).toBe(true);
        expect(errors).toContain('bad subscription frame');
        expect(updates[0].order.symbol).toBe('AAPL');
        stream.disconnect();
    });

    it('does not reconnect or double-disconnect when a real close races manual disconnect', async () => {
        let connections = 0;
        const server = new WebSocketServer({ port: 0 });
        server.on('connection', (socket) => {
            connections++;
            const connectionNumber = connections;
            socket.once('message', () => {
                socket.send(JSON.stringify({
                    stream: 'authorization',
                    data: { status: 'authorized' },
                }));
                if (connectionNumber === 1) socket.close();
            });
        });
        const port = await listen(server);
        const stream = new streaming.TradingStream({
            credentials: CREDS,
            url: `ws://127.0.0.1:${port}`,
            initialReconnectMs: 5,
            maxReconnectMs: 5,
            reconnectJitter: 0,
            pingIntervalMs: 0,
        });
        let disconnects = 0;
        stream.onDisconnect(() => disconnects++);

        stream.connect();
        await waitFor(
            () => connections === 2 && stream.getState() === streaming.STATE.AUTHENTICATED,
        );
        disconnects = 0;
        stream.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(disconnects).toBe(1);
        expect(connections).toBe(2);
        expect(stream.getState()).toBe(streaming.STATE.DISCONNECTED);
    });
});
