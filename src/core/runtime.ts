/* tslint:disable */
/* eslint-disable */
/**
 * Shared HTTP transport for every Alpaca API surface.
 *
 * Both the Trading and Market Data namespaces are near-identical OpenAPI
 * clients whose only real difference is host resolution. To avoid maintaining
 * two byte-identical copies of the retry/timeout/rate-limit/error transport,
 * that logic lives here once. Each package's `runtime.ts` is a thin shim that
 * re-exports this module and adds its host constants plus a `Configuration`
 * subclass overriding {@link BaseConfiguration.defaultBasePath}.
 *
 * Hand-maintained: edit this file directly for transport behavior changes.
 */
import { buildApiError, FetchError } from "../errors";
import { RateLimiter } from "../rate-limit";
import type { RateLimitConfig } from "../rate-limit";
import { formatUserAgent } from "./runtimeIdentity";

declare const __ALPACA_PACKAGE_VERSION__: string;

export { RateLimiter } from "../rate-limit";
export type { RateLimitConfig } from "../rate-limit";

// Re-exported from the shared error module so `trading.ApiError` (etc.) resolve
// to the SAME class identity as `marketData.*` and the top-level `errors.*`.
export {
    ResponseError,
    ApiError,
    AuthError,
    PermissionError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    FetchError,
} from "../errors";
export type { RateLimitInfo } from "../errors";

/**
 * Default User-Agent sent on every request so Alpaca can attribute SDK traffic.
 * Override via `Configuration.userAgent` (set to "" to disable).
 */
export const USER_AGENT = formatUserAgent(
    typeof __ALPACA_PACKAGE_VERSION__ === "string"
        ? __ALPACA_PACKAGE_VERSION__
        : "0.0.0-dev",
);

/**
 * Default per-attempt timeout in ms, applied when `timeoutMs` is not configured.
 * Mirrors the cross-SDK read/write timeout so a hung socket can't stall a call
 * forever. Pass `timeoutMs: 0` to disable the deadline entirely.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Opt-in automatic retry policy. Disabled unless `maxRetries > 0`.
 *
 * The defaults (when enabled) follow Alpaca's cross-SDK retry policy: base
 * backoff `250ms`, max backoff `5s`, exponential doubling per attempt with
 * `±20%` jitter, and the retryable status set `408, 425, 429, 500, 502, 503,
 * 504`. Only the safe/idempotent methods (`GET`, `HEAD`, `OPTIONS`, `TRACE`) and
 * transient network failures are retried; a non-idempotent `POST`/`PATCH`/etc.
 * is never auto-retried. After an ambiguous failure, reconcile the server state
 * before deciding whether to issue another state-changing request.
 */
export interface RetryConfig {
    maxRetries?: number; // max retry attempts after the initial request (default 0 = off)
    retryDelayMs?: number; // base backoff in ms for exponential backoff (default 250)
    maxDelayMs?: number; // cap for any single backoff delay in ms (default 5000)
    retryableStatuses?: number[]; // HTTP statuses eligible for retry (default 408,425,429,500,502,503,504)
    respectRetryAfter?: boolean; // honor a Retry-After response header (default true)
    onRetry?: (event: RetryEvent) => void; // observability hook fired before each delayed retry (must not throw; exceptions are swallowed)
    onGiveUp?: (event: RetryEvent) => void; // observability hook fired when a retryable failure exhausts all retries (must not throw; exceptions are swallowed)
}

/**
 * Per-attempt retry observability event passed to {@link RetryConfig.onRetry}
 * and {@link RetryConfig.onGiveUp}. Mirrors the cross-SDK retry-listener
 * surface so logging/metrics can be wired in without subclassing the transport.
 */
export interface RetryEvent {
    method: string; // HTTP method of the request (uppercased)
    url: string; // fully-qualified request URL
    /**
     * For `onRetry`: the 1-based number of the retry about to run (first retry
     * is `1`). For `onGiveUp`: the number of retries performed before giving up.
     */
    attempt: number;
    maxRetries: number; // configured maximum number of retries
    delayMs: number; // delay before the upcoming retry (`onRetry`); always `0` for `onGiveUp`
    status?: number; // HTTP status that triggered the decision (absent for network-error retries)
    error?: unknown; // network error that triggered the decision (absent for status-based retries)
}

/** Values accepted by the Fetch API's `credentials` request option. */
export type FetchCredentials = "omit" | "same-origin" | "include";

/** Values accepted by the Fetch API's `redirect` request option. */
export type FetchRedirect = "error" | "follow" | "manual";

