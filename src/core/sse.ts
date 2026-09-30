import { ApiError, FetchError } from "../errors";

export interface SseMessage<T> {
    data: T;
    event?: string;
    /** Effective SSE event id, including the empty string used to reset it. */
    id?: string;
    /** Most recent valid server-provided reconnection interval. */
    retry?: number;
}

export interface SseServer {
    url: string;
    description?: string;
}

export interface SseConnectionInfo {
    url: string;
    status: number;
    headers: Headers;
}

export type SseCloseReason = "eof" | "aborted" | "error";

export interface SseClosedInfo {
    reason: SseCloseReason;
    /** Terminal parser, deserialization, HTTP, or transport error. */
    error?: unknown;
}

export interface SseReconnectOptions {
    /** Consecutive reconnect attempts without receiving an event. Default: unlimited. */
    maxAttempts?: number;
    /**
     * Reconnect attempts while opening the initial connection. Defaults to
     * `maxAttempts` when set, otherwise 2. Use `Infinity` for EventSource-like
     * unlimited initial retries.
     */
    maxInitialAttempts?: number;
    /** Maximum elapsed time in one reconnect cycle. Default: unlimited. */
    maxElapsedMs?: number;
    /** Initial client backoff when the server has not sent `retry:`. Default: 1000. */
    initialDelayMs?: number;
    /** Maximum reconnect delay. Default: 30000. */
    maxDelayMs?: number;
}

export interface SseReconnectEvent {
    attempt: number;
    delayMs: number;
    lastEventId?: string;
    error?: unknown;
}

export interface SseOptions extends RequestInit {
    signal?: AbortSignal | null;
    /**
     * Fetch overrides for SSE connection attempts. RequestInit fields are also
     * accepted directly for compatibility with the previously generated
     * method; nested values take precedence. When both locations provide an
     * AbortSignal, they are composed and either signal cancels the subscription.
     */
    requestInit?: RequestInit;
    /**
     * Deadline through validated successful response headers and, for non-2xx
     * responses, the bounded error-body read. Defaults to the configured REST
     * timeout; set to 0 to disable it.
     */
    connectTimeoutMs?: number;
    /** Maximum time without response bytes; disabled by default. */
    idleTimeoutMs?: number;
    /** Maximum subscription lifetime; disabled by default. */
    maxDurationMs?: number;
    /** Override the operation server for this subscription. */
    basePath?: string;
    /** Select one of the operation-level OpenAPI servers. */
    serverIndex?: number;
    /** Enable/disable reconnect, or configure its limits and backoff. */
    reconnect?: boolean | SseReconnectOptions;
    /** Maximum decoded bytes in one SSE line. Default: 1 MiB. */
    maxLineBytes?: number;
    /** Maximum decoded bytes accumulated in one SSE event. Default: 1 MiB. */
    maxEventBytes?: number;
    /** Maximum non-2xx response body retained for typed errors. Default: 64 KiB. */
    maxErrorBodyBytes?: number;
    onOpen?: (connection: SseConnectionInfo) => void;
    onComment?: (comment: string) => void;
    onReconnect?: (event: SseReconnectEvent) => void;
}

export interface SseOperationMetadata {
    servers?: SseServer[];
    sandboxServerIndex?: number;
    reconnect?: boolean;
    bounded?: boolean;
    initialLastEventId?: string;
}

export interface SseConnection {
    response: Response;
    url: string;
}

export type SseConnector = (
    lastEventId: string | undefined,
    signal: AbortSignal,
) => Promise<SseConnection>;

export type SseDataTransformer<T> = (data: string) => T;

const DEFAULT_MAX_LINE_BYTES = 1024 * 1024;
const DEFAULT_MAX_EVENT_BYTES = 1024 * 1024;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const DEFAULT_MAX_INITIAL_RECONNECT_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function initialLastEventId(
    options: SseOptions,
    metadata: SseOperationMetadata,
): string | undefined {
    if (metadata.initialLastEventId !== undefined) {
        return metadata.initialLastEventId;
    }
    const headers = new Headers(options.headers);
    new Headers(options.requestInit?.headers).forEach((value, name) => {
        headers.set(name, value);
    });
    return headers.get("Last-Event-ID") ?? undefined;
}

export class SseProtocolError extends Error {
    override name = "SseProtocolError";
}

export class SseDeserializationError extends Error {
    override name = "SseDeserializationError";

