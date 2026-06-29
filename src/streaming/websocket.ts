/**
 * Base WebSocket transport shared by the market-data and trading streams.
 *
 * This is a hand-written module (the generated SDK is REST-only). It handles the cross-cutting concerns both Alpaca streams need:
 * connect, authenticate, msgpack/JSON framing, ping/pong keepalive, reconnect
 * with exponential backoff, and automatic re-subscribe after a reconnect.
 *
 * Subclasses implement the protocol-specific bits: the auth frame, message
 * dispatch, and what to (re)subscribe to.
 *
 * The underlying socket is created through an injectable `wsFactory` so tests
 * can supply a fake (mirrors the `fetchApi` override on the REST runtime).
 */
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { decode as msgpackDecode, encode as msgpackEncode } from "@msgpack/msgpack";

import type { AlpacaCredentials } from "../auth";

/** Connection / authentication lifecycle states. */
export enum STATE {
    CONNECTING = "connecting",
    CONNECTED = "connected",
    AUTHENTICATED = "authenticated",
    DISCONNECTED = "disconnected",
    WAITING_TO_RECONNECT = "waiting to reconnect",
}

/** Events emitted by every stream client. */
export enum EVENT {
    STATE_CHANGE = "state_change",
    CLIENT_ERROR = "error",
    AUTHORIZED = "authorized",
    SUBSCRIPTION = "subscription",
    // Market-data channels
    TRADE = "trade",
    QUOTE = "quote",
    BAR = "bar",
    UPDATED_BAR = "updated_bar",
    DAILY_BAR = "daily_bar",
    STATUS = "status",
    LULD = "luld",
    CORRECTION = "correction",
    CANCEL_ERROR = "cancel_error",
    ORDERBOOK = "orderbook",
    NEWS = "news",
    // Trading channel
    TRADE_UPDATE = "trade_update",
}

/** Numeric error codes Alpaca returns on the market-data stream. */
export const CONN_ERROR = new Map<number, string>([
    [400, "invalid syntax"],
    [401, "not authenticated"],
    [402, "auth failed"],
    [403, "already authenticated"],
    [404, "auth timeout"],
    [405, "symbol limit exceeded"],
    [406, "connection limit exceeded"],
    [407, "slow client"],
    [408, "v2 not enabled"],
    [409, "insufficient subscription"],
    [500, "internal error"],
]);

/** Wire format used on the socket. Market data is msgpack; trading is JSON. */
export type Codec = "msgpack" | "json";

/** Sentinel for {@link AlpacaWebSocketOptions.maxReconnectAttempts}: retry forever. */
export const UNLIMITED_RECONNECT_ATTEMPTS = -1;

/** The minimal socket surface this client relies on (satisfied by `ws`). */
export interface WebSocketLike {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    send(data: string | Uint8Array): void;
    close(code?: number, reason?: string): void;
    terminate?(): void;
    ping?(data?: unknown): void;
}

/** Creates a socket for a given URL. Override in tests to inject a fake. */
export type WebSocketFactory = (url: string, codec: Codec) => WebSocketLike;

export interface AlpacaWebSocketOptions {
    /** API key id + secret. */
    credentials: AlpacaCredentials;
    /** Fully-qualified `wss://` endpoint. */
    url: string;
    /** Wire format. Defaults per subclass. */
    codec?: Codec;
    /** Reconnect automatically on unexpected close. Default true. */
    reconnect?: boolean;
    /**
     * Max reconnect attempts before giving up. Default `10`. Use `0` to disable
     * reconnects entirely (equivalent to `reconnect: false`) and
     * {@link UNLIMITED_RECONNECT_ATTEMPTS} (`-1`) to retry forever.
     */
    maxReconnectAttempts?: number;
    /**
     * Grow the reconnect delay exponentially (doubling per attempt). Default
     * true. When false, every attempt waits {@link initialReconnectMs}.
     */
    backoff?: boolean;
    /** Initial reconnect backoff in ms. Default `1000` (1s). */
    initialReconnectMs?: number;
    /** Cap (ms) for a single reconnect delay. Default `64000` (64s). */
    maxReconnectMs?: number;
    /**
     * Jitter fraction applied to each reconnect delay, randomizing it within
     * `±fraction` (e.g. `0.2` => `0.8x`..`1.2x`). Default `0.2`. Set `0` for a
     * deterministic delay.
     */
    reconnectJitter?: number;
    /** Keepalive ping interval (ms). Set 0 to disable. Default 10000. */
    pingIntervalMs?: number;
    /** How long (ms) to wait for a pong before terminating. Default 5000. */
    pongWaitMs?: number;
    /** Emit verbose logs to the console. Default false. */
    verbose?: boolean;
    /** Inject a socket factory (testing). Defaults to the `ws` package. */
    wsFactory?: WebSocketFactory;
}