export interface ConfigurationParameters {
    basePath?: string; // override base path
    fetchApi?: FetchAPI; // override for fetch implementation
    middleware?: Middleware[]; // middleware to apply before/after fetch requests
    queryParamsStringify?: (params: HTTPQuery) => string; // stringify function for query strings
    username?: string; // parameter for basic security
    password?: string; // parameter for basic security
    apiKey?: string | Promise<string> | ((name: string) => string | Promise<string>); // parameter for apiKey security
    keyId?: string; // Alpaca API key id, sent as the APCA-API-KEY-ID header (use with `secret`)
    secret?: string; // Alpaca API secret, sent as the APCA-API-SECRET-KEY header (use with `keyId`)
    paper?: boolean; // select the paper vs live host; honored only by hosts that distinguish the two (e.g. trading), ignored if basePath is set explicitly
    accessToken?: string | Promise<string> | ((name?: string, scopes?: string[]) => string | Promise<string>); // parameter for oauth2 security
    headers?: HTTPHeaders; //header params we want to use on every request
    credentials?: FetchCredentials; //value for the credentials param we want to use on each request
    timeoutMs?: number; // per-attempt timeout in ms covering the whole attempt (default 30000; set 0 to disable)
    retry?: RetryConfig; // opt-in automatic retry/backoff policy
    rateLimit?: RateLimitConfig; // opt-in proactive client-side rate limiting (off unless set)
    userAgent?: string; // override the default User-Agent header (set to "" to disable)
    sandbox?: boolean; // select the sandbox host; honored only by hosts that distinguish it (e.g. market data), ignored if basePath is set explicitly
    redirect?: FetchRedirect; // how fetch handles 3xx redirects; defaults to "error" so credentials can't follow an off-host redirect (set "follow" to opt out)
}

/**
 * Host-agnostic base `Configuration`. Subclasses supply the default host by
 * overriding {@link defaultBasePath}; everything else (auth, retry, timeout,
 * rate limiting, headers) is shared. An explicit `basePath` always wins.
 */
export class BaseConfiguration {
    private _rateLimiter?: RateLimiter | null;

    constructor(protected configuration: ConfigurationParameters = {}) {}

    set config(configuration: BaseConfiguration) {
        this.configuration = configuration as unknown as ConfigurationParameters;
        this._rateLimiter = undefined;
    }

    /**
     * The default host used when no explicit `basePath` is configured. The base
     * has no opinion; each package's `Configuration` overrides this.
     */
    protected defaultBasePath(): string {
        return "";
    }

    get basePath(): string {
        // An explicit basePath always wins; otherwise defer to the subclass host.
        if (this.configuration.basePath != null) {
            return this.configuration.basePath;
        }
        return this.defaultBasePath();
    }

    get fetchApi(): FetchAPI | undefined {
        return this.configuration.fetchApi;
    }

    get middleware(): Middleware[] {
        return this.configuration.middleware || [];
    }

    get queryParamsStringify(): (params: HTTPQuery) => string {
        return this.configuration.queryParamsStringify || querystring;
    }

    get username(): string | undefined {
        return this.configuration.username;
    }

    get password(): string | undefined {
        return this.configuration.password;
    }

    get apiKey(): ((name: string) => string | Promise<string>) | undefined {
        const { apiKey, keyId, secret } = this.configuration;
        // Preferred ergonomic path: a keyId/secret pair maps cleanly onto
        // Alpaca's two distinct auth headers.
        if (keyId != null || secret != null) {
            if (!keyId || !secret) {
                throw new Error(
                    "Alpaca authentication requires both `keyId` and `secret`.",
                );
            }
            return (name: string) => {
                if (name === "APCA-API-KEY-ID") return keyId;
                if (name === "APCA-API-SECRET-KEY") return secret;
                throw new Error(`Unexpected API key header requested: "${name}".`);
            };
        }
        if (apiKey) {
            if (typeof apiKey === 'function') {
                return apiKey;
            }
            // A bare string would be sent for BOTH the key id and the secret
            // header, which Alpaca rejects. Fail loudly with guidance instead
            // of producing an opaque 403 at request time.
            throw new Error(
                "Passing `apiKey` as a string sends the same value for both " +
                "`APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`. " +
                "Use `new Configuration({ keyId, secret })` instead.",
            );
        }
        return undefined;
    }

    get accessToken(): ((name?: string, scopes?: string[]) => string | Promise<string>) | undefined {
        const accessToken = this.configuration.accessToken;
        if (accessToken) {
            return typeof accessToken === 'function' ? accessToken : async () => accessToken;
        }
        return undefined;
    }

    get headers(): HTTPHeaders | undefined {
        return this.configuration.headers;
    }