    constructor(
        message: string,
        public eventId: string | undefined,
        public event: string | undefined,
        cause?: unknown,
    ) {
        super(message);
        if (cause !== undefined) {
            (this as Error & { cause?: unknown }).cause = cause;
        }
    }
}

interface ParsedSseMessage {
    data: string;
    event?: string;
    id?: string;
    retry?: number;
}

type ParserOutput =
    | { kind: "message"; message: ParsedSseMessage }
    | { kind: "comment"; comment: string };

/**
 * Incremental WHATWG event-stream parser.
 *
 * Kept internal because the Node-20-compatible `eventsource-parser` release
 * resets the ID after every dispatch and cannot report data-less `id:` updates,
 * both of which break Last-Event-ID resumption.
 */
class EventStreamParser {
    private buffer = "";
    private firstChunk = true;
    private data = "";
    private hasData = false;
    private eventType = "";
    private eventBytes = 0;
    private _lastEventId: string | undefined;
    private pendingLastEventId: string | undefined;
    private _retryMs: number | undefined;
    private readonly encoder = new TextEncoder();

    constructor(
        initialLastEventId: string | undefined,
        initialRetryMs: number | undefined,
        private readonly maxLineBytes: number,
        private readonly maxEventBytes: number,
    ) {
        this._lastEventId = initialLastEventId;
        this.pendingLastEventId = initialLastEventId;
        this._retryMs = initialRetryMs;
    }

    get lastEventId(): string | undefined {
        return this._lastEventId;
    }

    get retryMs(): number | undefined {
        return this._retryMs;
    }

    feed(chunk: string): ParserOutput[] {
        let next = chunk;
        if (this.firstChunk) {
            this.firstChunk = false;
            if (next.startsWith("\uFEFF")) next = next.slice(1);
        }
        this.buffer += next;
        const output: ParserOutput[] = [];

        while (true) {
            const line = this.takeLine();
            if (line === undefined) break;
            output.push(...this.processLine(line));
        }

        // A terminal CR is already a line delimiter; it is kept only until the
        // next chunk tells us whether it forms CRLF.
        const pendingLine = this.buffer.endsWith("\r")
            ? this.buffer.slice(0, -1)
            : this.buffer;
        if (this.byteLength(pendingLine) > this.maxLineBytes) {
            throw new SseProtocolError(
                `SSE line exceeded ${this.maxLineBytes} bytes`,
            );
        }
        return output;
    }

    /** EOF treats a terminal CR as a line ending, then discards incomplete data. */
    finish(): ParserOutput[] {
        const output = this.buffer.endsWith("\r") ? this.feed("\n") : [];
        this.buffer = "";
        this.data = "";
        this.hasData = false;
        this.eventType = "";
        this.eventBytes = 0;
        return output;
    }

    private takeLine(): string | undefined {
        for (let index = 0; index < this.buffer.length; index++) {
            const char = this.buffer[index];
            if (char !== "\r" && char !== "\n") continue;
            if (char === "\r" && index === this.buffer.length - 1) {
                return undefined;
            }
            const length =
                char === "\r" && this.buffer[index + 1] === "\n" ? 2 : 1;
            const line = this.buffer.slice(0, index);
            this.buffer = this.buffer.slice(index + length);
            if (this.byteLength(line) > this.maxLineBytes) {
                throw new SseProtocolError(
                    `SSE line exceeded ${this.maxLineBytes} bytes`,
                );
            }
            return line;
        }
        return undefined;
    }

