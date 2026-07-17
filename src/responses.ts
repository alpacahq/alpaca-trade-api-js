import type { ApiResponse } from "./core/runtime";
import { parseRateLimit, type RateLimitInfo } from "./errors";

/**
 * Typed response wrapper that pairs a deserialized body with its HTTP status,
 * response headers, and parsed rate-limit metadata. This is the cross-SDK
 * "response with headers" convenience: the plain client methods return just the
 * body, so reach for {@link withResponse} when you also need the status line,
 * headers, or `X-RateLimit-*` values.
 */
export interface AlpacaApiResponse<T> {
    /** Deserialized response body (what the non-`Raw` method would have returned). */
    data: T;
    /** HTTP status code. */
    status: number;
    /** Response headers. */
    headers: Headers;
    /** Parsed `X-RateLimit-*` headers, when the response carried them. */
    rateLimit?: RateLimitInfo;
}

/**
 * Wrap any generated `*Raw` call so you get the body plus response metadata in
 * one typed object, without manually reading `raw.status` / `raw.headers`.
 *
 * Every generated client method has a `*Raw` sibling returning an
 * {@link ApiResponse} (the underlying `Response` plus a `value()` body reader);
 * pass that (or its promise) here:
 *
 * ```ts
 * const res = await withResponse(alpaca.trading.account.getAccountRaw());
 * res.data;             // typed Account
 * res.status;           // 200
 * res.headers.get(...); // any response header
 * res.rateLimit?.remaining;
 * ```
 *
 * The body stream is consumed exactly once (via `value()`), so do not also read
 * the body from the original `ApiResponse` after calling this.
 */
export async function withResponse<T>(
    raw: ApiResponse<T> | Promise<ApiResponse<T>>,
): Promise<AlpacaApiResponse<T>> {
    const resolved = await raw;
    const data = await resolved.value();
    return {
        data,
        status: resolved.raw.status,
        headers: resolved.raw.headers,
        rateLimit: parseRateLimit(resolved.raw.headers),
    };
}
