/**
 * Canonical, friendly market-data shapes shared by the REST and streaming
 * layers, plus chart-ready helpers.
 *
 * The generated REST models keep Alpaca's compact wire keys (`StockBar` is
 * `{ o, h, l, c, v, vw, n, t }`, `StockTrade` is `{ p, s, i, x, c, t, z }`,
 * ...), while the real-time stream already surfaces readable camelCase. A
 * dashboard that backfills history over REST and then appends live updates over
 * the WebSocket would otherwise have to reconcile two different shapes for the
 * same concept.
 *
 * This module is the single source of truth for the friendly shapes: it maps
 * the REST models onto canonical {@link Bar} / {@link Trade} / {@link Quote}
 * objects, and the streaming layer ({@link "./streaming/types"}) re-exports the
 * same types so both paths converge. The chart helpers reshape a `Bar[]` into
 * the columnar / point-series forms common charting libraries expect.
 *
 * It is hand-written and lives outside the generated `apis/`/`models/` trees,
 * which are kept untouched as a faithful snapshot of the OpenAPI spec. It imports
 * the generated models for TYPES ONLY
 * (erased at build time), so it pulls in no runtime/heavy dependencies and is
 * safe to use from the REST-only entrypoint.
 *
 * @example
 * ```ts
 * import { Alpaca, marketDataShapes, TimeFrame } from "@alpacahq/alpaca-trade-api";
 *
 * const alpaca = new Alpaca({ keyId, secret });
 *
 * // REST history and the live stream now share one `Bar` shape.
 * const bars = await alpaca.marketData.getStockBars({
 *   symbols: ["AAPL"], timeframe: TimeFrame.Day, start: new Date("2024-01-01"),
 * });
 * const candles = marketDataShapes.toCandles(bars.AAPL); // { time[], open[], ... }
 * ```
 */
import type {
    StockBar,
    CryptoBar,
    OptionBar,
    StockTrade,
    CryptoTrade,
    OptionTrade,
    StockQuote,
    CryptoQuote,
    OptionQuote,
    IndexValue as RestIndexValue,
    StockAuction,
    StockDailyAuctions,
} from "./market-data";

// --- Canonical types -------------------------------------------------------

/**
 * An OHLCV aggregate. `symbol` is optional because REST responses carry it on
 * the enclosing map key rather than the bar; the symbol-map helpers and the
 * stream both set it. Identical in shape to the streamed `StreamBar`.
 */
export interface Bar {
    /** Symbol the bar belongs to (set by the SDK from the response key). */
    symbol?: string;
    /** Start of the bar interval (millisecond precision). */
    timestamp: Date;
    /**
     * The original RFC-3339 timestamp string with full nanosecond precision,
     * when the source preserved it (symbol-keyed map responses and the live
     * stream do). `timestamp` truncates to milliseconds; use this when you need
     * the exact instant Alpaca reported.
     */
    timestampRaw?: string;
    /** Opening price. */
    open: number;
    /** High price. */
    high: number;
    /** Low price. */
    low: number;
    /** Closing price. */
    close: number;
    /** Bar volume. */
    volume: number;
    /** Volume-weighted average price, when provided. */
    vwap?: number;
    /** Number of trades in the bar, when provided. */
    tradeCount?: number;
}

/**
 * A single trade print. A superset across stock/crypto/option: fields not
 * applicable to a given asset class are simply absent.
 */
