/* tslint:disable */
/* eslint-disable */
/**
 * Trading API transport.
 *
 * The shared HTTP transport (retry, timeout, rate limiting, typed errors,
 * middleware) lives in `../core/runtime` and is re-exported here. This shim
 * only adds the Trading hosts and a `Configuration` that resolves paper vs
 * live. Prefer the `paper` flag on `Configuration` (or the top-level `Alpaca`
 * client) over hand-setting `basePath` so "accidentally on the wrong
 * environment" is harder to do.
 */
export * from "../core/runtime";

import { BaseAPI as CoreBaseAPI, BaseConfiguration } from "../core/runtime";

export const TRADING_PAPER_HOST = "https://paper-api.alpaca.markets";
export const TRADING_LIVE_HOST = "https://api.alpaca.markets";

export const BASE_PATH = TRADING_PAPER_HOST.replace(/\/+$/, "");

/**
 * Trading `Configuration`. Resolves the host from the `paper` flag (defaulting
 * to the safe paper environment) unless an explicit `basePath` is set.
 */
export class Configuration extends BaseConfiguration {
    protected override defaultBasePath(): string {
        return this.configuration.paper === false ? TRADING_LIVE_HOST : TRADING_PAPER_HOST;
    }
}

export const DefaultConfig = new Configuration();

/**
 * Base class for the generated Trading API classes. Identical to the shared
 * {@link CoreBaseAPI} but defaults to this package's {@link DefaultConfig} (the
 * paper host) when constructed without a `Configuration`, preserving the
 * paper-safe default for `new SomeApi()`.
 */
export class BaseAPI extends CoreBaseAPI {
    constructor(configuration: BaseConfiguration = DefaultConfig) {
        super(configuration);
    }
}