    get credentials(): FetchCredentials | undefined {
        return this.configuration.credentials;
    }

    /**
     * How the underlying `fetch` treats 3xx redirects. Defaults to `"error"`:
     * Alpaca's APIs never redirect, and following one off-host would forward the
     * `APCA-API-KEY-ID`/`APCA-API-SECRET-KEY` headers (which, unlike
     * `Authorization`, are not stripped on a cross-origin redirect) to the
     * redirect target, leaking the secret. Set `"follow"` to opt back into the
     * platform default if you proxy through a redirecting gateway.
     */
    get redirect(): FetchRedirect {
        return this.configuration.redirect ?? "error";
    }

    get timeoutMs(): number | undefined {
        // Apply the cross-SDK default deadline when unset; an explicit `0`
        // (or negative) disables the timeout, matching `applyTimeout`.
        return this.configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    get retry(): RetryConfig | undefined {
        return this.configuration.retry;
    }

    get rateLimit(): RateLimitConfig | undefined {
        return this.configuration.rateLimit;
    }

    /**
     * Lazily-built, memoized rate limiter shared by every `Api` using this
     * `Configuration`. `undefined` when no `rateLimit` policy is configured.
     */
    get rateLimiter(): RateLimiter | undefined {
        if (this._rateLimiter === undefined) {
            this._rateLimiter = this.configuration.rateLimit
                ? new RateLimiter(this.configuration.rateLimit)
                : null;
        }
        return this._rateLimiter ?? undefined;
    }

    get userAgent(): string | undefined {
        return this.configuration.userAgent !== undefined ? this.configuration.userAgent : USER_AGENT;
    }
}

/**
 * Host-agnostic default config backing {@link BaseAPI}'s default constructor
 * argument. Real usage (the `Alpaca` client) always passes a package-specific
 * `Configuration`, so this is only a fallback for a no-argument API instance.
 */
export const DefaultConfig = new BaseConfiguration();

/**
 * This is the base class for all generated API classes.
 */
export class BaseAPI {

    private static readonly jsonRegex = /^(:?application\/json|[^;/ \t]+\/[^;/ \t]+[+]json)[ \t]*(:?;.*)?$/i;
    private middleware: Middleware[];

    constructor(protected configuration: BaseConfiguration = DefaultConfig) {
        this.middleware = configuration.middleware;
    }

    withMiddleware<T extends BaseAPI>(this: T, ...middlewares: Middleware[]) {
        const next = this.clone<T>();
        next.middleware = next.middleware.concat(...middlewares);
        return next;
    }

    withPreMiddleware<T extends BaseAPI>(this: T, ...preMiddlewares: Array<Middleware['pre']>) {
        const middlewares = preMiddlewares.map((pre) => ({ pre }));
        return this.withMiddleware<T>(...middlewares);
    }

    withPostMiddleware<T extends BaseAPI>(this: T, ...postMiddlewares: Array<Middleware['post']>) {
        const middlewares = postMiddlewares.map((post) => ({ post }));
        return this.withMiddleware<T>(...middlewares);
    }

    /**
     * Check if the given MIME is a JSON MIME.
     * JSON MIME examples:
     *   application/json
     *   application/json; charset=UTF8
     *   APPLICATION/JSON
     *   application/vnd.company+json
     * @param mime - MIME (Multipurpose Internet Mail Extensions)
     * @return True if the given MIME is JSON, false otherwise.
     */
    protected isJsonMime(mime: string | null | undefined): boolean {
        if (!mime) {
            return false;
        }
        return BaseAPI.jsonRegex.test(mime);
    }