    private processLine(line: string): ParserOutput[] {
        if (line === "") {
            // The WHATWG algorithm commits the event-ID buffer only when an
            // event block reaches its terminating blank line. This also allows
            // data-less `id:` blocks to update resumption state without letting
            // an interrupted event skip data that was never dispatched.
            this._lastEventId = this.pendingLastEventId;
            if (!this.hasData) {
                this.eventType = "";
                return [];
            }
            const message: ParsedSseMessage = {
                data: this.data.endsWith("\n")
                    ? this.data.slice(0, -1)
                    : this.data,
                event: this.eventType || undefined,
                id: this._lastEventId,
                retry: this._retryMs,
            };
            this.data = "";
            this.hasData = false;
            this.eventType = "";
            this.eventBytes = 0;
            return [{ kind: "message", message }];
        }
        if (line.startsWith(":")) {
            const comment = line.startsWith(": ") ? line.slice(2) : line.slice(1);
            return [{ kind: "comment", comment }];
        }

        const separator = line.indexOf(":");
        const field = separator < 0 ? line : line.slice(0, separator);
        let value = separator < 0 ? "" : line.slice(separator + 1);
        if (value.startsWith(" ")) value = value.slice(1);

        switch (field) {
            case "data": {
                const addedBytes = this.byteLength(value) + 1;
                if (this.eventBytes + addedBytes > this.maxEventBytes) {
                    throw new SseProtocolError(
                        `SSE event exceeded ${this.maxEventBytes} bytes`,
                    );
                }
                this.hasData = true;
                this.eventBytes += addedBytes;
                this.data += `${value}\n`;
                break;
            }
            case "event":
                this.eventType = value;
                break;
            case "id":
                if (!value.includes("\0")) this.pendingLastEventId = value;
                break;
            case "retry":
                if (/^\d+$/.test(value)) this._retryMs = Number(value);
                break;
            default:
                // Unknown fields are ignored by the SSE processing model.
                break;
        }
        return [];
    }

    private byteLength(value: string): number {
        return this.encoder.encode(value).byteLength;
    }
}

function callback<T>(handler: ((value: T) => void) | undefined, value: T): void {
    if (!handler) return;
    try {
        handler(value);
    } catch {
        // Observability must never break transport.
    }
}

function abortReason(signal: AbortSignal): unknown {
    return (signal as AbortSignal & { reason?: unknown }).reason ??
        new DOMException("The operation was aborted.", "AbortError");
}

function cancellableSleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(abortReason(signal));
            return;
        }
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = (): void => {
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
            reject(abortReason(signal));
        };
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

function reconnectConfig(
    options: SseOptions,
    metadata: SseOperationMetadata,
): SseReconnectOptions | undefined {
    if (options.reconnect === false) return undefined;
    if (options.reconnect === true) return {};
    if (typeof options.reconnect === "object") return options.reconnect;
    return metadata.reconnect ? {} : undefined;
}

function reconnectDelay(
    attempt: number,
    config: SseReconnectOptions,
    serverRetryMs: number | undefined,
    retryAfterMs: number | undefined,
): number {
    const cap = config.maxDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    if (retryAfterMs !== undefined) return Math.min(Math.max(0, retryAfterMs), cap);
    if (serverRetryMs !== undefined) return Math.min(Math.max(0, serverRetryMs), cap);
    const base = config.initialDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const exponential = Math.min(base * 2 ** Math.max(0, attempt - 1), cap);
    return Math.min(exponential * (0.8 + Math.random() * 0.4), cap);
}

function retryable(error: unknown): boolean {
    if (error instanceof ApiError) return RETRYABLE_STATUSES.has(error.status);
    if (error instanceof FetchError) {
        const name = (error.cause as { name?: string } | undefined)?.name;
        return name !== "AbortError";
    }
    return false;
}

function closeBody(response: Response | undefined, reason?: unknown): void {
    if (!response?.body) return;
    try {
        void response.body.cancel(reason).catch(() => {});
    } catch {
        // Locked/custom streams are cancelled by their active reader.
    }
}

export class SseSubscription<T> implements AsyncIterable<T> {
    private readonly controller = new AbortController();
    private readonly callerAborts: Array<{
        signal: AbortSignal;
        listener: () => void;
    }> = [];
    private finalized = false;
    private ending = false;
    private durationTimer?: ReturnType<typeof setTimeout>;
    private consumed = false;
    private activeReader?: ReadableStreamDefaultReader<Uint8Array>;
    private activeReaderCancelled = false;
    private activeReaderCancellation?: Promise<void>;
    private activeConnectionController?: AbortController;
    private activeConnectionCleanup?: () => void;
    private initialConnection?: SseConnection;
    private _connection?: SseConnectionInfo;
    private _lastEventId?: string;
    private _serverRetryMs?: number;

    private readonly closedResolve: (value: SseClosedInfo) => void;
    readonly closed: Promise<SseClosedInfo>;

