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
import { EventEmitter as NodeEventEmitter } from "node:events";
import { WebSocket } from "ws";
import {
    decode as msgpackDecode,
    encode as msgpackEncode,
} from "@msgpack/msgpack";

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
    // Reconnect lifecycle
    RECONNECTING = "reconnecting",
    RECONNECTED = "reconnected",
    // Market-data channels
    TRADE = "trade",
    QUOTE = "quote",
    BAR = "bar",
    UPDATED_BAR = "updated_bar",
    DAILY_BAR = "daily_bar",
    STATUS = "status",
    LULD = "luld",
    IMBALANCE = "imbalance",
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

/**
 * Structural surface accepted by msgpack decoding for extension codecs.
 *
 * Kept local so public declarations do not require consumers to resolve
 * `@msgpack/msgpack` merely to type a stream factory.
 */
export interface StreamExtensionCodec {
    tryToEncode(object: unknown, context?: unknown): unknown;
    decode(data: Uint8Array, type: number, context?: unknown): unknown;
}

/** Sentinel for {@link AlpacaWebSocketOptions.maxReconnectAttempts}: retry forever. */
export const UNLIMITED_RECONNECT_ATTEMPTS = -1;

/** Outcome categories for a stream's first authentication attempt. */
export enum STREAM_AUTH_STATUS {
    /** The stream authenticated successfully. */
    AUTHENTICATED = "authenticated",
    /** The server rejected the credentials or the authentication request. */
    SERVER_REJECTED = "server_rejected",
    /** The stream closed (or was disconnected) before authentication completed. */
    CLOSED = "closed",
    /** A caller's {@link AlpacaWebSocket.waitForAuthentication} wait timed out. */
    TIMEOUT = "timeout",
    /** Authentication failed before completing for some other reason. */
    FAILED = "failed",
}

/**
 * Typed result of a stream's first authentication attempt.
 *
 * Mirrors the awaitable auth handshake outcome: inspect {@link authenticated}
 * for a simple success check, or {@link status} / {@link code} / {@link message}
 * for diagnostics (e.g. a server rejection code).
 */
export interface StreamAuthResult {
    /** Outcome category. */
    status: STREAM_AUTH_STATUS;
    /** `true` only when {@link status} is {@link STREAM_AUTH_STATUS.AUTHENTICATED}. */
    authenticated: boolean;
    /** Server error code, when the server rejected the request. */
    code?: number;
    /** Human-readable detail. */
    message: string;
}

/** Builders for the typed auth-result outcomes. */
const authResult = {
    authenticated: (): StreamAuthResult => ({
        status: STREAM_AUTH_STATUS.AUTHENTICATED,
        authenticated: true,
        message: "authenticated",
    }),
    serverRejected: (code: number | undefined, message: string): StreamAuthResult => ({
        status: STREAM_AUTH_STATUS.SERVER_REJECTED,
        authenticated: false,
        code,
        message,
    }),
    closed: (reason: string): StreamAuthResult => ({
        status: STREAM_AUTH_STATUS.CLOSED,
        authenticated: false,
        message: reason,
    }),
    timeout: (ms: number): StreamAuthResult => ({
        status: STREAM_AUTH_STATUS.TIMEOUT,
        authenticated: false,
        message: `authentication wait timed out after ${ms}ms`,
    }),
} as const;

/** The minimal socket surface this client relies on (satisfied by `ws`). */
export interface WebSocketLike {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    send(data: string | Uint8Array): void;
    close(code?: number, reason?: string): void;
    terminate?(): void;
    ping?(data?: unknown): void;
    /** Standard WebSocket state (`1` means OPEN), when exposed by the transport. */
    readonly readyState?: number;
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
    /**
     * Runs each listener callback. Defaults to invoking it synchronously on the
     * socket's message thread. Supply an executor (e.g. `(task) => setImmediate(task)`
     * or a queue) to offload listener work; regardless of the executor, a
     * callback that throws is caught and logged so it can never break the
     * stream's protocol, re-subscription, or reconnect handling.
     */
    callbackExecutor?: (task: () => void) => void;
}