export interface Trade {
    /** Symbol the trade belongs to (set by the SDK from the response key). */
    symbol?: string;
    /** Time of the trade (millisecond precision). */
    timestamp: Date;
    /**
     * The original RFC-3339 timestamp string with full nanosecond precision,
     * when the source preserved it (symbol-keyed map responses and the live
     * stream do). `timestamp` truncates to milliseconds.
     */
    timestampRaw?: string;
    /** Trade price. */
    price: number;
    /** Trade size. */
    size: number;
    /**
     * Exchange-assigned trade id, when provided. A `number` for convenience;
     * crypto trade ids run past `Number.MAX_SAFE_INTEGER` (`2^53`), where a
     * `number` loses precision — use {@link idRaw} to compare, store, or key
     * on an id.
     */
    id?: number;
    /**
     * The exact trade id as a decimal `string`, preserving full precision for
     * 64-bit ids that overflow `2^53`. The REST transport parses market-data
     * JSON losslessly, so this matches the value the live stream reports.
     */
    idRaw?: string;
    /** Exchange code, when provided. */
    exchange?: string;
    /** Condition flags, normalized to an array (a single flag becomes `[flag]`). */
    conditions?: string[];
    /** Tape (A/B/C/...), when provided. */
    tape?: string;
    /** Taker side (`"B"`/`"S"`), crypto only. */
    takerSide?: string;
    /** Trade correction/cancel marker (`canceled`/`corrected`/...), stocks only. */
    update?: string;
}

/**
 * A best bid/ask quote. A superset across stock/crypto/option: fields not
 * applicable to a given asset class are simply absent.
 */
export interface Quote {
    /** Symbol the quote belongs to (set by the SDK from the response key). */
    symbol?: string;
    /** Time of the quote (millisecond precision). */
    timestamp: Date;
    /**
     * The original RFC-3339 timestamp string with full nanosecond precision,
     * when the source preserved it (symbol-keyed map responses and the live
     * stream do). `timestamp` truncates to milliseconds.
     */
    timestampRaw?: string;
    /** Bid price (0 means no active bid). */
    bidPrice: number;
    /** Bid size. */
    bidSize: number;
    /** Bid exchange, when provided. */
    bidExchange?: string;
    /** Ask price (0 means no active ask). */
    askPrice: number;
    /** Ask size. */
    askSize: number;
    /** Ask exchange, when provided. */
    askExchange?: string;
    /** Condition flags, normalized to an array (a single flag becomes `[flag]`). */
    conditions?: string[];
    /** Tape (A/B/C/...), when provided. */
    tape?: string;
}

/**
 * The value of an index at a point in time. The generated REST model types the
 * timestamp as `Date`, but index-value responses deserialize verbatim, so the
 * full-precision RFC-3339 string survives at runtime and is surfaced here as
 * {@link timestampRaw} (identical treatment to {@link Bar}/{@link Trade}).
 */
export interface IndexValue {
    /** Symbol the value belongs to (set by the SDK from the response key). */
    symbol?: string;
    /** Time of the value (millisecond precision). */
    timestamp: Date;
    /**
     * The original RFC-3339 timestamp string with full nanosecond precision,
     * when the source preserved it. `timestamp` truncates to milliseconds.
     */
    timestampRaw?: string;
    /** Index value. */
    value: number;
}

/** A single opening or closing auction print. */
export interface Auction {
    /** Time of the auction print (millisecond precision). */
    timestamp: Date;
    /**
     * The original RFC-3339 timestamp string with full nanosecond precision,
     * when the source preserved it. `timestamp` truncates to milliseconds.
     */
    timestampRaw?: string;
    /** Auction price. */
    price: number;
    /** Auction size, when provided. */
    size?: number;
    /** Exchange code. */
    exchange: string;
    /** Condition flag. */
    condition: string;
}

/**
 * A day's opening and closing auctions for one symbol. The generated model
 * types the auction timestamps as `Date`, but auction responses deserialize
 * verbatim, so the full-precision strings survive and are surfaced via each
 * {@link Auction.timestampRaw}.
 */
export interface DailyAuctions {
    /** Symbol the auctions belong to (set by the SDK from the response key). */
    symbol?: string;
    /** Trading session date (midnight UTC). */
    date: Date;
    /** The original date string (`YYYY-MM-DD`) as reported. */
    dateRaw?: string;
    /** Opening auctions. */
    opening: Auction[];
    /** Closing auctions. */
    closing: Auction[];
}

// --- Helpers ---------------------------------------------------------------

