/**
 * Typed payloads for the real-time streams plus mappers from Alpaca's compact
 * wire keys (e.g. `p`, `s`, `bp`) to readable camelCase fields consistent with
 * the REST models.
 *
 * Market-data frames are msgpack; `@msgpack/msgpack` decodes the msgpack
 * timestamp extension into a JS `Date`, so timestamp fields are surfaced as
 * `Date`. News timestamps arrive as RFC-3339 strings.
 */
import { OrderFromJSON, type Order } from "../trading";
import type { Bar, Trade, Quote } from "../marketDataShapes";
import { StreamTimestamp } from "./timestamp";

function toDate(value: unknown): Date {
    if (value instanceof StreamTimestamp) {
        return value.toDate();
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
    }
    return new Date(NaN);
}

/**
 * The lossless RFC-3339 timestamp string for a stream value: full nanosecond
 * precision from a {@link StreamTimestamp}, a preserved raw `string`, or a
 * best-effort millisecond ISO fallback from a `Date`. Returns `undefined` when
 * no timestamp is available.
 */
function toRawTs(value: unknown): string | undefined {
    if (value instanceof StreamTimestamp) {
        return value.toRFC3339();
    }
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return undefined;
}

/**
 * Coerce a numeric field to `number`. The market-data socket decodes with
 * `useBigInt64`, so 64-bit-encoded values (sizes, volumes, counts, ids) arrive
 * as `bigint`; this keeps the canonical numeric fields a plain `number`
 * (precision-lossy above 2^53, matching the field's type — the exact value is
 * preserved separately via {@link idString} where it matters).
 */
function num(value: number | bigint): number {
    return typeof value === "bigint" ? Number(value) : value;
}

/** Optional variant of {@link num}: passes through `undefined`. */
function optNum(value: number | bigint | undefined): number | undefined {
    return value == null ? undefined : num(value);
}

/**
 * The exact decimal string for an integer id, preserving full precision for
 * 64-bit ids that exceed `Number.MAX_SAFE_INTEGER` (decoded as `bigint`).
 * Returns `undefined` when the id is absent.
 */
function idString(value: number | bigint | undefined): string | undefined {
    return value == null ? undefined : String(value);
}

// --- Trades ----------------------------------------------------------------

export interface RawTrade {
    T: "t";
    S: string;
    i: number;
    x: string;
    p: number;
    s: number;
    t: unknown;
    c?: string[];
    z?: string;
    /** Taker side ("B" buyer / "S" seller). Crypto trades only. */
    tks?: string;
}

/**
 * A streamed trade. The canonical {@link Trade} with the fields the live feed
 * always provides promoted to required, so REST and stream trades share one type.
 */
export type StreamTrade = Trade & {
    symbol: string;
    id: number;
    /** Exact trade id as a string, preserving 64-bit ids beyond `2^53`. */
    idRaw?: string;
    exchange: string;
    conditions: string[];
};

export function mapTrade(raw: RawTrade): StreamTrade {
    return {
        symbol: raw.S,
        id: num(raw.i),
        idRaw: idString(raw.i),
        exchange: raw.x,
        price: num(raw.p),
        size: num(raw.s),
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        conditions: raw.c ?? [],
        tape: raw.z,
        takerSide: raw.tks,
    };
}

// --- Quotes ----------------------------------------------------------------

export interface RawQuote {
    T: "q";
    S: string;
    bx?: string;
    bp: number;
    bs: number;
    ax?: string;
    ap: number;
    as: number;
    t: unknown;
    c?: string[];
    z?: string;
}

/**
 * A streamed quote. The canonical {@link Quote} with the fields the live feed
 * always provides promoted to required, so REST and stream quotes share one type.
 */
export type StreamQuote = Quote & {
    symbol: string;
    conditions: string[];
};

export function mapQuote(raw: RawQuote): StreamQuote {
    return {
        symbol: raw.S,
        bidExchange: raw.bx,
        bidPrice: num(raw.bp),
        bidSize: num(raw.bs),
        askExchange: raw.ax,
        askPrice: num(raw.ap),
        askSize: num(raw.as),
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        conditions: raw.c ?? [],
        tape: raw.z,
    };
}

// --- Bars ------------------------------------------------------------------

export interface RawBar {
    T: "b" | "u" | "d";
    S: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    t: unknown;
    vw?: number;
    n?: number;
}