type EventName = string | symbol;
type EventListener = (...args: never[]) => void;
type RawEventListener = EventListener & { listener?: EventListener };

interface EventEmitterContract {
    on(event: EventName, listener: EventListener): unknown;
    once(event: EventName, listener: EventListener): unknown;
    off(event: EventName, listener: EventListener): unknown;
    removeListener(event: EventName, listener: EventListener): unknown;
    removeAllListeners(event?: EventName): unknown;
    listenerCount(event: EventName): number;
    eventNames(): EventName[];
    rawListeners(event: EventName): RawEventListener[];
}

interface ScopedInterval {
    socket: WebSocketLike;
    generation: number;
    timer: ReturnType<typeof setInterval>;
}

interface ScopedTimeout {
    socket: WebSocketLike;
    generation: number;
    timer: ReturnType<typeof setTimeout>;
}

export abstract class AlpacaWebSocket {
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
    private readonly callbackExecutor: (task: () => void) => void;
    private readonly emitter = new NodeEventEmitter() as unknown as EventEmitterContract;

    protected conn?: WebSocketLike;
    protected authenticated = false;
    protected isReconnected = false;

    /**
     * Optional msgpack extension codec, applied to inbound `decode` only (never
     * to outbound `encode`). The market-data stream uses it to preserve
     * nanosecond timestamps; see {@link "./timestamp"}.
     */
    protected extensionCodec?: StreamExtensionCodec;

    /** Resolves with the outcome of the first authentication attempt. */
    private readonly authResultPromise: Promise<StreamAuthResult>;
    private resolveAuthResult!: (result: StreamAuthResult) => void;
    private authSettled = false;

    private state: STATE = STATE.DISCONNECTED;
    private manualClose = false;
    private generation = 0;
    private reconnectAttempts = 0;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private pingTimer?: ScopedInterval;
    private pongTimer?: ScopedTimeout;
    private callbackScope?: { socket: WebSocketLike; generation: number };

    constructor(options: AlpacaWebSocketOptions) {
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
        this.callbackExecutor = options.callbackExecutor ?? ((task) => task());
        this.authResultPromise = new Promise<StreamAuthResult>((resolve) => {
            this.resolveAuthResult = resolve;
        });
    }

    /** Opens the connection. Safe to call again after a disconnect. */
    connect(): void {
        if (this.conn) {
            return;
        }
        this.clearReconnectTimer();
        this.manualClose = false;
        this.authenticated = false;
        this.setState(STATE.CONNECTING);

        const socket = this.wsFactory(this.url, this.codec);
        const generation = ++this.generation;
        this.conn = socket;
        socket.on("open", () => {
            if (this.isCurrent(socket, generation)) this.handleOpen(socket, generation);
        });
        socket.on("message", (data: unknown) => {
            if (this.isCurrent(socket, generation)) {
                this.handleRawMessage(data, socket, generation);
            }
        });
        socket.on("error", (err: unknown) => {
            if (this.isCurrent(socket, generation)) {
                this.safeEmit(
                    EVENT.CLIENT_ERROR,
                    err instanceof Error ? err.message : String(err),
                );
            }
        });
        socket.on("close", () => {
            if (this.isCurrent(socket, generation)) this.handleClose(socket, generation);
        });
        socket.on("pong", () => {
            if (this.isCurrent(socket, generation)) {
                this.clearPongTimeout(socket, generation);
            }
        });
    }