/**
 * Coerce a timestamp to a `Date`. The generated models type bar/trade/quote
 * timestamps as `Date`, but the symbol-keyed map responses are deserialized
 * verbatim, so nested records can still carry the raw RFC-3339 `string` at
 * runtime (the generated types stay faithful to the spec, so this gap is fixed
 * here rather than by re-typing them). Normalizing here keeps the canonical
 * `timestamp` a real `Date` regardless of source (REST map, REST array, or
 * stream) — which is why the normalized accessors are the honest-`Date` path.
 */
function asDate(value: Date | string | number): Date {
    return value instanceof Date ? value : new Date(value);
}

/**
 * The original RFC-3339 timestamp string when the source preserved it. The
 * symbol-keyed map responses deserialize verbatim, so `t` is often still a
 * full-precision `string` at runtime (this keeps every nanosecond digit).
 * Otherwise it falls back to a best-effort ISO string from a `Date`/epoch
 * number (millisecond precision — no digits are fabricated). Returns
 * `undefined` for absent/invalid input.
 */
function rawTimestamp(value: Date | string | number): string | undefined {
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    return undefined;
}

/** Epoch ms for a `Date` (or a still-raw string/number timestamp). */
function timeMs(t: Date | string | number): number {
    return asDate(t).getTime();
}

/** Normalize a condition field (string, array, or absent) into `string[] | undefined`. */
function conditions(value: string | string[] | null | undefined): string[] | undefined {
    if (value == null) {
        return undefined;
    }
    return Array.isArray(value) ? value : [value];
}

/**
 * Canonical numeric id (lossy past `2^53`). The lossless market-data transport
 * keeps 64-bit ids that overflow `2^53` as `string`s, so `id` typed `number`
 * can carry a string at runtime; this coerces it back to a `number` for the
 * convenient field, with the exact value preserved separately via {@link idRaw}.
 */
function idNumber(value: number | string | undefined): number | undefined {
    return value == null ? undefined : Number(value);
}

/** The exact id as a decimal `string`, preserving full 64-bit precision. */
function idRaw(value: number | string | undefined): string | undefined {
    return value == null ? undefined : String(value);
}

// --- Per-record mappers ----------------------------------------------------

/**
 * Map a stock/crypto/option REST bar onto a canonical {@link Bar}. The three
 * generated bar models share an identical shape, so one mapper covers them all.
 */
export function toBar(bar: StockBar | CryptoBar | OptionBar, symbol?: string): Bar {
    return {
        symbol,
        timestamp: asDate(bar.t),
        timestampRaw: rawTimestamp(bar.t),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw,
        tradeCount: bar.n,
    };
}

/** Map a REST {@link StockTrade} onto a canonical {@link Trade}. */
export function toStockTrade(trade: StockTrade, symbol?: string): Trade {
    return {
        symbol,
        timestamp: asDate(trade.t),
        timestampRaw: rawTimestamp(trade.t),
        price: trade.p,
        size: trade.s,
        id: idNumber(trade.i),
        idRaw: idRaw(trade.i),
        exchange: trade.x,
        conditions: conditions(trade.c),
        tape: trade.z,
        update: trade.u,
    };
}

/** Map a REST {@link CryptoTrade} onto a canonical {@link Trade}. */
export function toCryptoTrade(trade: CryptoTrade, symbol?: string): Trade {
    return {
        symbol,
        timestamp: asDate(trade.t),
        timestampRaw: rawTimestamp(trade.t),
        price: trade.p,
        size: trade.s,
        id: idNumber(trade.i),
        idRaw: idRaw(trade.i),
        takerSide: trade.tks,
    };
}

/** Map a REST {@link OptionTrade} onto a canonical {@link Trade}. */
export function toOptionTrade(trade: OptionTrade, symbol?: string): Trade {
    return {
        symbol,
        timestamp: asDate(trade.t),
        timestampRaw: rawTimestamp(trade.t),
        price: trade.p,
        size: trade.s,
        exchange: trade.x,
        conditions: conditions(trade.c),
    };
}