    protected async request(context: RequestOpts, initOverrides?: RequestInit | InitOverrideFunction): Promise<Response> {
        const { url, init } = await this.createFetchParams(context, initOverrides);
        const retry = this.configuration.retry;
        const maxRetries = retry?.maxRetries ?? 0;
        const method = (init.method || context.method || 'GET').toUpperCase();
        // Only the safe/idempotent methods are auto-retried. A non-idempotent
        // POST/PATCH/etc. is never replayed (even on 429) because a request that
        // reached the server could have already mutated state; reconcile the
        // result before deciding whether to issue another request.
        const retryable = RETRYABLE_METHODS.has(method);

        let attempt = 0;
        while (true) {
            const deadline = new AttemptDeadline(this.configuration.timeoutMs, init.signal);
            let response: Response | undefined;
            let networkError: unknown;
            let release: (() => void) | undefined;
            try {
                // Proactively wait for a rate-limit slot (and honor any timeout/
                // caller abort while queued) before touching the network.
                const acquire = this.configuration.rateLimiter?.acquire(deadline.signal);
                if (acquire) {
                    // If abort wins after acquire has produced a concurrency
                    // slot but before this await receives it, release that
                    // late resource exactly once instead of leaking the slot.
                    release = await deadline.race(acquire, (lateRelease) => lateRelease());
                }
                response = await deadline.race(
                    this.fetchApi(
                        url,
                        deadline.signal ? { ...init, signal: deadline.signal } : init,
                    ),
                    (lateResponse) => discardResponse(lateResponse),
                );
            } catch (e) {
                // A transient network failure (DNS, connection reset, TLS) throws
                // a FetchError with no Response. Capture it so the retry policy
                // below can re-attempt it like a retryable status.
                networkError = normalizeCancellation(e, deadline.signal);
                deadline.cancel();
            } finally {
                release?.();
            }
            if (networkError !== undefined) {
                const isRetryable =
                    retryable &&
                    !deadline.signal?.aborted &&
                    isRetryableNetworkError(networkError);
                if (isRetryable && attempt < maxRetries) {
                    const delayMs = backoffDelay(attempt, retry);
                    notifyRetry(retry, { method, url, attempt: attempt + 1, maxRetries, delayMs, error: networkError });
                    await sleep(delayMs, init.signal);
                    attempt++;
                    continue;
                }
                if (isRetryable && maxRetries > 0) {
                    notifyGiveUp(retry, { method, url, attempt, maxRetries, delayMs: 0, error: networkError });
                }
                throw networkError;
            }
            if (response && (response.status >= 200 && response.status < 300)) {
                attachResponseDeadline(response, deadline);
                return response;
            }
            const isRetryable = retryable && isRetryableStatus(response!.status, retry);
            if (isRetryable && attempt < maxRetries) {
                deadline.cancel();
                discardResponse(response!);
                const delayMs = computeRetryDelay(response!, attempt, retry);
                notifyRetry(retry, { method, url, attempt: attempt + 1, maxRetries, delayMs, status: response!.status });
                await sleep(delayMs, init.signal);
                attempt++;
                continue;
            }
            if (isRetryable && maxRetries > 0) {
                notifyGiveUp(retry, { method, url, attempt, maxRetries, delayMs: 0, status: response!.status });
            }
            try {
                throw await buildApiError(
                    response!,
                    (body) => readBodyWithDeadline(
                        body,
                        'text',
                        deadline,
                        () => discardResponse(response!),
                    ) as Promise<string>,
                );
            } finally {
                deadline.cancel();
            }
        }
    }

    private async createFetchParams(context: RequestOpts, initOverrides?: RequestInit | InitOverrideFunction) {
        let url = this.configuration.basePath + context.path;
        if (context.query !== undefined && Object.keys(context.query).length !== 0) {
            // only add the querystring to the URL if there are query parameters.
            // this is done to avoid urls ending with a "?" character which buggy webservers
            // do not handle correctly sometimes.
            url += '?' + this.configuration.queryParamsStringify(context.query);
        }

        const defaultHeaders: HTTPHeaders = {};
        const userAgent = this.configuration.userAgent;
        if (userAgent) {
            defaultHeaders['User-Agent'] = userAgent;
        }
        const headers = Object.assign(defaultHeaders, this.configuration.headers, context.headers);

        // OAuth2 bearer auth. The generated operations only ever wire Alpaca's
        // `APCA-API-KEY-ID` / `APCA-API-SECRET-KEY` headers (the spec declares
        // apiKey security), so when an `accessToken` is configured we attach the
        // Authorization header here at the transport layer. An explicit
        // Authorization header (from config or the operation) still wins.
        const accessToken = this.configuration.accessToken;
        if (accessToken && headers.Authorization === undefined && headers.authorization === undefined) {
            const token = await accessToken();
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        }

        Object.keys(headers).forEach(key => headers[key] === undefined ? delete headers[key] : {});

        const initOverrideFn =
            typeof initOverrides === "function"
                ? initOverrides
                : async () => initOverrides;

        const initParams = {
            method: context.method,
            headers,
            body: context.body,
            credentials: this.configuration.credentials,
            // Block off-host redirects by default so the APCA-API-* secret
            // headers can't be forwarded to a redirect target. A per-call
            // `initOverrides.redirect` still wins (it's spread in below).
            redirect: this.configuration.redirect,
        };

        const overriddenInit: RequestInit = {
            ...initParams,
            ...(await initOverrideFn({
                init: initParams,
                context,
            }))
        };

        let body: any;
        if (isFormData(overriddenInit.body)
            || (overriddenInit.body instanceof URLSearchParams)
            || isBlob(overriddenInit.body)) {
          body = overriddenInit.body;
        } else if (this.isJsonMime(headers['Content-Type'])) {
          body = JSON.stringify(overriddenInit.body);
        } else {
          body = overriddenInit.body;
        }

        const init: RequestInit = {
            ...overriddenInit,
            body
        };

        return { url, init };
    }