/**
 * A streamed bar. The canonical {@link Bar} with `symbol` promoted to required,
 * so REST and stream bars share one type.
 */
export type StreamBar = Bar & { symbol: string };

export function mapBar(raw: RawBar): StreamBar {
    return {
        symbol: raw.S,
        open: num(raw.o),
        high: num(raw.h),
        low: num(raw.l),
        close: num(raw.c),
        volume: num(raw.v),
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        vwap: optNum(raw.vw),
        tradeCount: optNum(raw.n),
    };
}

// --- Trading status --------------------------------------------------------

export interface RawStatus {
    T: "s";
    S: string;
    sc?: string;
    sm?: string;
    rc?: string;
    rm?: string;
    t: unknown;
    z?: string;
}

export interface StreamStatus {
    symbol: string;
    statusCode?: string;
    statusMessage?: string;
    reasonCode?: string;
    reasonMessage?: string;
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
    tape?: string;
}

export function mapStatus(raw: RawStatus): StreamStatus {
    return {
        symbol: raw.S,
        statusCode: raw.sc,
        statusMessage: raw.sm,
        reasonCode: raw.rc,
        reasonMessage: raw.rm,
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        tape: raw.z,
    };
}

// --- LULD ------------------------------------------------------------------

export interface RawLuld {
    T: "l";
    S: string;
    u: number;
    d: number;
    i?: string;
    t: unknown;
    z?: string;
}

export interface StreamLuld {
    symbol: string;
    limitUpPrice: number;
    limitDownPrice: number;
    indicator?: string;
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
    tape?: string;
}

export function mapLuld(raw: RawLuld): StreamLuld {
    return {
        symbol: raw.S,
        limitUpPrice: num(raw.u),
        limitDownPrice: num(raw.d),
        indicator: raw.i,
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        tape: raw.z,
    };
}

// --- Order imbalances (equities) -------------------------------------------

export interface RawImbalance {
    T: "i";
    S: string;
    p: number;
    z?: string;
    t: unknown;
}

/**
 * A streamed order-imbalance message. Equities-only; per Alpaca's docs these are
 * typically emitted during limit-up/limit-down trading halts, so this channel is
 * sparse and legitimately quiet most of the time.
 */
export interface StreamImbalance {
    symbol: string;
    price: number;
    tape?: string;
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
}

export function mapImbalance(raw: RawImbalance): StreamImbalance {
    return {
        symbol: raw.S,
        price: num(raw.p),
        tape: raw.z,
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
    };
}

// --- Corrections -----------------------------------------------------------

export interface RawCorrection {
    T: "c";
    S: string;
    x?: string;
    oi: number;
    op: number;
    os: number;
    oc?: string[];
    ci: number;
    cp: number;
    cs: number;
    cc?: string[];
    t: unknown;
    z?: string;
}

export interface StreamCorrection {
    symbol: string;
    exchange?: string;
    originalId: number;
    /** Exact original trade id as a string, preserving 64-bit ids beyond `2^53`. */
    originalIdRaw?: string;
    originalPrice: number;
    originalSize: number;
    originalConditions: string[];
    correctedId: number;
    /** Exact corrected trade id as a string, preserving 64-bit ids beyond `2^53`. */
    correctedIdRaw?: string;
    correctedPrice: number;
    correctedSize: number;
    correctedConditions: string[];
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
    tape?: string;
}

export function mapCorrection(raw: RawCorrection): StreamCorrection {
    return {
        symbol: raw.S,
        exchange: raw.x,
        originalId: num(raw.oi),
        originalIdRaw: idString(raw.oi),
        originalPrice: num(raw.op),
        originalSize: num(raw.os),
        originalConditions: raw.oc ?? [],
        correctedId: num(raw.ci),
        correctedIdRaw: idString(raw.ci),
        correctedPrice: num(raw.cp),
        correctedSize: num(raw.cs),
        correctedConditions: raw.cc ?? [],
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        tape: raw.z,
    };
}

// --- Cancel errors ---------------------------------------------------------

export interface RawCancelError {
    T: "x";
    S: string;
    i: number;
    x: string;
    p: number;
    s: number;
    a?: string;
    z?: string;
    t: unknown;
}

export interface StreamCancelError {
    symbol: string;
    id: number;
    /** Exact trade id as a string, preserving 64-bit ids beyond `2^53`. */
    idRaw?: string;
    exchange: string;
    price: number;
    size: number;
    action?: string;
    tape?: string;
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
}

