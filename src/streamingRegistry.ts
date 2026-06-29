/**
 * Tiny indirection so the REST facade can construct streaming clients without
 * statically depending on the `streaming` module (and therefore on its `ws` /
 * `@msgpack/msgpack` runtime dependencies).
 *
 * The `streaming` module registers its implementation here as a side effect of
 * being loaded. The main `@alpacahq/alpaca-ts-alpha` entrypoint re-exports `streaming`, so it
 * is always loaded there and the stream factories work. The `@alpacahq/alpaca-ts-alpha/rest`
 * entrypoint never loads `streaming`, so {@link getStreaming} throws a clear
 * error if a stream factory is used from it - and `ws`/msgpack stay out of the
 * REST-only module graph.
 *
 * This module imports `streaming` for *types only* (erased at build time), so
 * it adds no runtime dependency itself.
 */
/**
 * The streaming constructors + event enum the facade needs at runtime. Declared
 * via `typeof import(...)` so this module carries no runtime dependency on
 * `streaming` (the type-level dynamic import is fully erased).
 */
export interface StreamingImpl {
    TradingStream: typeof import("./streaming").TradingStream;
    StockDataStream: typeof import("./streaming").StockDataStream;
    CryptoDataStream: typeof import("./streaming").CryptoDataStream;
    OptionDataStream: typeof import("./streaming").OptionDataStream;
    NewsStream: typeof import("./streaming").NewsStream;
    EVENT: typeof import("./streaming").EVENT;
}

let impl: StreamingImpl | undefined;

/** Called by the `streaming` module when it is loaded. */
export function provideStreaming(streaming: StreamingImpl): void {
    impl = streaming;
}

/**
 * Returns the registered streaming implementation, or throws if `streaming`
 * was never loaded (e.g. when using the `@alpacahq/alpaca-ts-alpha/rest` entrypoint).
 */
export function getStreaming(): StreamingImpl {
    if (impl === undefined) {
        throw new Error(
            "Real-time streaming is unavailable from the '@alpacahq/alpaca-ts-alpha/rest' entrypoint. " +
            "Import from '@alpacahq/alpaca-ts-alpha' to use stream factories (stockStream, stream, submitAndWait, ...).",
        );
    }
    return impl;
}