    private fetchApi = async (url: string, init: RequestInit) => {
        let fetchParams = { url, init };
        for (const middleware of this.middleware) {
            if (middleware.pre) {
                fetchParams = await middleware.pre({
                    fetch: this.fetchApi,
                    ...fetchParams,
                }) || fetchParams;
            }
        }
        let response: Response | undefined ;
        try {
            response = await (this.configuration.fetchApi || fetch)(fetchParams.url, fetchParams.init);
        } catch (e) {
            for (const middleware of this.middleware) {
                if (middleware.onError) {
                    response = await middleware.onError({
                        fetch: this.fetchApi,
                        url: fetchParams.url,
                        init: fetchParams.init,
                        error: e,
                        response: response ? response.clone() : undefined,
                    }) || response;
                }
            }
            if (response === undefined) {
              if (e instanceof Error) {
                throw new FetchError(e, 'The request failed and the interceptors did not return an alternative response');
              } else {
                throw e;
              }
            }
        }
        for (const middleware of this.middleware) {
            if (middleware.post) {
                response = await middleware.post({
                    fetch: this.fetchApi,
                    url: fetchParams.url,
                    init: fetchParams.init,
                    response: response.clone(),
                }) || response;
            }
        }
        return response;
    }

    /**
     * Create a shallow clone of `this` by constructing a new instance
     * and then shallow cloning data members.
     */
    private clone<T extends BaseAPI>(this: T): T {
        const constructor = this.constructor as any;
        const next = new constructor(this.configuration);
        next.middleware = this.middleware.slice();
        return next;
    }
};

function isBlob(value: any): value is Blob {
    return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isFormData(value: any): value is FormData {
    return typeof FormData !== "undefined" && value instanceof FormData;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(normalizeCancellation(abortReason(signal), signal));
            return;
        }
        const onAbort = (): void => {
            if (!signal) return;
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(normalizeCancellation(abortReason(signal), signal));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function abortReason(signal: AbortSignal): unknown {
    return (signal as AbortSignal & { reason?: unknown }).reason ??
        new DOMException('The operation was aborted.', 'AbortError');
}

function normalizeCancellation(error: unknown, signal?: AbortSignal): unknown {
    if (error instanceof FetchError) {
        return error;
    }
    const cause = signal?.aborted ? abortReason(signal) : error;
    const name = (cause as { name?: unknown } | undefined)?.name;
    if (signal?.aborted || name === 'AbortError' || name === 'TimeoutError') {
        const errorCause = cause instanceof Error
            ? cause
            : new DOMException(String(cause ?? 'The operation was aborted.'), 'AbortError');
        return new FetchError(errorCause, 'The request was aborted');
    }
    return error;
}

/**
 * One phase-specific request deadline. The timer starts immediately before a
 * rate-limit acquisition and stays live through fetch, post middleware, and
 * response-body consumption. Retry backoff happens only after this deadline is
 * cancelled; the next attempt constructs a fresh instance.
 */
class AttemptDeadline {
    readonly signal?: AbortSignal;
    private timer?: ReturnType<typeof setTimeout>;
    private callerSignal?: AbortSignal;
    private onCallerAbort?: () => void;
    private onDeadlineAbort?: () => void;
    private stopped = false;

    constructor(timeoutMs: number | undefined, callerSignal?: AbortSignal | null) {
        if (!timeoutMs || timeoutMs <= 0) {
            this.signal = callerSignal ?? undefined;
            return;
        }

        const controller = new AbortController();
        this.signal = controller.signal;
        this.callerSignal = callerSignal ?? undefined;
        this.onDeadlineAbort = () => this.stopClock();
        controller.signal.addEventListener('abort', this.onDeadlineAbort, { once: true });
        this.timer = setTimeout(
            () => controller.abort(
                new DOMException(`Request timed out after ${timeoutMs} ms`, 'TimeoutError'),
            ),
            timeoutMs,
        );

        if (callerSignal?.aborted) {
            controller.abort(abortReason(callerSignal));
        } else if (callerSignal) {
            this.onCallerAbort = () => controller.abort(abortReason(callerSignal));
            callerSignal.addEventListener('abort', this.onCallerAbort, { once: true });
        }
    }

    race<T>(
        operation: Promise<T>,
        onLateResolve?: (value: T) => void,
        onCancellation?: () => void,
    ): Promise<T> {
        const signal = this.signal;
        if (!signal) {
            return operation.catch((error) => {
                throw normalizeCancellation(error);
            });
        }
        if (signal.aborted) {
            try {
                onCancellation?.();
            } catch {
                // Resource cleanup must not mask the cancellation.
            }
            // The operation may already have started (for example, a custom
            // fetch called with an already-aborted signal). Observe its eventual
            // rejection so the prompt cancellation does not leak an unhandled
            // promise.
            void operation.then(
                (value) => {
                    try {
                        onLateResolve?.(value);
                    } catch {
                        // Resource cleanup must not create an unhandled rejection.
                    }
                },
                () => {},
            );
            return Promise.reject(normalizeCancellation(abortReason(signal), signal));
        }
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const cleanup = (): void => signal.removeEventListener('abort', onAbort);
            const onAbort = (): void => {
                if (settled) return;
                settled = true;
                cleanup();
                try {
                    onAbortCallback?.();
                } catch {
                    // Resource cleanup must not mask the cancellation.
                }
                reject(normalizeCancellation(abortReason(signal), signal));
            };
            const onAbortCallback = onCancellation;
            signal.addEventListener('abort', onAbort, { once: true });
            operation.then(
                (value) => {
                    cleanup();
                    if (settled) {
                        try {
                            onLateResolve?.(value);
                        } catch {
                            // Resource cleanup must not create an unhandled rejection.
                        }
                        return;
                    }
                    settled = true;
                    resolve(value);
                },
                (error) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(normalizeCancellation(error, signal));
                },
            );
        });
    }