export abstract class AlpacaWebSocket extends EventEmitter {
    protected readonly keyId: string;
    protected readonly secret: string;
    protected readonly url: string;
    protected readonly codec: Codec;

    private readonly reconnectEnabled: boolean;
    private readonly maxReconnectAttempts: number;
    private readonly backoff: boolean;
    private readonly initialReconnectMs: number;
    private readonly maxReconnectMs: number;
    private readonly reconnectJitter: number;
    private readonly pingIntervalMs: number;
    private readonly pongWaitMs: number;
    private readonly verbose: boolean;
    private readonly wsFactory: WebSocketFactory;

    protected conn?: WebSocketLike;
    protected authenticated = false;
    protected isReconnected = false;

    private state: STATE = STATE.DISCONNECTED;
    private manualClose = false;
    private reconnectAttempts = 0;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private pingTimer?: ReturnType<typeof setInterval>;
    private pongTimer?: ReturnType<typeof setTimeout>;

    constructor(options: AlpacaWebSocketOptions) {
        super();
        const { keyId, secret } = options.credentials ?? ({} as AlpacaCredentials);
        if (!keyId || !secret) {
            throw new Error(
                "Streaming requires Alpaca credentials with both `keyId` and `secret`.",
            );
        }
        this.keyId = keyId;
        this.secret = secret;
        this.url = options.url;
        this.codec = options.codec ?? "msgpack";
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
        // `reconnect: false` or `maxReconnectAttempts: 0` both disable reconnects.
        this.reconnectEnabled = (options.reconnect ?? true) && this.maxReconnectAttempts !== 0;
        this.backoff = options.backoff ?? true;
        this.initialReconnectMs = options.initialReconnectMs ?? 1000;
        this.maxReconnectMs = options.maxReconnectMs ?? 64000;
        this.reconnectJitter = options.reconnectJitter ?? 0.2;
        this.pingIntervalMs = options.pingIntervalMs ?? 10000;
        this.pongWaitMs = options.pongWaitMs ?? 5000;
        this.verbose = options.verbose ?? false;
        this.wsFactory = options.wsFactory ?? defaultWebSocketFactory;
    }

    /** Opens the connection. Safe to call again after a disconnect. */
    connect(): void {
        if (this.conn) {
            return;
        }
        this.manualClose = false;
        this.authenticated = false;
        this.setState(STATE.CONNECTING);

        const socket = this.wsFactory(this.url, this.codec);
        this.conn = socket;
        socket.on("open", () => this.handleOpen());
        socket.on("message", (data: unknown) => this.handleRawMessage(data));
        socket.on("error", (err: unknown) =>
            this.emit(EVENT.CLIENT_ERROR, err instanceof Error ? err.message : String(err)),
        );
        socket.on("close", () => this.handleClose());
        socket.on("pong", () => this.clearPongTimeout());
        this.startPing();
    }

    /** Closes the connection and disables auto-reconnect for this call. */
    disconnect(): void {
        this.manualClose = true;
        this.stopPing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.authenticated = false;
        const conn = this.conn;
        this.conn = undefined;
        conn?.close();
        this.setState(STATE.DISCONNECTED);
    }

    /** Current lifecycle state. */
    getState(): STATE {
        return this.state;
    }

    // --- Listener sugar shared by all streams -------------------------------

    /** Fires once the connection is authenticated and ready. */
    onConnect(fn: () => void): this {
        return this.on(STATE.AUTHENTICATED, fn);
    }

    onDisconnect(fn: () => void): this {
        return this.on(STATE.DISCONNECTED, fn);
    }

    onError(fn: (err: string) => void): this {
        return this.on(EVENT.CLIENT_ERROR, fn);
    }

    onStateChange(fn: (state: STATE) => void): this {
        return this.on(EVENT.STATE_CHANGE, fn);
    }

    // --- Hooks implemented by subclasses ------------------------------------

    /** Send the protocol-specific authentication frame. */
    protected abstract sendAuth(): void;

    /** Interpret a decoded inbound message. */
    protected abstract handleMessage(message: unknown): void;

    /** (Re)send the current subscription state (called after each auth). */
    protected abstract resubscribe(): void;

    // --- Shared protocol plumbing -------------------------------------------