    private constructor(
        private readonly connector: SseConnector,
        private readonly transformer: SseDataTransformer<T>,
        private readonly options: SseOptions,
        private readonly metadata: SseOperationMetadata,
    ) {
        this._lastEventId = initialLastEventId(options, metadata);
        let resolveClosed!: (value: SseClosedInfo) => void;
        this.closed = new Promise((resolve) => {
            resolveClosed = resolve;
        });
        this.closedResolve = resolveClosed;
        this.controller.signal.addEventListener(
            "abort",
            () => {
                const reason = abortReason(this.controller.signal);
                this.activeConnectionController?.abort(reason);
                this.activeReaderCancellation = this.cancelActiveReader(reason);
                if (!this.activeReader) {
                    closeBody(this.initialConnection?.response, reason);
                }
                if (!this.ending) {
                    this.finalize({ reason: "aborted" });
                }
            },
            { once: true },
        );

        const callerSignals = [
            options.requestInit?.signal,
            options.signal,
        ].filter(
            (signal, index, signals): signal is AbortSignal =>
                signal != null && signals.indexOf(signal) === index,
        );
        for (const callerSignal of callerSignals) {
            if (callerSignal.aborted) {
                this.controller.abort(abortReason(callerSignal));
                break;
            }
            const listener = () =>
                this.controller.abort(abortReason(callerSignal));
            callerSignal.addEventListener("abort", listener, { once: true });
            this.callerAborts.push({ signal: callerSignal, listener });
        }
        if (
            !this.finalized &&
            options.maxDurationMs &&
            options.maxDurationMs > 0
        ) {
            this.durationTimer = setTimeout(
                () =>
                    this.controller.abort(
                        new DOMException(
                            `SSE subscription exceeded ${options.maxDurationMs} ms`,
                            "TimeoutError",
                        ),
                    ),
                options.maxDurationMs,
            );
        }
    }

    static async open<T>(
        connector: SseConnector,
        transformer: SseDataTransformer<T>,
        options: SseOptions = {},
        metadata: SseOperationMetadata = {},
    ): Promise<SseSubscription<T>> {
        if (typeof options === "function") {
            throw new TypeError(
                "SSE methods no longer accept an InitOverrideFunction; pass SseOptions or RequestInit fields instead",
            );
        }
        const subscription = new SseSubscription(
            connector,
            transformer,
            options,
            metadata,
        );
        try {
            subscription.initialConnection =
                await subscription.connectInitially();
            subscription.setConnection(subscription.initialConnection);
            return subscription;
        } catch (error) {
            subscription.close(error);
            throw error;
        }
    }

    get connection(): SseConnectionInfo | undefined {
        return this._connection;
    }

    /**
     * Effective event ID through the most recently delivered message.
     *
     * Parser lookahead never advances this past queued or failed messages.
     * A completed data-less `id:` block is committed after all earlier
     * messages from the same input batch have been delivered.
     */
    get lastEventId(): string | undefined {
        return this._lastEventId;
    }

    get rawResponse(): Response | undefined {
        return this.initialConnection?.response;
    }

    messages(): AsyncIterable<SseMessage<T>> {
        return this.consumeMessages();
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return this.consumeData()[Symbol.asyncIterator]();
    }

    close(reason?: unknown): void {
        if (!this.controller.signal.aborted) {
            this.controller.abort(
                reason ?? new DOMException("SSE subscription closed", "AbortError"),
            );
        }
        this.finalize({ reason: "aborted" });
    }

    abort(reason?: unknown): void {
        this.close(reason);
    }

    private async *consumeData(): AsyncGenerator<T> {
        for await (const message of this.consumeMessages()) {
            yield message.data;
        }
    }