    cancel(): void {
        this.stopClock();
    }

    private stopClock(): void {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        if (this.callerSignal && this.onCallerAbort) {
            this.callerSignal.removeEventListener('abort', this.onCallerAbort);
            this.onCallerAbort = undefined;
        }
        if (this.signal && this.onDeadlineAbort) {
            this.signal.removeEventListener('abort', this.onDeadlineAbort);
            this.onDeadlineAbort = undefined;
        }
    }
}

interface ResponseDeadlineContext {
    deadline: AttemptDeadline;
    signal: AbortSignal;
    onAbort?: () => void;
}

const responseDeadlines = new WeakMap<Response, ResponseDeadlineContext>();
const discardedResponses = new WeakSet<Response>();

function discardResponse(response: Response): void {
    if (discardedResponses.has(response)) {
        return;
    }
    discardedResponses.add(response);
    try {
        void response.body?.cancel().catch(() => {});
    } catch {
        // A custom/locked body may not be cancellable; the attempt deadline is
        // still fully detached before retry backoff begins.
    }
}

function attachResponseDeadline(response: Response, deadline: AttemptDeadline): void {
    const signal = deadline.signal;
    if (!signal) {
        return;
    }
    const context: ResponseDeadlineContext = { deadline, signal };
    context.onAbort = () => {
        context.onAbort = undefined;
        responseDeadlines.delete(response);
        discardResponse(response);
    };
    signal.addEventListener('abort', context.onAbort, { once: true });
    responseDeadlines.set(response, context);
    const descriptors: PropertyDescriptorMap = {};
    for (const method of [
        'arrayBuffer',
        'blob',
        'formData',
        'json',
        'text',
    ] as const) {
        const reader = response[method].bind(response);
        descriptors[method] = {
            configurable: true,
            value: () => consumeResponse(response, method, reader),
        };
    }
    const bytes = (response as Response & {
        bytes?: () => Promise<Uint8Array>;
    }).bytes;
    if (typeof bytes === 'function') {
        descriptors.bytes = {
            configurable: true,
            value: () => consumeResponse(response, 'bytes', bytes.bind(response)),
        };
    }
    Object.defineProperties(response, descriptors);
}

const DEFAULT_RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504];

/** HTTP methods eligible for automatic retry (safe/idempotent only). */
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

/** Default base backoff (ms) for the first retry. */
const DEFAULT_RETRY_DELAY_MS = 250;
/** Default cap (ms) for any single backoff delay. */
const DEFAULT_MAX_DELAY_MS = 5_000;

function isRetryableStatus(status: number, retry?: RetryConfig): boolean {
    const statuses = retry?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
    return statuses.indexOf(status) !== -1;
}

/**
 * A thrown `fetch` failure (network error: DNS, connection reset, TLS) is
 * retryable, but a deliberate abort - whether caller-initiated or from the
 * `timeoutMs` deadline - is not. Aborts surface as a {@link FetchError} whose
 * `cause` is an `AbortError`/`TimeoutError`.
 */
