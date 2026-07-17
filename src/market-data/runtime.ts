/* tslint:disable */
/* eslint-disable */
/**
 * Market Data API transport.
 *
 * The shared HTTP transport (retry, timeout, rate limiting, typed errors,
 * middleware) lives in `../core/runtime` and is re-exported here. This shim
 * only adds the Market Data hosts. Unlike trading, market data uses a single
 * production host for both paper and live accounts, so the `paper` flag has no
 * effect here (accepted for symmetry with the trading `Configuration`); the
 * separate `sandbox` flag selects Alpaca's market-data sandbox host.
 */
export * from "../core/runtime";

import { parse as parseLossless } from "lossless-json";
import {
    BaseAPI as CoreBaseAPI,
    BaseConfiguration,
    JSONApiResponse as CoreJSONApiResponse,
} from "../core/runtime";

/**
 * Number reviver for the lossless market-data JSON parse. Market-data ids are
 * 64-bit integers and crypto trade ids run past `Number.MAX_SAFE_INTEGER`
 * (`2^53`), where a JS `number` silently loses precision. This keeps such
 * integers as their exact decimal `string` and returns a plain `number` for
 * everything a `number` can represent losslessly (floats and safe integers), so
 * the only runtime shift versus native `JSON.parse` is: integer tokens beyond
 * `2^53` become strings — in practice, crypto trade ids.
 */
function losslessNumber(raw: string): number | string {
    if (/^-?\d+$/.test(raw)) {
        const n = Number(raw);
        return Number.isSafeInteger(n) ? n : raw;
    }
    return Number(raw);
}

/**
 * Market-data {@link CoreJSONApiResponse} that parses the body losslessly so
 * 64-bit ids survive with full precision (see {@link losslessNumber}). This
 * subclass is exported to shadow the `export *` re-export above, so every
 * generated market-data API — which builds `new runtime.JSONApiResponse(...)` —
 * transparently picks it up. The trading transport is unaffected.
 */
export class JSONApiResponse<T> extends CoreJSONApiResponse<T> {
    override async value(): Promise<T> {
        const text = await this.raw.text();
        const parsed = text === "" ? undefined : parseLossless(text, undefined, losslessNumber);
        return this.transformer(parsed);
    }
}

export const MARKET_DATA_HOST = "https://data.alpaca.markets";
export const MARKET_DATA_SANDBOX_HOST = "https://data.sandbox.alpaca.markets";

export const BASE_PATH = MARKET_DATA_HOST.replace(/\/+$/, "");

/**
 * Market-data `Configuration`. A single production host serves both the paper
 * and live environments (so the `paper` flag is ignored); set `sandbox: true`
 * to target the market-data sandbox host. An explicit `basePath` still wins.
 */
export class Configuration extends BaseConfiguration {
    protected override defaultBasePath(): string {
        return this.configuration.sandbox === true ? MARKET_DATA_SANDBOX_HOST : MARKET_DATA_HOST;
    }
}

export const DefaultConfig = new Configuration();

/**
 * Base class for the generated Market Data API classes. Identical to the shared
 * {@link CoreBaseAPI} but defaults to this package's {@link DefaultConfig} (the
 * market-data host) when constructed without a `Configuration`.
 */
export class BaseAPI extends CoreBaseAPI {
    constructor(configuration: BaseConfiguration = DefaultConfig) {
        super(configuration);
    }
}
