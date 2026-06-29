export * as trading from './trading';
export * as marketData from './market-data';
export * as marketDataShapes from './marketDataShapes';
export * as pagination from './pagination';
export * as auth from './auth';
export * as streaming from './streaming';
export * as values from './values';
export * as orders from './orders';
export * as errors from './errors';
export * as rateLimit from './rate-limit';
export * as capabilities from './capabilities';
export * as middleware from './middleware';

export { Alpaca, TradingClient, MarketDataClient, OrdersApi, LIVE_TRADING_BASE_PATH, DEFAULT_RATE_LIMIT } from './client';
export type { AlpacaClientOptions, SymbolCollectOptions } from './client';

export { TimeFrame, TimeFrameUnit, timeFrame } from './values';
export type { Money } from './values';

export { toCandles, toCandlestickSeries, toLineSeries } from './marketDataShapes';
export type {
    Bar,
    Trade,
    Quote,
    Candles,
    CandlestickPoint,
    LinePoint,
    TimeUnit,
    ChartOptions,
} from './marketDataShapes';

export {
    ResponseError,
    ApiError,
    AuthError,
    PermissionError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    FetchError,
} from './errors';
export type { RateLimitInfo } from './errors';

export { RateLimiter } from './rate-limit';
export type { RateLimitConfig } from './rate-limit';

export { findCapabilities, findErgonomic, streamingCapabilities, ergonomicCapabilities } from './capabilities';
export type { CapabilityEntry, StreamCapabilityEntry, CapabilityGroup, ErgonomicHelperEntry, ErgonomicKind } from './capabilities';
