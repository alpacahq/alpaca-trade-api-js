/**
 * Shared error hierarchy for the Alpaca SDK.
 *
 * The generated SDK duplicates its transport in `trading/runtime.ts` and
 * `market-data/runtime.ts`. If each copy defined its own `ApiError`, a caught
 * error would have two different class identities depending on which sub-client
 * made the call, so `err instanceof ApiError` would be subtly unreliable. This
 * hand-written module is the single source of truth: both runtimes import
 * {@link buildApiError} / {@link FetchError} from here and re-export the classes,
 * so there is exactly one identity for `trading.ApiError`,
 * `marketData.ApiError`, and the top-level `errors.ApiError`.
 *
 * This module lives outside the generated `apis/`/`models/` trees, which are kept
 * untouched as a faithful snapshot of the OpenAPI spec.
 */

/**
 * Base error carrying the raw {@link Response}. `name` is intentionally a plain
 * `string` (not a literal) so subclasses can override it without a type clash.
 */
export class ResponseError extends Error {
    override name: string = "ResponseError";
    constructor(public response: Response, msg?: string) {
        super(msg);
    }
}

/**
 * Parsed `X-RateLimit-*` headers, surfaced on every {@link ApiError} when the
 * response carried them (not just on {@link RateLimitError}).
 */
export interface RateLimitInfo {
    /** Requests permitted in the current window (`X-RateLimit-Limit`). */
    limit?: number;
    /** Requests remaining in the current window (`X-RateLimit-Remaining`). */
    remaining?: number;
    /** When the current window resets (`X-RateLimit-Reset`, unix seconds). */
    reset?: Date;
}

/**
 * Typed error thrown for non-2xx responses. Parses the documented
 * `{ code, message }` Alpaca error envelope (falling back to the raw body) and
 * surfaces the rate-limit headers so callers can branch on `status`/`code` and
 * read throttling metadata without re-reading the (already consumed) response.
 *
 * Prefer the status-specific subclasses ({@link AuthError},
 * {@link PermissionError}, {@link NotFoundError}, {@link ValidationError},
 * {@link RateLimitError}) via `instanceof`; every one of them is also an
 * `ApiError` and a {@link ResponseError}, so existing broad `catch` sites keep
 * working.
 */
export class ApiError extends ResponseError {
    constructor(
        response: Response,
        public status: number,
        public code?: number | string,
        msg?: string,
        /** Rate-limit headers, when present on the response. */
        public rateLimit?: RateLimitInfo,
        /**
         * Suggested wait before retrying, in milliseconds. Derived from
         * `Retry-After` when present, else from `X-RateLimit-Reset`.
         */
        public retryAfterMs?: number,
        /**
         * Alpaca's `X-Request-ID` for this call, when present. It uniquely
         * identifies the request in Alpaca's systems and cannot be looked up
         * later, so log it (or include it in support tickets) on failure.
         */
        public requestId?: string,
    ) {
        super(response, msg);
        this.name = "ApiError";
    }
}

/** 401 - missing or invalid credentials. */
export class AuthError extends ApiError {
    constructor(...args: ConstructorParameters<typeof ApiError>) {
        super(...args);
        this.name = "AuthError";
    }
}

/** 403 - authenticated but not permitted (wrong environment, plan, scope). */
export class PermissionError extends ApiError {
    constructor(...args: ConstructorParameters<typeof ApiError>) {
        super(...args);
        this.name = "PermissionError";
    }
}

/** 404 - the requested resource does not exist. */
export class NotFoundError extends ApiError {
    constructor(...args: ConstructorParameters<typeof ApiError>) {
        super(...args);
        this.name = "NotFoundError";
    }
}

/** 400 / 422 - the request was understood but rejected as invalid. */
export class ValidationError extends ApiError {
    constructor(...args: ConstructorParameters<typeof ApiError>) {
        super(...args);
        this.name = "ValidationError";
    }
}

/**
 * 429 - rate limit exceeded. {@link ApiError.retryAfterMs} (and
 * {@link ApiError.rateLimit}) tell you how long to wait before retrying.
 */
export class RateLimitError extends ApiError {
    constructor(...args: ConstructorParameters<typeof ApiError>) {
        super(...args);
        this.name = "RateLimitError";
    }
}

