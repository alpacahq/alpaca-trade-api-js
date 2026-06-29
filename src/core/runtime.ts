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
export const USER_AGENT = "@alpacahq/alpaca-ts-alpha/0.0.0";

/**
 * Default per-request timeout in ms, applied when `timeoutMs` is not configured.
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
 * is never auto-retried (use an `Idempotency-Key` to make a POST safely
 * retryable yourself).
 */
export interface RetryConfig {
    maxRetries?: number; // max retry attempts after the initial request (default 0 = off)
    retryDelayMs?: number; // base backoff in ms for exponential backoff (default 250)
    maxDelayMs?: number; // cap for any single backoff delay in ms (default 5000)
    retryableStatuses?: number[]; // HTTP statuses eligible for retry (default 408,425,429,500,502,503,504)
    respectRetryAfter?: boolean; // honor a Retry-After response header (default true)
}

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
    credentials?: RequestCredentials; //value for the credentials param we want to use on each request
    timeoutMs?: number; // per-request timeout in ms; aborts the fetch via AbortController when exceeded (default 30000; set 0 to disable)
    retry?: RetryConfig; // opt-in automatic retry/backoff policy
    rateLimit?: RateLimitConfig; // opt-in proactive client-side rate limiting (off unless set)
    userAgent?: string; // override the default User-Agent header (set to "" to disable)
    sandbox?: boolean; // select the sandbox host; honored only by hosts that distinguish it (e.g. market data), ignored if basePath is set explicitly
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

    get credentials(): RequestCredentials | undefined {
        return this.configuration.credentials;
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
        // reached the server could have already mutated state; use an
        // `Idempotency-Key` to make a POST safely retryable yourself.
        const retryable = RETRYABLE_METHODS.has(method);

        let attempt = 0;
        while (true) {
            const timeout = applyTimeout(this.configuration.timeoutMs, init.signal);
            let response: Response | undefined;
            let networkError: unknown;
            let release: (() => void) | undefined;
            try {
                // Proactively wait for a rate-limit slot (and honor any timeout/
                // caller abort while queued) before touching the network.
                release = await this.configuration.rateLimiter?.acquire(timeout.signal);
                response = await this.fetchApi(url, timeout.signal ? { ...init, signal: timeout.signal } : init);
            } catch (e) {
                // A transient network failure (DNS, connection reset, TLS) throws
                // a FetchError with no Response. Capture it so the retry policy
                // below can re-attempt it like a retryable status.
                networkError = e;
            } finally {
                timeout.cancel();
                release?.();
            }
            if (networkError !== undefined) {
                const canRetry = attempt < maxRetries
                    && retryable
                    && isRetryableNetworkError(networkError);
                if (canRetry) {
                    await sleep(backoffDelay(attempt, retry));
                    attempt++;
                    continue;
                }
                throw networkError;
            }
            if (response && (response.status >= 200 && response.status < 300)) {
                return response;
            }
            const canRetry = attempt < maxRetries
                && retryable
                && isRetryableStatus(response!.status, retry);
            if (canRetry) {
                await sleep(computeRetryDelay(response!, attempt, retry));
                attempt++;
                continue;
            }
            throw await buildApiError(response!);
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

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface TimeoutHandle {
    signal?: AbortSignal;
    cancel: () => void;
}

function applyTimeout(timeoutMs: number | undefined, existing?: AbortSignal | null): TimeoutHandle {
    if (!timeoutMs || timeoutMs <= 0) {
        return { signal: existing ?? undefined, cancel: () => {} };
    }
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(new DOMException(`Request timed out after ${timeoutMs} ms`, 'TimeoutError')),
        timeoutMs,
    );
    const onAbort = () => controller.abort((existing as any)?.reason);
    if (existing) {
        if (existing.aborted) {
            controller.abort((existing as any).reason);
        } else {
            existing.addEventListener('abort', onAbort, { once: true });
        }
    }
    return {
        signal: controller.signal,
        cancel: () => {
            clearTimeout(timer);
            if (existing) {
                existing.removeEventListener('abort', onAbort);
            }
        },
    };
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

export type FetchAPI = WindowOrWorkerGlobalScope['fetch'];

export type Json = any;
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type HTTPHeaders = { [key: string]: string };
export type HTTPQuery = { [key: string]: string | number | null | boolean | Array<string | number | null | boolean> | Set<string | number | null | boolean> | HTTPQuery };
export type HTTPBody = Json | FormData | URLSearchParams;
export type HTTPRequestInit = { headers?: HTTPHeaders; method: HTTPMethod; credentials?: RequestCredentials; body?: HTTPBody };
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

export class JSONApiResponse<T> {
    constructor(public raw: Response, private transformer: ResponseTransformer<T> = (jsonValue: any) => jsonValue) {}

    async value(): Promise<T> {
        return this.transformer(await this.raw.json());
    }
}

export class VoidApiResponse {
    constructor(public raw: Response) {}

    async value(): Promise<void> {
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