/** Map a REST {@link StockQuote} onto a canonical {@link Quote}. */
export function toStockQuote(quote: StockQuote, symbol?: string): Quote {
    return {
        symbol,
        timestamp: asDate(quote.t),
        timestampRaw: rawTimestamp(quote.t),
        bidPrice: quote.bp,
        bidSize: quote.bs,
        bidExchange: quote.bx,
        askPrice: quote.ap,
        askSize: quote.as,
        askExchange: quote.ax,
        conditions: conditions(quote.c),
        tape: quote.z,
    };
}

/** Map a REST {@link CryptoQuote} onto a canonical {@link Quote}. */
export function toCryptoQuote(quote: CryptoQuote, symbol?: string): Quote {
    return {
        symbol,
        timestamp: asDate(quote.t),
        timestampRaw: rawTimestamp(quote.t),
        bidPrice: quote.bp,
        bidSize: quote.bs,
        askPrice: quote.ap,
        askSize: quote.as,
    };
}

/** Map a REST {@link OptionQuote} onto a canonical {@link Quote}. */
export function toOptionQuote(quote: OptionQuote, symbol?: string): Quote {
    return {
        symbol,
        timestamp: asDate(quote.t),
        timestampRaw: rawTimestamp(quote.t),
        bidPrice: quote.bp,
        bidSize: quote.bs,
        bidExchange: quote.bx,
        askPrice: quote.ap,
        askSize: quote.as,
        askExchange: quote.ax,
        conditions: conditions(quote.c),
    };
}

/** Map a REST index value onto a canonical {@link IndexValue}. */
export function toIndexValue(value: RestIndexValue, symbol?: string): IndexValue {
    return {
        symbol,
        timestamp: asDate(value.t),
        timestampRaw: rawTimestamp(value.t),
        value: value.v,
    };
}

/** Map a single REST {@link StockAuction} onto a canonical {@link Auction}. */
export function toAuction(auction: StockAuction): Auction {
    return {
        timestamp: asDate(auction.t),
        timestampRaw: rawTimestamp(auction.t),
        price: auction.p,
        size: auction.s,
        exchange: auction.x,
        condition: auction.c,
    };
}

/** Map a REST {@link StockDailyAuctions} record onto canonical {@link DailyAuctions}. */
export function toDailyAuctions(daily: StockDailyAuctions, symbol?: string): DailyAuctions {
    return {
        symbol,
        date: asDate(daily.d),
        dateRaw: rawTimestamp(daily.d),
        opening: (daily.o ?? []).map(toAuction),
        closing: (daily.c ?? []).map(toAuction),
    };
}

// --- Symbol-map helpers ----------------------------------------------------
//
// The `collect*BySymbol` client methods return `{ [symbol]: T[] }`. These map
// each record onto its canonical form while stamping the symbol from the key.

/** Map a `{ [symbol]: TIn[] }` response through `mapper`, setting `symbol` per record. */
function mapBySymbol<TIn, TOut>(
    map: { [symbol: string]: TIn[] },
    mapper: (record: TIn, symbol: string) => TOut,
): { [symbol: string]: TOut[] } {
    const out: { [symbol: string]: TOut[] } = {};
    for (const symbol of Object.keys(map)) {
        out[symbol] = (map[symbol] ?? []).map((record) => mapper(record, symbol));
    }
    return out;
}

/** Normalize a `{ [symbol]: (Stock|Crypto|Option)Bar[] }` map into `{ [symbol]: Bar[] }`. */
export function toBarsBySymbol(
    map: { [symbol: string]: (StockBar | CryptoBar | OptionBar)[] },
): { [symbol: string]: Bar[] } {
    return mapBySymbol(map, toBar);
}