function parseRateLimit(headers: Headers | undefined): RateLimitInfo | undefined {
    if (!headers || typeof headers.get !== "function") {
        return undefined;
    }
    const info: RateLimitInfo = {};
    let present = false;

    const limit = headers.get("X-RateLimit-Limit");
    if (limit != null) {
        const n = Number(limit);
        if (!Number.isNaN(n)) {
            info.limit = n;
            present = true;
        }
    }
    const remaining = headers.get("X-RateLimit-Remaining");
    if (remaining != null) {
        const n = Number(remaining);
        if (!Number.isNaN(n)) {
            info.remaining = n;
            present = true;
        }
    }
    const reset = headers.get("X-RateLimit-Reset");
    if (reset != null) {
        const secs = Number(reset);
        if (!Number.isNaN(secs)) {
            info.reset = new Date(secs * 1000);
            present = true;
        }
    }

    return present ? info : undefined;
}

function computeRetryAfterMs(headers: Headers | undefined, rateLimit?: RateLimitInfo): number | undefined {
    if (headers && typeof headers.get === "function") {
        const retryAfter = headers.get("Retry-After");
        if (retryAfter != null) {
            const secs = Number(retryAfter);
            if (!Number.isNaN(secs)) {
                return Math.max(0, secs * 1000);
            }
            const when = Date.parse(retryAfter);
            if (!Number.isNaN(when)) {
                return Math.max(0, when - Date.now());
            }
        }
    }
    if (rateLimit?.reset) {
        return Math.max(0, rateLimit.reset.getTime() - Date.now());
    }
    return undefined;
}

function parseRequestId(headers: Headers | undefined): string | undefined {
    if (!headers || typeof headers.get !== "function") {
        return undefined;
    }
    // `Headers.get` is case-insensitive, so this also matches `x-request-id`.
    return headers.get("X-Request-ID") ?? undefined;
}

/**
 * Market-data 403s from Alpaca are opaque about the cause: a free-tier key that
 * (explicitly or via a paid default) hits the SIP feed fails with
 * `subscription does not permit querying recent SIP data`, which doesn't tell a
 * first-time user what to change. When we detect that shape, append actionable
 * guidance to the message without touching `status`/`code` (so `instanceof`
 * checks and programmatic branching keep working).
 */
const SIP_HINT =
    'Your account may not have SIP market-data access. For free data pass `{ feed: "iex" }`; ' +
    "to query SIP either set `end` to at least 15 minutes in the past or upgrade to a paid market-data subscription.";

function augmentMessage(status: number, message: string): string {
    if (status !== 403) {
        return message;
    }
    const lower = message.toLowerCase();
    // Match Alpaca's SIP/subscription 403 wording without over-triggering on
    // unrelated permission errors (e.g. wrong trading environment).
    if (lower.includes("sip") || lower.includes("subscription")) {
        return `${message} (${SIP_HINT})`;
    }
    return message;
}

function errorForStatus(
    status: number,
    response: Response,
    code: number | string | undefined,
    message: string,
    rateLimit: RateLimitInfo | undefined,
    retryAfterMs: number | undefined,
    requestId: string | undefined,
): ApiError {
    const args = [response, status, code, message, rateLimit, retryAfterMs, requestId] as const;
    switch (status) {
        case 401:
            return new AuthError(...args);
        case 403:
            return new PermissionError(...args);
        case 404:
            return new NotFoundError(...args);
        case 400:
        case 422:
            return new ValidationError(...args);
        case 429:
            return new RateLimitError(...args);
        default:
            return new ApiError(...args);
    }
}

/**
 * Build the right {@link ApiError} subclass from a non-2xx {@link Response}.
 * Parses the `{ code, message }` envelope (falling back to the raw body) plus
 * the rate-limit headers. Reads a clone so the caller's `response.body` stays
 * available.
 */
export async function buildApiError(response: Response): Promise<ApiError> {
    let code: number | string | undefined;
    let message = `Response returned an error code (HTTP ${response.status})`;
    try {
        const text = await response.clone().text();
        if (text) {
            try {
                const body: unknown = JSON.parse(text);
                if (body && typeof body === 'object') {
                    const envelope = body as { code?: unknown; message?: unknown };
                    if (envelope.code != null) {
                        code = envelope.code as number | string;
                    }
                    if (envelope.message) {
                        message = String(envelope.message);
                    }
                } else if (typeof body === 'string' && body) {
                    message = body;
                }
            } catch {
                message = text;
            }
        }
    } catch {
        // body already consumed or unreadable; keep the default message
    }
    const rateLimit = parseRateLimit(response.headers);
    const retryAfterMs = computeRetryAfterMs(response.headers, rateLimit);
    const requestId = parseRequestId(response.headers);
    message = augmentMessage(response.status, message);
    return errorForStatus(response.status, response, code, message, rateLimit, retryAfterMs, requestId);
}

/**
 * Thrown when the underlying `fetch` itself fails (network error, aborted
 * request) and no middleware produced an alternative response.
 */
export class FetchError extends Error {
    override name: "FetchError" = "FetchError";
    constructor(public cause: Error, msg?: string) {
        super(msg);
    }
}