    /** Encode and send a payload using the configured codec. */
    protected send(payload: unknown): void {
        if (!this.conn) {
            return;
        }
        const data =
            this.codec === "json"
                ? JSON.stringify(payload)
                : msgpackEncode(payload);
        this.conn.send(data);
    }

    /** Called by subclasses when the server confirms authentication. */
    protected onAuthenticated(): void {
        this.authenticated = true;
        // A successful auth means the connection is healthy again: reset the
        // backoff so a later drop starts from the initial delay.
        this.reconnectAttempts = 0;
        this.setState(STATE.AUTHENTICATED);
        this.resubscribe();
        this.emit(EVENT.AUTHORIZED);
    }

    /**
     * Treat an authentication failure as terminal: surface the error and close
     * without scheduling a reconnect (retrying bad credentials would loop
     * forever). Subclasses call this from their protocol-specific auth-failure
     * paths.
     */
    protected failAuthentication(message: string): void {
        this.emit(EVENT.CLIENT_ERROR, message);
        this.disconnect();
    }

    protected setState(state: STATE): void {
        this.state = state;
        this.emit(state);
        this.emit(EVENT.STATE_CHANGE, state);
    }

    protected log(...args: unknown[]): void {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.log(...args);
        }
    }

    private handleOpen(): void {
        this.setState(STATE.CONNECTED);
        this.sendAuth();
    }

    private handleRawMessage(raw: unknown): void {
        let decoded: unknown;
        try {
            decoded = this.decode(raw);
        } catch (err) {
            this.emit(
                EVENT.CLIENT_ERROR,
                `failed to decode message: ${(err as Error).message}`,
            );
            return;
        }
        this.handleMessage(decoded);
    }

    private decode(raw: unknown): unknown {
        if (this.codec === "json") {
            const text =
                typeof raw === "string"
                    ? raw
                    : Buffer.isBuffer(raw)
                      ? raw.toString("utf8")
                      : new TextDecoder().decode(raw as Uint8Array);
            return JSON.parse(text);
        }
        return msgpackDecode(raw as Uint8Array);
    }

    private handleClose(): void {
        this.stopPing();
        this.conn = undefined;
        this.authenticated = false;
        this.setState(STATE.DISCONNECTED);
        if (this.shouldReconnect()) {
            this.scheduleReconnect();
        }
    }

    /** Whether another reconnect attempt is permitted given the attempt budget. */
    private shouldReconnect(): boolean {
        if (this.manualClose || !this.reconnectEnabled) {
            return false;
        }
        if (this.maxReconnectAttempts < 0) {
            return true; // UNLIMITED_RECONNECT_ATTEMPTS: retry forever
        }
        return this.reconnectAttempts < this.maxReconnectAttempts;
    }

    private scheduleReconnect(): void {
        this.isReconnected = true;
        this.setState(STATE.WAITING_TO_RECONNECT);
        const delayMs = this.reconnectDelayMs(this.reconnectAttempts);
        this.reconnectAttempts += 1;
        this.log(`reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
    }

    /**
     * Exponential backoff (doubling per attempt) from {@link initialReconnectMs}
     * up to {@link maxReconnectMs}, with symmetric `±reconnectJitter` jitter
     * applied and re-capped at the max. With `backoff: false` every attempt
     * waits the initial delay (still jittered).
     */
    private reconnectDelayMs(attempt: number): number {
        const base = this.backoff
            ? Math.min(this.initialReconnectMs * 2 ** attempt, this.maxReconnectMs)
            : this.initialReconnectMs;
        const f = this.reconnectJitter;
        const jittered = f > 0 ? base * (1 - f + Math.random() * 2 * f) : base;
        return Math.min(jittered, this.maxReconnectMs);
    }

    private startPing(): void {
        if (!this.pingIntervalMs) {
            return;
        }
        this.pingTimer = setInterval(() => {
            if (this.conn?.ping) {
                this.conn.ping();
                this.pongTimer = setTimeout(() => {
                    this.log("no pong received, terminating socket");
                    this.conn?.terminate?.();
                }, this.pongWaitMs);
            }
        }, this.pingIntervalMs);
    }

    private stopPing(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = undefined;
        }
        this.clearPongTimeout();
    }

    private clearPongTimeout(): void {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = undefined;
        }
    }
}

const defaultWebSocketFactory: WebSocketFactory = (url, codec) =>
    new WebSocket(url, {
        perMessageDeflate: false,
        headers:
            codec === "msgpack"
                ? { "Content-Type": "application/msgpack" }
                : undefined,
    }) as unknown as WebSocketLike;