    private async *consumeMessages(): AsyncGenerator<SseMessage<T>> {
        if (this.consumed) {
            throw new Error("An SSE subscription can only be consumed once");
        }
        this.consumed = true;

        let connection = this.initialConnection;
        this.initialConnection = undefined;
        let reconnectAttempt = 0;
        let reconnectStartedAt: number | undefined;
        let terminalError: unknown;
        let failed = false;
        try {
            while (connection) {
                if (connection.response.status === 204) return;
                let receivedEvent = false;
                let failure: unknown;
                try {
                    for await (const message of this.readConnection(connection)) {
                        receivedEvent = true;
                        reconnectAttempt = 0;
                        reconnectStartedAt = undefined;
                        yield message;
                    }
                    if (this.controller.signal.aborted) return;
                    if (this.metadata.bounded) return;
                } catch (error) {
                    if (this.controller.signal.aborted) return;
                    failure = error;
                    if (
                        error instanceof SseProtocolError ||
                        error instanceof SseDeserializationError
                    ) {
                        throw error;
                    }
                }

                const reconnect = reconnectConfig(this.options, this.metadata);
                if (!reconnect) {
                    if (failure) throw failure;
                    return;
                }

                if (!receivedEvent) reconnectAttempt += 1;
                else reconnectAttempt = 1;
                reconnectStartedAt ??= Date.now();
                if (
                    reconnect.maxAttempts !== undefined &&
                    reconnectAttempt > reconnect.maxAttempts
                ) {
                    if (failure) throw failure;
                    return;
                }
                if (
                    reconnect.maxElapsedMs !== undefined &&
                    Date.now() - reconnectStartedAt >= reconnect.maxElapsedMs
                ) {
                    if (failure) throw failure;
                    return;
                }

                let retryAfterMs: number | undefined;
                if (failure instanceof ApiError) retryAfterMs = failure.retryAfterMs;
                const delayMs = reconnectDelay(
                    reconnectAttempt,
                    reconnect,
                    this._serverRetryMs,
                    retryAfterMs,
                );
                if (
                    reconnect.maxElapsedMs !== undefined &&
                    delayMs >=
                        reconnect.maxElapsedMs -
                            (Date.now() - reconnectStartedAt)
                ) {
                    if (failure) throw failure;
                    return;
                }
                callback(this.options.onReconnect, {
                    attempt: reconnectAttempt,
                    delayMs,
                    lastEventId: this._lastEventId,
                    error: failure,
                });
                await cancellableSleep(delayMs, this.controller.signal);

                while (true) {
                    try {
                        connection = await this.connect();
                        this.setConnection(connection);
                        break;
                    } catch (error) {
                        if (this.controller.signal.aborted) return;
                        if (!retryable(error)) throw error;
                        failure = error;
                        reconnectAttempt += 1;
                        if (
                            reconnect.maxAttempts !== undefined &&
                            reconnectAttempt > reconnect.maxAttempts
                        ) {
                            throw error;
                        }
                        if (
                            reconnect.maxElapsedMs !== undefined &&
                            Date.now() - reconnectStartedAt >=
                                reconnect.maxElapsedMs
                        ) {
                            throw error;
                        }
                        const nextDelayMs = reconnectDelay(
                            reconnectAttempt,
                            reconnect,
                            this._serverRetryMs,
                            error instanceof ApiError
                                ? error.retryAfterMs
                                : undefined,
                        );
                        if (
                            reconnect.maxElapsedMs !== undefined &&
                            nextDelayMs >=
                                reconnect.maxElapsedMs -
                                    (Date.now() - reconnectStartedAt)
                        ) {
                            throw error;
                        }
                        callback(this.options.onReconnect, {
                            attempt: reconnectAttempt,
                            delayMs: nextDelayMs,
                            lastEventId: this._lastEventId,
                            error,
                        });
                        await cancellableSleep(
                            nextDelayMs,
                            this.controller.signal,
                        );
                    }
                }
            }
        } catch (error) {
            if (!this.controller.signal.aborted) {
                terminalError = error;
                failed = true;
                throw error;
            }
        } finally {
            const wasAborted = this.controller.signal.aborted;
            if (!wasAborted) {
                this.ending = true;
                this.controller.abort(
                    new DOMException("SSE subscription ended", "AbortError"),
                );
            }
            await (this.activeReaderCancellation ?? this.cancelActiveReader());
            this.finalize(
                wasAborted
                    ? { reason: "aborted" }
                    : failed
                      ? { reason: "error", error: terminalError }
                      : { reason: "eof" },
            );
        }
    }