    /** Closes the connection and disables auto-reconnect for this call. */
    disconnect(): void {
        this.manualClose = true;
        this.clearReconnectTimer();
        this.authenticated = false;
        // A close before we ever authenticated resolves the auth outcome.
        this.settleAuthResult(authResult.closed("disconnected before authentication"));
        const conn = this.conn;
        const generation = this.generation;
        this.conn = undefined;
        this.generation += 1;
        if (conn) this.stopPing(conn, generation);
        conn?.close();
        this.setState(STATE.DISCONNECTED);
    }

    /** Current lifecycle state. */
    getState(): STATE {
        return this.state;
    }

    // --- EventEmitter-compatible public surface ----------------------------

    /** Register a listener. Returns this stream for chaining. */
    on(event: EventName, listener: EventListener): this {
        this.emitter.on(event, listener);
        return this;
    }

    /** Register a one-shot listener. Returns this stream for chaining. */
    once(event: EventName, listener: EventListener): this {
        this.emitter.once(event, listener);
        return this;
    }

    /** Remove a listener. Returns this stream for chaining. */
    off(event: EventName, listener: EventListener): this {
        this.emitter.off(event, listener);
        return this;
    }

    /** Alias of {@link off}. Returns this stream for chaining. */
    removeListener(event: EventName, listener: EventListener): this {
        this.emitter.removeListener(event, listener);
        return this;
    }

    /** Remove listeners for one event, or all events when omitted. */
    removeAllListeners(event?: EventName): this {
        this.emitter.removeAllListeners(event);
        return this;
    }

    /** Number of listeners currently registered for an event. */
    listenerCount(event: EventName): number {
        return this.emitter.listenerCount(event);
    }

