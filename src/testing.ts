/**
 * Test harness for code built on `@alpacahq/alpaca-ts-alpha` (`@alpacahq/alpaca-ts-alpha/testing`).
 *
 * `mockFetch` builds a `fetchApi` that answers canned responses by HTTP
 * method + path, and `createMockAlpaca` wires one into a ready-to-use `Alpaca`
 * client. This keeps consumers' unit tests off the network without hand-rolling
 * `Response` plumbing.
 *
 * Exposed on a dedicated subpath so it stays out of the main bundle.
 */
import { Alpaca, type AlpacaClientOptions } from "./client";
import type { FetchAPI } from "./trading";

/** The request a {@link MockResponder} sees. */
export interface MockRequest {
    method: string;
    url: URL;
    init?: RequestInit;
}

/**
 * Dynamic route handler. May return a `Response`, a string (200 text), or a
 * plain object (200 JSON).
 */
export type MockResponder = (
    request: MockRequest,
) => Response | string | Record<string, unknown> | Promise<Response | string | Record<string, unknown>>;

/** A single canned route. Match on `path` (and optionally `method`). */
export interface MockRoute {
    /** HTTP method to match (case-insensitive). Omit to match any method. */
    method?: string;
    /** Exact `URL.pathname` (string) or a pattern tested against it (RegExp). */
    path: string | RegExp;
    /** Response status. Default `200`. */
    status?: number;
    /** Extra response headers. */
    headers?: Record<string, string>;
    /** Response body: an object is JSON-encoded; a string is sent as-is. */
    body?: unknown;
    /** Dynamic alternative to `status`/`body`/`headers`. */
    respond?: MockResponder;
}

export interface MockFetchOptions {
    /** Handler for requests that match no route. Default: a 404 JSON response. */
    fallback?: MockResponder;
}

function buildResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
    if (body === undefined || body === null) {
        return new Response(null, { status, headers });
    }
    if (typeof body === "string") {
        return new Response(body, { status, headers });
    }
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

function coerce(result: Response | string | Record<string, unknown>): Response {
    if (result instanceof Response) return result;
    return buildResponse(200, result);
}

function matchRoute(route: MockRoute, method: string, url: URL): boolean {
    if (route.method && route.method.toUpperCase() !== method) return false;
    return typeof route.path === "string" ? url.pathname === route.path : route.path.test(url.pathname);
}

/**
 * Build a `fetchApi` (the `Configuration`/`Alpaca` `fetchApi` option) that
 * answers from `routes`. The first matching route wins; unmatched requests get
 * the `fallback` (or a 404 that names the unmatched method + path).
 */
export function mockFetch(routes: MockRoute[], options: MockFetchOptions = {}): FetchAPI {
    const fetchApi = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
        const url = new URL(rawUrl);
        const method = (init?.method ?? "GET").toUpperCase();
        const request: MockRequest = { method, url, init };

        const route = routes.find((r) => matchRoute(r, method, url));
        if (route) {
            if (route.respond) return coerce(await route.respond(request));
            return buildResponse(route.status ?? 200, route.body, route.headers);
        }
        if (options.fallback) return coerce(await options.fallback(request));
        return buildResponse(404, { message: `No mock route for ${method} ${url.pathname}` });
    };
    return fetchApi as unknown as FetchAPI;
}

/** Options for {@link createMockAlpaca}: any `Alpaca` option plus a mock `fallback`. */
export type CreateMockAlpacaOptions = Partial<AlpacaClientOptions> & MockFetchOptions;

/**
 * Create an `Alpaca` client backed by {@link mockFetch}. Credentials default to
 * dummy values and client-side rate limiting is disabled (no need in tests).
 * Any real `Alpaca` option can be overridden (except `fetchApi`, which is set
 * to the mock).
 */
export function createMockAlpaca(routes: MockRoute[], options: CreateMockAlpacaOptions = {}): Alpaca {
    const { fallback, keyId, secret, ...rest } = options;
    return new Alpaca({
        keyId: keyId ?? "test-key-id",
        secret: secret ?? "test-secret",
        rateLimit: false,
        ...rest,
        fetchApi: mockFetch(routes, { fallback }),
    });
}
