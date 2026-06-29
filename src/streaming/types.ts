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

function toDate(value: unknown): Date {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
    }
    return new Date(NaN);
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
}

/**
 * A streamed trade. The canonical {@link Trade} with the fields the live feed
 * always provides promoted to required, so REST and stream trades share one type.
 */
export type StreamTrade = Trade & {
    symbol: string;
    id: number;
    exchange: string;
    conditions: string[];
};

export function mapTrade(raw: RawTrade): StreamTrade {
    return {
        symbol: raw.S,
        id: raw.i,
        exchange: raw.x,
        price: raw.p,
        size: raw.s,
        timestamp: toDate(raw.t),
        conditions: raw.c ?? [],
        tape: raw.z,
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
        bidPrice: raw.bp,
        bidSize: raw.bs,
        askExchange: raw.ax,
        askPrice: raw.ap,
        askSize: raw.as,
        timestamp: toDate(raw.t),
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
        open: raw.o,
        high: raw.h,
        low: raw.l,
        close: raw.c,
        volume: raw.v,
        timestamp: toDate(raw.t),
        vwap: raw.vw,
        tradeCount: raw.n,
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
    tape?: string;
}

export function mapLuld(raw: RawLuld): StreamLuld {
    return {
        symbol: raw.S,
        limitUpPrice: raw.u,
        limitDownPrice: raw.d,
        indicator: raw.i,
        timestamp: toDate(raw.t),
        tape: raw.z,
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
    originalPrice: number;
    originalSize: number;
    originalConditions: string[];
    correctedId: number;
    correctedPrice: number;
    correctedSize: number;
    correctedConditions: string[];
    timestamp: Date;
    tape?: string;
}

export function mapCorrection(raw: RawCorrection): StreamCorrection {
    return {
        symbol: raw.S,
        exchange: raw.x,
        originalId: raw.oi,
        originalPrice: raw.op,
        originalSize: raw.os,
        originalConditions: raw.oc ?? [],
        correctedId: raw.ci,
        correctedPrice: raw.cp,
        correctedSize: raw.cs,
        correctedConditions: raw.cc ?? [],
        timestamp: toDate(raw.t),
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
    exchange: string;
    price: number;
    size: number;
    action?: string;
    tape?: string;
    timestamp: Date;
}

export function mapCancelError(raw: RawCancelError): StreamCancelError {
    return {
        symbol: raw.S,
        id: raw.i,
        exchange: raw.x,
        price: raw.p,
        size: raw.s,
        action: raw.a,
        tape: raw.z,
        timestamp: toDate(raw.t),
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
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    reset: boolean;
}

export function mapOrderbook(raw: RawOrderbook): StreamOrderbook {
    const level = (e: RawOrderbookEntry): OrderbookLevel => ({ price: e.p, size: e.s });
    return {
        symbol: raw.S,
        timestamp: toDate(raw.t),
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
        id: raw.id,
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
