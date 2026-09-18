/**
 * Observability middleware built on the transport's {@link Middleware} hook
 * (`pre`/`post`/`onError`). Hand-written module.
 *
 * The runtime passes the same `init` object reference to `pre`, `post`, and
 * `onError` within a single request attempt, so we correlate timing and a
 * generated request id across the three callbacks via a {@link WeakMap} keyed by
 * `init` (no mutation of caller objects, auto-GC'd). A valid generated UUID is
 * also sent as `X-Request-ID`, allowing Alpaca to echo the same id for support
 * and error correlation.
 *
 * Failures from user-provided loggers, metrics sinks, or request-ID generators
 * are isolated so observability can never change a request outcome.
 */
import type { Middleware } from "./trading";

/** Minimal structural logger; satisfied by `console` and most logging libs. */
export interface Logger {
    debug?(message: string, meta?: Record<string, unknown>): void;
    info?(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
}

/** Header names redacted by default (case-insensitive) when headers are logged. */
export const DEFAULT_REDACTED_HEADERS = [
    "APCA-API-KEY-ID",
    "APCA-API-SECRET-KEY",
    "Authorization",
];

export interface LoggingMiddlewareOptions {
    /** Sink for log lines. Defaults to `console`. */
    logger?: Logger;
    /** Level used for the success line (errors always use `error`). Default `"info"`. */
    level?: "debug" | "info";
    /** Also include request headers in the log line. Default `false`. */
    logHeaders?: boolean;
    /** Header names to mask when `logHeaders` is on. Default {@link DEFAULT_REDACTED_HEADERS}. */
    redactHeaders?: string[];
    /**
     * Generate the per-request UUID sent as `X-Request-ID`. Invalid values and
     * thrown errors fall back to the default generator.
     */
    genRequestId?: () => string;
}

/** A single completed (or failed) request, passed to {@link MetricsMiddlewareOptions.onRequest}. */
export interface RequestMetric {
    requestId: string;
    method: string;
    url: string;
    /** HTTP status, or `undefined` on a network error (no response). */
    status?: number;
    durationMs: number;
    /** `true` for a 2xx response. */
    ok: boolean;
    /** Present only on a network error. */
    error?: unknown;
}

export interface MetricsMiddlewareOptions {
    /**
     * Called once per request attempt with its timing/outcome. Throws and
     * returned promise rejections are swallowed so the sink cannot fail a
     * successful API request or replace its original error.
     */
    onRequest: (metric: RequestMetric) => void;
    /**
     * Generate the per-request UUID sent as `X-Request-ID`. Invalid values and
     * thrown errors fall back to the default generator.
     */
    genRequestId?: () => string;
}

interface InFlight {
    id: string;
    start: number;
}

function defaultIdGenerator(): () => string {
    const cryptoObj = (globalThis as {
        crypto?: {
            randomUUID?: () => string;
            getRandomValues?: (array: Uint8Array) => Uint8Array;
        };
    }).crypto;
    return () => {
        try {
            const uuid = cryptoObj?.randomUUID?.();
            if (isUuid(uuid)) return uuid;
        } catch {
            // Fall through to byte-based UUID generation.
        }

        const bytes = new Uint8Array(16);
        try {
            if (cryptoObj?.getRandomValues) {
                cryptoObj.getRandomValues(bytes);
            } else {
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = Math.floor(Math.random() * 256);
                }
            }
        } catch {
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
}

/**
 * Run a user-provided observability callback without allowing either a
 * synchronous throw or a returned rejected promise to affect the request.
 */
function runObserver(callback: () => unknown): void {
    try {
        const result = callback();
        if (
            result !== null &&
            (typeof result === "object" || typeof result === "function") &&
            typeof (result as PromiseLike<unknown>).then === "function"
        ) {
            void Promise.resolve(result).catch(() => {});
        }
    } catch {
        // Observability is best-effort and must never change request outcomes.
    }
}

const REQUEST_ID_HEADER = "X-Request-ID";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Fall back to the built-in request ID when a custom generator fails or returns a non-UUID. */
function safeIdGenerator(custom?: () => string): () => string {
    const fallback = defaultIdGenerator();
    if (!custom) return fallback;
    return () => {
        try {
            const id = custom();
            if (isUuid(id)) return id;
        } catch {
            // Fall through to the built-in generator.
        }
        return fallback();
    };
}

/**
 * Reuse a valid caller-supplied UUID or stamp the generated one on a
 * request-owned header collection.
 */
function ensureRequestId(init: RequestInit, generate: () => string): string {
    const headers = init.headers instanceof Headers
        ? init.headers
        : (init.headers ??= {}) as Record<string, string>;

    const existing = headers instanceof Headers
        ? headers.get(REQUEST_ID_HEADER)
        : Object.entries(headers).find(([name]) => name.toLowerCase() === "x-request-id")?.[1];
    if (isUuid(existing)) {
        if (!(headers instanceof Headers)) {
            for (const name of Object.keys(headers)) {
                if (name.toLowerCase() === "x-request-id") delete headers[name];
            }
            headers[REQUEST_ID_HEADER] = existing;
        }
        return existing;
    }

    const id = generate();
    if (headers instanceof Headers) {
        if (isUuid(id)) {
            headers.set(REQUEST_ID_HEADER, id);
        } else {
            headers.delete(REQUEST_ID_HEADER);
        }
    } else {
        for (const name of Object.keys(headers)) {
            if (name.toLowerCase() === "x-request-id") delete headers[name];
        }
        if (isUuid(id)) headers[REQUEST_ID_HEADER] = id;
    }
    return id;
}

function now(): number {
    return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
}

function methodOf(init: RequestInit | undefined): string {
    return (init?.method ?? "GET").toUpperCase();
}

function readHeaders(init: RequestInit | undefined, redact: Set<string>): Record<string, string> {
    const out: Record<string, string> = {};
    const h = init?.headers;
    const put = (key: string, value: string): void => {
        out[key] = redact.has(key.toLowerCase()) ? "[redacted]" : value;
    };
    if (!h) return out;
    if (typeof Headers !== "undefined" && h instanceof Headers) {
        h.forEach((value, key) => {
            put(key, value);
        });
    } else if (Array.isArray(h)) {
        for (const [key, value] of h) put(key, value);
    } else {
        for (const key of Object.keys(h)) put(key, (h as Record<string, string>)[key]);
    }
    return out;
}

/**
 * Logs one line per request attempt: method, url, status, duration, and a
 * generated request id (errors are logged at `error` level). Secrets in headers
 * are redacted; headers are only included when `logHeaders` is set. Logger and
 * request-ID-generator failures are swallowed so logging never changes the
 * request's result.
 */
export function loggingMiddleware(options: LoggingMiddlewareOptions = {}): Middleware {
    const logger = options.logger ?? console;
    const level = options.level ?? "info";
    const genId = safeIdGenerator(options.genRequestId);
    const redact = new Set((options.redactHeaders ?? DEFAULT_REDACTED_HEADERS).map((h) => h.toLowerCase()));
    const tracked = new WeakMap<RequestInit, InFlight>();

    const emit = (
        fn: ((message: string, meta?: Record<string, unknown>) => void) | undefined,
        message: string,
        meta: Record<string, unknown>,
    ): void => {
        if (fn) {
            runObserver(() => fn.call(logger, message, meta));
        }
    };

    return {
        async pre(context) {
            const id = ensureRequestId(context.init, genId);
            tracked.set(context.init, { id, start: now() });
            const meta: Record<string, unknown> = { requestId: id, method: methodOf(context.init), url: context.url };
            if (options.logHeaders) meta.headers = readHeaders(context.init, redact);
            emit(logger.debug, "alpaca request start", meta);
        },
        async post(context) {
            const tracking = tracked.get(context.init);
            tracked.delete(context.init);
            const durationMs = tracking ? now() - tracking.start : 0;
            const meta: Record<string, unknown> = {
                requestId: tracking?.id,
                method: methodOf(context.init),
                url: context.url,
                status: context.response.status,
                durationMs: Math.round(durationMs),
            };
            if (options.logHeaders) meta.headers = readHeaders(context.init, redact);
            if (context.response.status >= 400) {
                emit(logger.warn ?? logger.error, "alpaca request failed", meta);
            } else {
                emit(level === "debug" ? logger.debug : logger.info, "alpaca request ok", meta);
            }
        },
        async onError(context) {
            const tracking = tracked.get(context.init);
            tracked.delete(context.init);
            const durationMs = tracking ? now() - tracking.start : 0;
            emit(logger.error, "alpaca request error", {
                requestId: tracking?.id,
                method: methodOf(context.init),
                url: context.url,
                durationMs: Math.round(durationMs),
                error: context.error instanceof Error ? context.error.message : String(context.error),
            });
        },
    };
}

/**
 * Emits a {@link RequestMetric} per request attempt to your callback - wire it
 * into Prometheus, StatsD, OpenTelemetry, etc. Callback failures are swallowed;
 * this observer never alters the request.
 */
export function metricsMiddleware(options: MetricsMiddlewareOptions): Middleware {
    const genId = safeIdGenerator(options.genRequestId);
    const tracked = new WeakMap<RequestInit, InFlight>();
    const emit = (metric: RequestMetric): void => {
        runObserver(() => options.onRequest(metric));
    };

    return {
        async pre(context) {
            tracked.set(context.init, { id: ensureRequestId(context.init, genId), start: now() });
        },
        async post(context) {
            const tracking = tracked.get(context.init);
            tracked.delete(context.init);
            emit({
                requestId: tracking?.id ?? "",
                method: methodOf(context.init),
                url: context.url,
                status: context.response.status,
                durationMs: tracking ? now() - tracking.start : 0,
                ok: context.response.status >= 200 && context.response.status < 300,
            });
        },
        async onError(context) {
            const tracking = tracked.get(context.init);
            tracked.delete(context.init);
            emit({
                requestId: tracking?.id ?? "",
                method: methodOf(context.init),
                url: context.url,
                status: undefined,
                durationMs: tracking ? now() - tracking.start : 0,
                ok: false,
                error: context.error,
            });
        },
    };
}