export function mapCancelError(raw: RawCancelError): StreamCancelError {
    return {
        symbol: raw.S,
        id: num(raw.i),
        idRaw: idString(raw.i),
        exchange: raw.x,
        price: num(raw.p),
        size: num(raw.s),
        action: raw.a,
        tape: raw.z,
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
    };
}

// --- Orderbooks (crypto) ---------------------------------------------------

export interface RawOrderbookEntry {
    p: number;
    s: number;
}

export interface RawOrderbook {
    T: "o";
    S: string;
    t: unknown;
    b: RawOrderbookEntry[];
    a: RawOrderbookEntry[];
    r?: boolean;
}

export interface OrderbookLevel {
    price: number;
    size: number;
}

export interface StreamOrderbook {
    symbol: string;
    timestamp: Date;
    /** Lossless RFC-3339 nanosecond timestamp. */
    timestampRaw?: string;
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    reset: boolean;
}

export function mapOrderbook(raw: RawOrderbook): StreamOrderbook {
    const level = (e: RawOrderbookEntry): OrderbookLevel => ({ price: num(e.p), size: num(e.s) });
    return {
        symbol: raw.S,
        timestamp: toDate(raw.t),
        timestampRaw: toRawTs(raw.t),
        bids: (raw.b ?? []).map(level),
        asks: (raw.a ?? []).map(level),
        reset: raw.r ?? false,
    };
}

// --- News ------------------------------------------------------------------

export interface RawNews {
    T: "n";
    id: number;
    headline: string;
    summary?: string;
    author?: string;
    created_at?: string;
    updated_at?: string;
    url?: string;
    content?: string;
    symbols?: string[];
    source?: string;
}

export interface StreamNews {
    id: number;
    /** Exact article id as a string, preserving 64-bit ids beyond `2^53`. */
    idRaw?: string;
    headline: string;
    summary?: string;
    author?: string;
    createdAt?: Date;
    updatedAt?: Date;
    url?: string;
    content?: string;
    symbols: string[];
    source?: string;
}

export function mapNews(raw: RawNews): StreamNews {
    return {
        id: num(raw.id),
        idRaw: idString(raw.id),
        headline: raw.headline,
        summary: raw.summary,
        author: raw.author,
        createdAt: raw.created_at ? toDate(raw.created_at) : undefined,
        updatedAt: raw.updated_at ? toDate(raw.updated_at) : undefined,
        url: raw.url,
        content: raw.content,
        symbols: raw.symbols ?? [],
        source: raw.source,
    };
}

// --- Trade updates (trading stream) ---------------------------------------

/**
 * The `event` of a trade update. Lists the documented Alpaca order events but
 * stays open (`string & {}`) so unknown/new events still type-check while the
 * known ones keep autocomplete.
 */
export type TradeUpdateEvent =
    | "new"
    | "fill"
    | "partial_fill"
    | "canceled"
    | "expired"
    | "done_for_day"
    | "replaced"
    | "rejected"
    | "pending_new"
    | "stopped"
    | "pending_cancel"
    | "pending_replace"
    | "calculated"
    | "suspended"
    | "order_replace_rejected"
    | "order_cancel_rejected"
    // eslint-disable-next-line @typescript-eslint/ban-types
    | (string & {});

/**
 * A trade/order update from the trading stream. `order` is the full,
 * deserialized {@link Order} (typed camelCase fields, with the raw snake_case
 * wire keys also preserved via passthrough, e.g. both `order.clientOrderId` and
 * `order["client_order_id"]` work). Commonly-used fields are surfaced alongside
 * it; unknown top-level fields are preserved.
 */
export interface TradeUpdate {
    event: TradeUpdateEvent;
    timestamp?: Date;
    order: Order;
    executionId?: string;
    price?: string;
    qty?: string;
    positionQty?: string;
    [key: string]: unknown;
}

export function mapTradeUpdate(data: Record<string, unknown>): TradeUpdate {
    const ts = data.timestamp;
    return {
        ...data,
        event: String(data.event ?? "") as TradeUpdateEvent,
        timestamp: typeof ts === "string" ? toDate(ts) : undefined,
        order: OrderFromJSON((data.order as Record<string, unknown>) ?? {}),
        executionId: data.execution_id as string | undefined,
        price: data.price as string | undefined,
        qty: data.qty as string | undefined,
        positionQty: data.position_qty as string | undefined,
    };
}