    /** Events that currently have at least one listener. */
    eventNames(): EventName[] {
        return this.emitter.eventNames();
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

    /** Fires just before each automatic reconnect attempt (`attempt` is 1-based). */
    onReconnecting(fn: (attempt: number) => void): this {
        return this.on(EVENT.RECONNECTING, fn);
    }

    /** Fires after a reconnect attempt re-authenticates and restores subscriptions. */
    onReconnected(fn: () => void): this {
        return this.on(EVENT.RECONNECTED, fn);
    }

    // --- Awaitable authentication outcome -----------------------------------

    /**
     * Resolves with the outcome of the stream's first authentication attempt.
     *
     * Never rejects: a failure resolves with a {@link StreamAuthResult} whose
     * {@link StreamAuthResult.authenticated} is `false` and whose
     * {@link StreamAuthResult.status} explains why (server rejection, closed
     * before auth, ...). The result reflects the first attempt only and is not
     * affected by later reconnects.
     */
    whenAuthenticated(): Promise<StreamAuthResult> {
        return this.authResultPromise;
    }

    /**
     * Like {@link whenAuthenticated}, but resolves with a
     * {@link STREAM_AUTH_STATUS.TIMEOUT} result if the outcome has not arrived
     * within `timeoutMs`. The timeout is caller-side only - it does not settle
     * the underlying outcome, so other waiters keep waiting for the real result.
     */
    async waitForAuthenticationResult(timeoutMs?: number): Promise<StreamAuthResult> {
        if (timeoutMs == null) {
            return this.authResultPromise;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<StreamAuthResult>((resolve) => {
            timer = setTimeout(() => resolve(authResult.timeout(timeoutMs)), timeoutMs);
        });
        try {
            return await Promise.race([this.authResultPromise, timeout]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    /**
     * Resolves `true` once the stream authenticates, or `false` on failure,
     * close-before-auth, or (when `timeoutMs` is given) timeout.
     */
    waitForAuthentication(timeoutMs?: number): Promise<boolean> {
        return this.waitForAuthenticationResult(timeoutMs).then((r) => r.authenticated);
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
        if (!this.conn || !this.isCallbackCurrent()) {
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
        if (!this.isCallbackCurrent()) return;
        const wasReconnected = this.isReconnected;
        this.authenticated = true;
        // A successful auth means the connection is healthy again: reset the
        // backoff so a later drop starts from the initial delay.
        this.reconnectAttempts = 0;
        this.setState(STATE.AUTHENTICATED);
        if (!this.isCallbackCurrent()) return;
        this.resubscribe();
        if (!this.isCallbackCurrent()) return;
        this.safeEmit(EVENT.AUTHORIZED);
        this.settleAuthResult(authResult.authenticated());
        // Distinguish a reconnect's auth + re-subscription dispatch from the
        // first connect; this does not imply server subscription acknowledgement.
        if (wasReconnected) {
            if (!this.isCallbackCurrent()) return;
            this.isReconnected = false;
            this.safeEmit(EVENT.RECONNECTED);
        }
    }

    /**
     * Treat an authentication failure as terminal: surface the error and close
     * without scheduling a reconnect (retrying bad credentials would loop
     * forever). Subclasses call this from their protocol-specific auth-failure
     * paths.
     */
    protected failAuthentication(message: string, code?: number): void {
        this.settleAuthResult(authResult.serverRejected(code, message));
        this.safeEmit(EVENT.CLIENT_ERROR, message);
        if (this.isCallbackCurrent()) this.disconnect();
    }

    /** Settles the first-auth outcome promise (idempotent - only the first call wins). */
    private settleAuthResult(result: StreamAuthResult): void {
        if (this.authSettled) {
            return;
        }
        this.authSettled = true;
        this.resolveAuthResult(result);
    }

    /**
     * Dispatches an event to its listeners through the configured executor,
     * isolating each callback so a throwing handler is logged rather than
     * allowed to disrupt protocol state, re-subscription, or reconnects.
     *
     * Uses {@link rawListeners} so `once` listeners still fire exactly once and
     * the missing-`error`-listener case never throws (matching the Java client,
     * which logs instead of crashing).
     */
    protected safeEmit(event: string, ...args: unknown[]): void {
        const handlers = this.emitter.rawListeners(event);
        for (const handler of handlers) {
            // A `once` wrapper exposes the original via `.listener`; remove it
            // up front so it cannot fire again, then call the original.
            if (typeof handler.listener === "function") {
                this.removeListener(event, handler);
            }
            const fn = (handler.listener ?? handler) as (...args: unknown[]) => void;
            this.callbackExecutor(() => {
                try {
                    fn(...args);
                } catch (err) {
                    this.log(`stream listener for "${event}" threw:`, err);
                }
            });
        }
    }

    protected setState(state: STATE): void {
        if (this.state === state) {
            return;
        }
        this.state = state;
        this.safeEmit(state);
        this.safeEmit(EVENT.STATE_CHANGE, state);
    }

    protected log(...args: unknown[]): void {
        if (this.verbose) {
            // eslint-disable-next-line no-console
            console.log(...args);
        }
    }

    private handleOpen(socket: WebSocketLike, generation: number): void {
        this.setState(STATE.CONNECTED);
        if (!this.isCurrent(socket, generation)) return;
        this.startPing(socket, generation);
        if (!this.isCurrent(socket, generation)) return;
        this.sendAuth();
    }

    private handleRawMessage(
        raw: unknown,
        socket: WebSocketLike,
        generation: number,
    ): void {
        let phase = "decode";
        const previousScope = this.callbackScope;
        this.callbackScope = { socket, generation };
        try {
            const decoded = this.decode(raw);
            phase = "process";
            this.handleMessage(decoded);
        } catch (err) {
            this.safeEmit(
                EVENT.CLIENT_ERROR,
                `failed to ${phase} message: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            this.callbackScope = previousScope;
        }
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
        // `useBigInt64` decodes 64-bit ints (e.g. large trade IDs) as `bigint`
        // instead of a lossy `number`; the market-data mappers coerce the
        // non-ID numeric fields back to `number` and expose the exact ID as a
        // string. Enabled alongside the market-data extension codec so it stays
        // scoped to the msgpack market-data streams.
        return msgpackDecode(
            raw as Uint8Array,
            this.extensionCodec
                ? {
                      extensionCodec: this.extensionCodec as never,
                      useBigInt64: true,
                  }
                : undefined,
        );
    }

    private handleClose(socket: WebSocketLike, generation: number): void {
        this.stopPing(socket, generation);
        this.conn = undefined;
        this.generation += 1;
        const reconnectGeneration = this.generation;
        this.authenticated = false;
        this.setState(STATE.DISCONNECTED);
        if (this.generation !== reconnectGeneration || this.conn) return;
        if (this.shouldReconnect()) {
            this.scheduleReconnect(reconnectGeneration);
        } else {
            // No reconnect will follow: the first-auth outcome is now terminal.
            this.settleAuthResult(authResult.closed("connection closed before authentication"));
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

    private scheduleReconnect(generation: number): void {
        this.isReconnected = true;
        this.setState(STATE.WAITING_TO_RECONNECT);
        const delayMs = this.reconnectDelayMs(this.reconnectAttempts);
        this.reconnectAttempts += 1;
        const attempt = this.reconnectAttempts;
        this.log(`reconnecting in ${delayMs}ms (attempt ${attempt})`);
        const timer = setTimeout(() => {
            if (
                this.reconnectTimer !== timer ||
                this.generation !== generation ||
                this.manualClose ||
                this.conn
            ) {
                return;
            }
            this.reconnectTimer = undefined;
            this.safeEmit(EVENT.RECONNECTING, attempt);
            if (
                this.generation === generation &&
                !this.manualClose &&
                !this.conn
            ) {
                this.connect();
            }
        }, delayMs);
        this.reconnectTimer = timer;
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

    private startPing(socket: WebSocketLike, generation: number): void {
        if (!this.pingIntervalMs) {
            return;
        }
        this.stopPing();
        const timer = setInterval(() => {
            if (!this.isCurrent(socket, generation)) {
                if (this.pingTimer?.timer === timer) this.stopPing(socket, generation);
                return;
            }
            if (socket.readyState !== undefined && socket.readyState !== 1) {
                return;
            }
            if (socket.ping) {
                this.clearPongTimeout(socket, generation);
                try {
                    socket.ping();
                } catch (err) {
                    this.safeEmit(
                        EVENT.CLIENT_ERROR,
                        err instanceof Error ? err.message : String(err),
                    );
                    return;
                }
                const pongTimer = setTimeout(() => {
                    if (!this.isCurrent(socket, generation)) return;
                    this.log("no pong received, terminating socket");
                    socket.terminate?.();
                }, this.pongWaitMs);
                this.pongTimer = { socket, generation, timer: pongTimer };
            }
        }, this.pingIntervalMs);
        this.pingTimer = { socket, generation, timer };
    }

    private stopPing(socket?: WebSocketLike, generation?: number): void {
        if (
            this.pingTimer &&
            (socket === undefined ||
                (this.pingTimer.socket === socket &&
                    this.pingTimer.generation === generation))
        ) {
            clearInterval(this.pingTimer.timer);
            this.pingTimer = undefined;
        }
        this.clearPongTimeout(socket, generation);
    }

    private clearPongTimeout(socket?: WebSocketLike, generation?: number): void {
        if (
            this.pongTimer &&
            (socket === undefined ||
                (this.pongTimer.socket === socket &&
                    this.pongTimer.generation === generation))
        ) {
            clearTimeout(this.pongTimer.timer);
            this.pongTimer = undefined;
        }
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    private isCurrent(socket: WebSocketLike, generation: number): boolean {
        return this.conn === socket && this.generation === generation;
    }

    /** Whether the socket callback currently dispatching a protocol frame is still current. */
    protected isCallbackCurrent(): boolean {
        return (
            this.callbackScope === undefined ||
            this.isCurrent(this.callbackScope.socket, this.callbackScope.generation)
        );
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
