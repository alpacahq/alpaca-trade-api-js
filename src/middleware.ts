/**
 * Observability middleware built on the transport's {@link Middleware} hook
 * (`pre`/`post`/`onError`). Hand-written module.
 *
 * The runtime passes the same `init` object reference to `pre`, `post`, and
 * `onError` within a single request attempt, so we correlate timing and a
 * generated request id across the three callbacks via a {@link WeakMap} keyed by
 * `init` (no mutation of caller objects, auto-GC'd).
 *
 * Both middleware are pure observers: they never return an alternative response,
 * so they compose cleanly with retries and other middleware.
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
    /** Generate the per-request id. Default: `crypto.randomUUID()` or a counter. */
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
    /** Called once per request attempt with its timing/outcome. */
    onRequest: (metric: RequestMetric) => void;
    /** Generate the per-request id. Default: `crypto.randomUUID()` or a counter. */
    genRequestId?: () => string;
}

interface InFlight {
    id: string;
    start: number;
}

function defaultIdGenerator(): () => string {
    const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoObj?.randomUUID) {
        const randomUUID = cryptoObj.randomUUID.bind(cryptoObj);
        return () => randomUUID();
    }
    let counter = 0;
    return () => `req-${Date.now().toString(36)}-${(counter++).toString(36)}`;
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
 * are redacted; headers are only included when `logHeaders` is set.
 */
export function loggingMiddleware(options: LoggingMiddlewareOptions = {}): Middleware {
    const logger = options.logger ?? console;
    const level = options.level ?? "info";
    const genId = options.genRequestId ?? defaultIdGenerator();
    const redact = new Set((options.redactHeaders ?? DEFAULT_REDACTED_HEADERS).map((h) => h.toLowerCase()));
    const tracked = new WeakMap<RequestInit, InFlight>();

    const emit = (
        fn: ((message: string, meta?: Record<string, unknown>) => void) | undefined,
        message: string,
        meta: Record<string, unknown>,
    ): void => {
        fn?.call(logger, message, meta);
    };

    return {
        async pre(context) {
            const id = genId();
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
 * into Prometheus, StatsD, OpenTelemetry, etc. Never alters the request.
 */
export function metricsMiddleware(options: MetricsMiddlewareOptions): Middleware {
    const genId = options.genRequestId ?? defaultIdGenerator();
    const tracked = new WeakMap<RequestInit, InFlight>();

    return {
        async pre(context) {
            tracked.set(context.init, { id: genId(), start: now() });
        },
        async post(context) {
            const tracking = tracked.get(context.init);
            tracked.delete(context.init);
            options.onRequest({
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
            options.onRequest({
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