    private async *readConnection(
        connection: SseConnection,
    ): AsyncGenerator<SseMessage<T>> {
        const body = connection.response.body;
        if (!body) {
            throw new SseProtocolError("SSE response did not include a body");
        }
        const reader = body.getReader();
        this.activeReader = reader;
        const parser = new EventStreamParser(
            this._lastEventId,
            this._serverRetryMs,
            this.options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES,
            this.options.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES,
        );
        const decoder = new TextDecoder();
        let completed = false;

        try {
            if (this.controller.signal.aborted) {
                await this.cancelActiveReader(
                    abortReason(this.controller.signal),
                );
                throw abortReason(this.controller.signal);
            }
            while (true) {
                const result = await this.readWithIdleTimeout(reader);
                if (result.done) break;
                const outputs = parser.feed(
                    decoder.decode(result.value, { stream: true }),
                );
                for (const output of outputs) {
                    if (this.controller.signal.aborted) return;
                    if (output.kind === "comment") {
                        callback(this.options.onComment, output.comment);
                        continue;
                    }
                    let data: T;
                    try {
                        data = this.transformer(output.message.data);
                    } catch (error) {
                        throw new SseDeserializationError(
                            "Failed to deserialize SSE event data",
                            output.message.id,
                            output.message.event,
                            error,
                        );
                    }
                    this._lastEventId = output.message.id;
                    this._serverRetryMs = output.message.retry;
                    yield {
                        data,
                        event: output.message.event,
                        id: output.message.id,
                        retry: output.message.retry,
                    };
                }
                this._lastEventId = parser.lastEventId;
                this._serverRetryMs = parser.retryMs;
            }
            if (this.controller.signal.aborted) return;
            const final = decoder.decode();
            if (final) {
                const outputs = parser.feed(final);
                for (const output of outputs) {
                    if (this.controller.signal.aborted) return;
                    if (output.kind === "comment") {
                        callback(this.options.onComment, output.comment);
                    } else {
                        try {
                            const data = this.transformer(
                                output.message.data,
                            );
                            this._lastEventId = output.message.id;
                            this._serverRetryMs = output.message.retry;
                            yield {
                                data,
                                event: output.message.event,
                                id: output.message.id,
                                retry: output.message.retry,
                            };
                        } catch (error) {
                            throw new SseDeserializationError(
                                "Failed to deserialize SSE event data",
                                output.message.id,
                                output.message.event,
                                error,
                            );
                        }
                    }
                }
                this._lastEventId = parser.lastEventId;
                this._serverRetryMs = parser.retryMs;
            }
            const trailing = parser.finish();
            for (const output of trailing) {
                if (this.controller.signal.aborted) return;
                if (output.kind === "comment") {
                    callback(this.options.onComment, output.comment);
                    continue;
                }
                try {
                    const data = this.transformer(output.message.data);
                    this._lastEventId = output.message.id;
                    this._serverRetryMs = output.message.retry;
                    yield {
                        data,
                        event: output.message.event,
                        id: output.message.id,
                        retry: output.message.retry,
                    };
                } catch (error) {
                    throw new SseDeserializationError(
                        "Failed to deserialize SSE event data",
                        output.message.id,
                        output.message.event,
                        error,
                    );
                }
            }
            this._lastEventId = parser.lastEventId;
            this._serverRetryMs = parser.retryMs;
            completed = true;
        } finally {
            if (!completed) await this.cancelActiveReader();
            this.activeReader = undefined;
            this.activeReaderCancelled = false;
            try {
                reader.releaseLock();
            } catch {
                // A cancelled custom reader may already have released its lock.
            }
            this.endConnectionSignal();
        }
    }