function isRetryableNetworkError(error: unknown): boolean {
    if (!(error instanceof FetchError)) {
        return false;
    }
    const name = (error.cause as { name?: string } | undefined)?.name;
    return name !== 'AbortError' && name !== 'TimeoutError';
}

/**
 * Fire a retry observability hook. Observability must never break the request,
 * so a throwing listener is swallowed (consistent with the streaming layer's
 * isolated-callback policy).
 */
function notifyRetry(retry: RetryConfig | undefined, event: RetryEvent): void {
    const handler = retry?.onRetry;
    if (!handler) return;
    try {
        handler(event);
    } catch {
        // listener exceptions are intentionally swallowed
    }
}

function notifyGiveUp(retry: RetryConfig | undefined, event: RetryEvent): void {
    const handler = retry?.onGiveUp;
    if (!handler) return;
    try {
        handler(event);
    } catch {
        // listener exceptions are intentionally swallowed
    }
}

/**
 * Exponential backoff (doubling per attempt) with `±20%` jitter, capped at
 * `maxDelayMs`. Jitter is symmetric (randomized between `0.8x` and `1.2x`) and
 * the result is capped after jitter so it never exceeds the configured max.
 */
function backoffDelay(attempt: number, retry?: RetryConfig): number {
    const base = retry?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const cap = retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    const backoff = Math.min(base * 2 ** attempt, cap);
    // 0.8x..1.2x jitter band.
    const jittered = backoff * (0.8 + Math.random() * 0.4);
    return Math.min(jittered, cap);
}

function computeRetryDelay(response: Response, attempt: number, retry?: RetryConfig): number {
    const cap = retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    if ((retry?.respectRetryAfter ?? true) && response.headers) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
            const secs = Number(retryAfter);
            if (!Number.isNaN(secs)) {
                return Math.min(secs * 1000, cap);
            }
            const when = Date.parse(retryAfter);
            if (!Number.isNaN(when)) {
                return Math.min(Math.max(0, when - Date.now()), cap);
            }
        }
    }
    return backoffDelay(attempt, retry);
}

export class RequiredError extends Error {
    override name: "RequiredError" = "RequiredError";
    constructor(public field: string, msg?: string) {
        super(msg);
    }
}

export const COLLECTION_FORMATS = {
    csv: ",",
    ssv: " ",
    tsv: "\t",
    pipes: "|",
};

/** Fetch-compatible function used by the generated transport. */
export type FetchAPI = (url: string, init: RequestInit) => Promise<Response>;

export type Json = any;
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type HTTPHeaders = { [key: string]: string };
export type HTTPQuery = { [key: string]: string | number | null | boolean | Array<string | number | null | boolean> | Set<string | number | null | boolean> | HTTPQuery };
export type HTTPBody = Json | FormData | URLSearchParams;
export type HTTPRequestInit = { headers?: HTTPHeaders; method: HTTPMethod; credentials?: FetchCredentials; body?: HTTPBody };
export type ModelPropertyNaming = 'camelCase' | 'snake_case' | 'PascalCase' | 'original';

export type InitOverrideFunction = (requestContext: { init: HTTPRequestInit, context: RequestOpts }) => Promise<RequestInit>

export interface FetchParams {
    url: string;
    init: RequestInit;
}

export interface RequestOpts {
    path: string;
    method: HTTPMethod;
    headers: HTTPHeaders;
    query?: HTTPQuery;
    body?: HTTPBody;
}

export function querystring(params: HTTPQuery, prefix: string = ''): string {
    return Object.keys(params)
        .map(key => querystringSingleKey(key, params[key], prefix))
        .filter(part => part.length > 0)
        .join('&');
}

function querystringSingleKey(key: string, value: string | number | null | undefined | boolean | Array<string | number | null | boolean> | Set<string | number | null | boolean> | HTTPQuery, keyPrefix: string = ''): string {
    const fullKey = keyPrefix + (keyPrefix.length ? `[${key}]` : key);
    if (value instanceof Array) {
        const multiValue = value.map(singleValue => encodeURIComponent(String(singleValue)))
            .join(`&${encodeURIComponent(fullKey)}=`);
        return `${encodeURIComponent(fullKey)}=${multiValue}`;
    }
    if (value instanceof Set) {
        const valueAsArray = Array.from(value);
        return querystringSingleKey(key, valueAsArray, keyPrefix);
    }
    if (value instanceof Date) {
        return `${encodeURIComponent(fullKey)}=${encodeURIComponent(value.toISOString())}`;
    }
    if (value instanceof Object) {
        return querystring(value as HTTPQuery, fullKey);
    }
    return `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`;
}