/** Normalize a `{ [symbol]: T[] }` trade map into `{ [symbol]: Trade[] }` using `mapper`. */
export function toTradesBySymbol<T>(
    map: { [symbol: string]: T[] },
    mapper: (trade: T, symbol?: string) => Trade,
): { [symbol: string]: Trade[] } {
    return mapBySymbol(map, mapper);
}

/** Normalize a `{ [symbol]: T[] }` quote map into `{ [symbol]: Quote[] }` using `mapper`. */
export function toQuotesBySymbol<T>(
    map: { [symbol: string]: T[] },
    mapper: (quote: T, symbol?: string) => Quote,
): { [symbol: string]: Quote[] } {
    return mapBySymbol(map, mapper);
}

/** Normalize a `{ [symbol]: IndexValue[] }` map into canonical `{ [symbol]: IndexValue[] }`. */
export function toIndexValuesBySymbol(
    map: { [symbol: string]: RestIndexValue[] },
): { [symbol: string]: IndexValue[] } {
    return mapBySymbol(map, toIndexValue);
}

/** Normalize a `{ [symbol]: StockDailyAuctions[] }` map into `{ [symbol]: DailyAuctions[] }`. */
export function toAuctionsBySymbol(
    map: { [symbol: string]: StockDailyAuctions[] },
): { [symbol: string]: DailyAuctions[] } {
    return mapBySymbol(map, toDailyAuctions);
}

// --- Chart-ready helpers ---------------------------------------------------

/** Unit for the `time` axis emitted by the chart helpers. */
export type TimeUnit = "ms" | "seconds";

/** Options shared by the chart helpers. */
export interface ChartOptions {
    /** Time representation: epoch `"ms"` (default) or unix `"seconds"`. */
    time?: TimeUnit;
}

/**
 * Columnar OHLCV, the shape plotting libraries (ECharts, Highcharts, Plotly,
 * ...) consume most directly. Each array is parallel and ordered as the input
 * bars were.
 */
export interface Candles {
    /** Symbol the candles belong to, if the source bars carried one. */
    symbol?: string;
    /** Bar start times (epoch ms by default; see {@link ChartOptions.time}). */
    time: number[];
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
}

/** A single OHLC point (e.g. for lightweight-charts candlestick series). */
export interface CandlestickPoint {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** A single `{ time, value }` point (e.g. for a line/area series). */
export interface LinePoint {
    time: number;
    value: number;
}

function barTime(bar: Bar, unit: TimeUnit): number {
    const ms = timeMs(bar.timestamp);
    return unit === "seconds" ? Math.floor(ms / 1000) : ms;
}

/** Reshape a `Bar[]` into parallel columnar {@link Candles}. */
export function toCandles(bars: Bar[], opts: ChartOptions = {}): Candles {
    const unit = opts.time ?? "ms";
    const candles: Candles = {
        symbol: bars[0]?.symbol,
        time: [],
        open: [],
        high: [],
        low: [],
        close: [],
        volume: [],
    };
    for (const bar of bars) {
        candles.time.push(barTime(bar, unit));
        candles.open.push(bar.open);
        candles.high.push(bar.high);
        candles.low.push(bar.low);
        candles.close.push(bar.close);
        candles.volume.push(bar.volume);
    }
    return candles;
}

/** Reshape a `Bar[]` into an array of `{ time, open, high, low, close }` points. */
export function toCandlestickSeries(bars: Bar[], opts: ChartOptions = {}): CandlestickPoint[] {
    const unit = opts.time ?? "ms";
    return bars.map((bar) => ({
        time: barTime(bar, unit),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    }));
}

/** Reshape a `Bar[]` into an array of `{ time, value }` points for one field. */
export function toLineSeries(
    bars: Bar[],
    field: "open" | "high" | "low" | "close" | "vwap" = "close",
    opts: ChartOptions = {},
): LinePoint[] {
    const unit = opts.time ?? "ms";
    const out: LinePoint[] = [];
    for (const bar of bars) {
        const value = bar[field];
        if (value === undefined) {
            continue;
        }
        out.push({ time: barTime(bar, unit), value });
    }
    return out;
}