    private readWithIdleTimeout(
        reader: ReadableStreamDefaultReader<Uint8Array>,
    ): Promise<ReadableStreamReadResult<Uint8Array>> {
        const idleTimeoutMs = this.options.idleTimeoutMs;
        if (!idleTimeoutMs || idleTimeoutMs <= 0) return reader.read();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const error = new DOMException(
                    `SSE connection was idle for ${idleTimeoutMs} ms`,
                    "TimeoutError",
                );
                this.activeConnectionController?.abort(error);
                void this.cancelActiveReader(error);
                reject(error);
            }, idleTimeoutMs);
            reader.read().then(
                (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        });
    }

    private async connect(): Promise<SseConnection> {
        const connectionController = new AbortController();
        this.activeConnectionController = connectionController;
        const onAbort = (): void =>
            connectionController.abort(abortReason(this.controller.signal));
        if (this.controller.signal.aborted) onAbort();
        else
            this.controller.signal.addEventListener("abort", onAbort, {
                once: true,
            });
        this.activeConnectionCleanup = () =>
            this.controller.signal.removeEventListener("abort", onAbort);
        if (connectionController.signal.aborted) {
            const reason = abortReason(connectionController.signal);
            this.endConnectionSignal();
            throw reason;
        }
        try {
            const connection = await this.awaitConnection(
                this.connector(
                    this._lastEventId,
                    connectionController.signal,
                ),
                connectionController.signal,
            );
            return connection;
        } catch (error) {
            this.endConnectionSignal();
            throw error;
        }
    }

    private awaitConnection(
        operation: Promise<SseConnection>,
        signal: AbortSignal,
    ): Promise<SseConnection> {
        if (signal.aborted) {
            void operation.then(
                (connection) =>
                    closeBody(connection.response, abortReason(signal)),
                () => {},
            );
            return Promise.reject(abortReason(signal));
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = (): void =>
                signal.removeEventListener("abort", onAbort);
            const onAbort = (): void => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(abortReason(signal));
            };
            signal.addEventListener("abort", onAbort, { once: true });
            operation.then(
                (connection) => {
                    cleanup();
                    if (settled) {
                        closeBody(connection.response, abortReason(signal));
                        return;
                    }
                    settled = true;
                    resolve(connection);
                },
                (error) => {
                    cleanup();
                    if (settled) return;
                    settled = true;
                    reject(error);
                },
            );
        });
    }

    private async connectInitially(): Promise<SseConnection> {
        const reconnect = reconnectConfig(this.options, this.metadata);
        if (!reconnect) return this.connect();

        let attempt = 0;
        const startedAt = Date.now();
        const maxInitialAttempts =
            reconnect.maxInitialAttempts ??
            reconnect.maxAttempts ??
            DEFAULT_MAX_INITIAL_RECONNECT_ATTEMPTS;
        while (true) {
            try {
                return await this.connect();
            } catch (error) {
                if (this.controller.signal.aborted) {
                    throw abortReason(this.controller.signal);
                }
                if (!retryable(error)) {
                    throw error;
                }
                attempt += 1;
                if (attempt > maxInitialAttempts) {
                    throw error;
                }
                if (
                    reconnect.maxElapsedMs !== undefined &&
                    Date.now() - startedAt >= reconnect.maxElapsedMs
                ) {
                    throw error;
                }
                const delayMs = reconnectDelay(
                    attempt,
                    reconnect,
                    this._serverRetryMs,
                    error instanceof ApiError ? error.retryAfterMs : undefined,
                );
                if (
                    reconnect.maxElapsedMs !== undefined &&
                    delayMs >=
                        reconnect.maxElapsedMs - (Date.now() - startedAt)
                ) {
                    throw error;
                }
                callback(this.options.onReconnect, {
                    attempt,
                    delayMs,
                    lastEventId: this._lastEventId,
                    error,
                });
                await cancellableSleep(delayMs, this.controller.signal);
            }
        }
    }

    private endConnectionSignal(): void {
        if (
            this.activeConnectionController &&
            !this.activeConnectionController.signal.aborted
        ) {
            this.activeConnectionController.abort(
                new DOMException("SSE connection ended", "AbortError"),
            );
        }
        this.activeConnectionCleanup?.();
        this.activeConnectionCleanup = undefined;
        this.activeConnectionController = undefined;
    }

    private setConnection(connection: SseConnection): void {
        this._connection = {
            url: connection.url,
            status: connection.response.status,
            headers: connection.response.headers,
        };
        callback(this.options.onOpen, this._connection);
    }

    private async cancelActiveReader(reason?: unknown): Promise<void> {
        if (!this.activeReader || this.activeReaderCancelled) return;
        const reader = this.activeReader;
        this.activeReaderCancelled = true;
        try {
            await reader.cancel(reason);
        } catch {
            // Cancellation is best-effort for custom stream implementations.
        }
    }

    private cleanup(): void {
        this.endConnectionSignal();
        if (this.durationTimer !== undefined) {
            clearTimeout(this.durationTimer);
            this.durationTimer = undefined;
        }
        for (const { signal, listener } of this.callerAborts) {
            signal.removeEventListener("abort", listener);
        }
        this.callerAborts.length = 0;
    }

    private finalize(info: SseClosedInfo): void {
        if (this.finalized) return;
        this.finalized = true;
        this.cleanup();
        this.closedResolve(info);
    }
}

export class SSEApiResponse<T> {
    private constructor(
        public raw: Response,
        private readonly subscription: SseSubscription<T>,
    ) {}

    static async open<T>(
        connector: SseConnector,
        transformer: SseDataTransformer<T>,
        options: SseOptions = {},
        metadata: SseOperationMetadata = {},
    ): Promise<SSEApiResponse<T>> {
        const subscription = await SseSubscription.open(
            connector,
            transformer,
            options,
            metadata,
        );
        const initial = subscription.rawResponse;
        if (!initial) {
            subscription.close();
            throw new SseProtocolError("SSE initial response is unavailable");
        }
        return new SSEApiResponse(initial, subscription);
    }

    async value(): Promise<SseSubscription<T>> {
        return this.subscription;
    }
}