export function exists(json: any, key: string) {
    const value = json[key];
    return value !== null && value !== undefined;
}

export function mapValues(data: any, fn: (item: any) => any) {
    const result: { [key: string]: any } = {};
    for (const key of Object.keys(data)) {
        result[key] = fn(data[key]);
    }
    return result;
}

export function canConsumeForm(consumes: Consume[]): boolean {
    for (const consume of consumes) {
        if ('multipart/form-data' === consume.contentType) {
            return true;
        }
    }
    return false;
}

export interface Consume {
    contentType: string;
}

export interface RequestContext {
    fetch: FetchAPI;
    url: string;
    init: RequestInit;
}

export interface ResponseContext {
    fetch: FetchAPI;
    url: string;
    init: RequestInit;
    response: Response;
}

export interface ErrorContext {
    fetch: FetchAPI;
    url: string;
    init: RequestInit;
    error: unknown;
    response?: Response;
}

export interface Middleware {
    pre?(context: RequestContext): Promise<FetchParams | void>;
    post?(context: ResponseContext): Promise<Response | void>;
    onError?(context: ErrorContext): Promise<Response | void>;
}

export interface ApiResponse<T> {
    raw: Response;
    value(): Promise<T>;
}

export type ResponseTransformer<T> = (json: any) => T

type BodyReaderMethod =
    | 'arrayBuffer'
    | 'blob'
    | 'bytes'
    | 'formData'
    | 'json'
    | 'text';

function detachResponseAbort(
    response: Response,
    context: ResponseDeadlineContext,
): void {
    if (context.onAbort) {
        context.signal.removeEventListener('abort', context.onAbort);
        context.onAbort = undefined;
    }
    responseDeadlines.delete(response);
}

async function readBodyWithDeadline(
    response: Response,
    method: BodyReaderMethod,
    deadline: AttemptDeadline,
    onCancellation?: () => void,
): Promise<unknown> {
    const body = response.body;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let readerCancelled = false;
    const cancelReader = (): void => {
        if (readerCancelled) return;
        readerCancelled = true;
        try {
            void reader?.cancel(
                deadline.signal?.aborted
                    ? abortReason(deadline.signal)
                    : undefined,
            ).catch(() => {});
        } catch {
            // A custom reader may throw synchronously while being cancelled.
        }
        onCancellation?.();
    };

    const operation = (async (): Promise<unknown> => {
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        if (body) {
            reader = body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    totalLength += value.byteLength;
                }
            } finally {
                reader.releaseLock();
            }
        }

        const bytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }

        switch (method) {
            case 'arrayBuffer':
                return bytes.buffer;
            case 'blob':
                return new Blob(
                    [bytes],
                    { type: response.headers.get('Content-Type') ?? '' },
                );
            case 'bytes':
                return bytes;
            case 'formData':
                return new Response(bytes, {
                    headers: response.headers,
                }).formData();
            case 'json':
                return JSON.parse(new TextDecoder().decode(bytes));
            case 'text':
                return new TextDecoder().decode(bytes);
        }
    })();

    return deadline.race(operation, undefined, cancelReader);
}

async function consumeResponse<T>(
    response: Response,
    method: BodyReaderMethod,
    nativeReader: () => Promise<T>,
): Promise<T> {
    const context = responseDeadlines.get(response);
    if (!context) {
        return nativeReader().catch((error) => {
            throw normalizeCancellation(error);
        });
    }
    detachResponseAbort(response, context);
    try {
        return await readBodyWithDeadline(
            response,
            method,
            context.deadline,
        ) as T;
    } finally {
        context.deadline.cancel();
    }
}

function releaseResponse(response: Response): void {
    const context = responseDeadlines.get(response);
    if (context) {
        detachResponseAbort(response, context);
    }
    discardResponse(response);
    context?.deadline.cancel();
}

export class JSONApiResponse<T> {
    constructor(public raw: Response, protected transformer: ResponseTransformer<T> = (jsonValue: any) => jsonValue) {}

    async value(): Promise<T> {
        return this.transformer(await this.raw.json());
    }
}

export class VoidApiResponse {
    constructor(public raw: Response) {}

    async value(): Promise<void> {
        releaseResponse(this.raw);
        return undefined;
    }
}

export class BlobApiResponse {
    constructor(public raw: Response) {}

    async value(): Promise<Blob> {
        return await this.raw.blob();
    };
}

export class TextApiResponse {
    constructor(public raw: Response) {}

    async value(): Promise<string> {
        return await this.raw.text();
    };
}
