/**
 * Real-time market-data streaming over Alpaca's msgpack WebSocket protocol.
 *
 * `MarketDataStream` implements the shared subscribe/dispatch logic; the thin
 * subclasses (`StockDataStream`, `CryptoDataStream`, `OptionDataStream`,
 * `NewsStream`) only pick the endpoint path.
 */
import {
    AlpacaWebSocket,
    type AlpacaWebSocketOptions,
    EVENT,
    CONN_ERROR,
} from "./websocket";
import {
    mapBar,
    mapCancelError,
    mapCorrection,
    mapImbalance,
    mapLuld,
    mapNews,
    mapOrderbook,
    mapQuote,
    mapStatus,
    mapTrade,
    type StreamBar,
    type StreamCancelError,
    type StreamCorrection,
    type StreamImbalance,
    type StreamLuld,
    type StreamNews,
    type StreamOrderbook,
    type StreamQuote,
    type StreamStatus,
    type StreamTrade,
} from "./types";
import { createMarketDataExtensionCodec } from "./timestamp";

export const MARKET_DATA_STREAM_HOST = "wss://stream.data.alpaca.markets";
export const MARKET_DATA_STREAM_SANDBOX_HOST = "wss://stream.data.sandbox.alpaca.markets";

/** Numeric codes Alpaca returns for terminal authentication failures. */
const AUTH_FAILURE_CODES = new Set<number>([401, 402, 404]);

/** Pick the market-data stream host for the selected environment. */
function streamHost(sandbox?: boolean): string {
    return sandbox ? MARKET_DATA_STREAM_SANDBOX_HOST : MARKET_DATA_STREAM_HOST;
}

/**
 * Guards production-only streams. The sandbox market-data host serves stock
 * data only; crypto and news have no sandbox endpoint, so requesting one is a
 * configuration error (matching the Java client's production-only enforcement).
 * Pass an explicit `url` to bypass this guard.
 */
function requireProduction(streamName: string, sandbox?: boolean): void {
    if (sandbox) {
        throw new Error(
            `The ${streamName} stream has no sandbox endpoint; it is only available on the ` +
                "production market-data host. Use a non-sandbox client, or pass an explicit `url`.",
        );
    }
}

/** Subscribable market-data channels. */
export type MarketDataChannel =
    | "trades"
    | "quotes"
    | "bars"
    | "updatedBars"
    | "dailyBars"
    | "statuses"
    | "lulds"
    | "imbalances"
    | "orderbooks"
    | "news";

const CHANNELS: MarketDataChannel[] = [
    "trades",
    "quotes",
    "bars",
    "updatedBars",
    "dailyBars",
    "statuses",
    "lulds",
    "imbalances",
    "orderbooks",
    "news",
];

/** Options for a market-data subclass (endpoint URL is derived). */
export type MarketDataStreamOptions = Omit<AlpacaWebSocketOptions, "url" | "codec"> & {
    /** Use the market-data sandbox host instead of production. Default false. */
    sandbox?: boolean;
    /**
     * Override the derived endpoint entirely (e.g. to route through a proxy).
     * Takes precedence over `sandbox` and the feed-derived path. When set, the
     * production-only guard on crypto/news streams is bypassed.
     */
    url?: string;
};

/**
 * Rejects null/blank subscription symbols before they reach the wire, matching
 * the Java client's subscription validation. Returns the symbols unchanged.
 */
function validateSymbols(symbols: string[]): string[] {
    if (!Array.isArray(symbols)) {
        throw new TypeError("symbols must be an array of non-empty strings");
    }
    for (const symbol of symbols) {
        if (typeof symbol !== "string" || symbol.trim() === "") {
            throw new Error("subscription symbols must be non-empty, non-blank strings");
        }
    }
    return symbols;
}

interface ControlOrDataFrame {
    T?: string;
    msg?: string;
    code?: number;
    [key: string]: unknown;
}

function isFrame(value: unknown): value is ControlOrDataFrame {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class MarketDataStream extends AlpacaWebSocket {
    private readonly subscriptions: Record<MarketDataChannel, string[]> = {
        trades: [],
        quotes: [],
        bars: [],
        updatedBars: [],
        dailyBars: [],
        statuses: [],
        lulds: [],
        imbalances: [],
        orderbooks: [],
        news: [],
    };

    constructor(options: Omit<AlpacaWebSocketOptions, "codec">) {
        super({ ...options, codec: "msgpack" });
        // Preserve nanosecond timestamps: decode the msgpack timestamp
        // extension (ext -1) into a StreamTimestamp instead of a lossy Date.
        this.extensionCodec = createMarketDataExtensionCodec();
    }

    // --- Subscribe / unsubscribe -------------------------------------------

    subscribeForTrades(symbols: string[]): void {
        this.addSubscription("trades", symbols);
    }
    subscribeForQuotes(symbols: string[]): void {
        this.addSubscription("quotes", symbols);
    }
    subscribeForBars(symbols: string[]): void {
        this.addSubscription("bars", symbols);
    }
    subscribeForUpdatedBars(symbols: string[]): void {
        this.addSubscription("updatedBars", symbols);
    }
    subscribeForDailyBars(symbols: string[]): void {
        this.addSubscription("dailyBars", symbols);
    }
    subscribeForStatuses(symbols: string[]): void {
        this.addSubscription("statuses", symbols);
    }
    subscribeForLulds(symbols: string[]): void {
        this.addSubscription("lulds", symbols);
    }
    /**
     * Subscribe to order-imbalance messages. Equities-only (stock stream); the
     * feed emits these mainly during limit-up/limit-down halts, so expect long
     * quiet periods even while subscribed.
     */
    subscribeForImbalances(symbols: string[]): void {
        this.addSubscription("imbalances", symbols);
    }
    subscribeForOrderbooks(symbols: string[]): void {
        this.addSubscription("orderbooks", symbols);
    }
    subscribeForNews(symbols: string[]): void {
        this.addSubscription("news", symbols);
    }

    unsubscribeFromTrades(symbols: string[]): void {
        this.removeSubscription("trades", symbols);
    }
    unsubscribeFromQuotes(symbols: string[]): void {
        this.removeSubscription("quotes", symbols);
    }
    unsubscribeFromBars(symbols: string[]): void {
        this.removeSubscription("bars", symbols);
    }
    unsubscribeFromUpdatedBars(symbols: string[]): void {
        this.removeSubscription("updatedBars", symbols);
    }
    unsubscribeFromDailyBars(symbols: string[]): void {
        this.removeSubscription("dailyBars", symbols);
    }
    unsubscribeFromStatuses(symbols: string[]): void {
        this.removeSubscription("statuses", symbols);
    }
    unsubscribeFromLulds(symbols: string[]): void {
        this.removeSubscription("lulds", symbols);
    }
    unsubscribeFromImbalances(symbols: string[]): void {
        this.removeSubscription("imbalances", symbols);
    }
    unsubscribeFromOrderbooks(symbols: string[]): void {
        this.removeSubscription("orderbooks", symbols);
    }
    unsubscribeFromNews(symbols: string[]): void {
        this.removeSubscription("news", symbols);
    }

    /** Snapshot of the symbols currently subscribed per channel. */
    getSubscriptions(): Record<MarketDataChannel, string[]> {
        return JSON.parse(JSON.stringify(this.subscriptions));
    }

    // --- Typed listener sugar ----------------------------------------------

    onTrade(fn: (trade: StreamTrade) => void): this {
        return this.on(EVENT.TRADE, fn);
    }
    onQuote(fn: (quote: StreamQuote) => void): this {
        return this.on(EVENT.QUOTE, fn);
    }
    onBar(fn: (bar: StreamBar) => void): this {
        return this.on(EVENT.BAR, fn);
    }
    onUpdatedBar(fn: (bar: StreamBar) => void): this {
        return this.on(EVENT.UPDATED_BAR, fn);
    }
    onDailyBar(fn: (bar: StreamBar) => void): this {
        return this.on(EVENT.DAILY_BAR, fn);
    }
    onStatus(fn: (status: StreamStatus) => void): this {
        return this.on(EVENT.STATUS, fn);
    }
    onLuld(fn: (luld: StreamLuld) => void): this {
        return this.on(EVENT.LULD, fn);
    }
    onImbalance(fn: (imbalance: StreamImbalance) => void): this {
        return this.on(EVENT.IMBALANCE, fn);
    }
    onCorrection(fn: (correction: StreamCorrection) => void): this {
        return this.on(EVENT.CORRECTION, fn);
    }
    onCancelError(fn: (cancelError: StreamCancelError) => void): this {
        return this.on(EVENT.CANCEL_ERROR, fn);
    }
    onOrderbook(fn: (orderbook: StreamOrderbook) => void): this {
        return this.on(EVENT.ORDERBOOK, fn);
    }
    onNews(fn: (news: StreamNews) => void): this {
        return this.on(EVENT.NEWS, fn);
    }

    // --- Protocol hooks -----------------------------------------------------

    protected sendAuth(): void {
        this.send({ action: "auth", key: this.keyId, secret: this.secret });
    }

    protected resubscribe(): void {
        const message: Record<string, unknown> = {};
        let any = false;
        for (const channel of CHANNELS) {
            if (this.subscriptions[channel].length > 0) {
                message[channel] = this.subscriptions[channel];
                any = true;
            }
        }
        if (any) {
            this.send({ action: "subscribe", ...message });
        }
    }

    protected handleMessage(message: unknown): void {
        if (!Array.isArray(message)) {
            throw new TypeError("market-data message must be an array of frame objects");
        }
        for (const value of message) {
            if (!this.isCallbackCurrent()) return;
            if (!isFrame(value)) {
                throw new TypeError("market-data frame must be a non-null object");
            }
            const frame = value;
            switch (frame.T) {
                case "success":
                    if (frame.msg === "authenticated") {
                        this.onAuthenticated();
                    } else {
                        this.log(`market-data stream: ${frame.msg}`);
                    }
                    break;
                case "subscription":
                    this.updateSubscriptions(frame);
                    this.safeEmit(EVENT.SUBSCRIPTION, this.getSubscriptions());
                    break;
                case "error": {
                    const message =
                        (frame.code != null && CONN_ERROR.get(frame.code)) ||
                        String(frame.msg ?? "stream error");
                    // Auth failures are terminal: don't reconnect with credentials
                    // the server already rejected.
                    if (frame.code != null && AUTH_FAILURE_CODES.has(frame.code)) {
                        this.failAuthentication(message, frame.code);
                    } else {
                        this.safeEmit(EVENT.CLIENT_ERROR, message);
                    }
                    break;
                }
                default:
                    this.dispatchData(frame);
            }
        }
    }

    private dispatchData(frame: ControlOrDataFrame): void {
        switch (frame.T) {
            case "t":
                this.safeEmit(EVENT.TRADE, mapTrade(frame as never));
                break;
            case "q":
                this.safeEmit(EVENT.QUOTE, mapQuote(frame as never));
                break;
            case "b":
                this.safeEmit(EVENT.BAR, mapBar(frame as never));
                break;
            case "u":
                this.safeEmit(EVENT.UPDATED_BAR, mapBar(frame as never));
                break;
            case "d":
                this.safeEmit(EVENT.DAILY_BAR, mapBar(frame as never));
                break;
            case "s":
                this.safeEmit(EVENT.STATUS, mapStatus(frame as never));
                break;
            case "l":
                this.safeEmit(EVENT.LULD, mapLuld(frame as never));
                break;
            case "i":
                this.safeEmit(EVENT.IMBALANCE, mapImbalance(frame as never));
                break;
            case "c":
                this.safeEmit(EVENT.CORRECTION, mapCorrection(frame as never));
                break;
            case "x":
                this.safeEmit(EVENT.CANCEL_ERROR, mapCancelError(frame as never));
                break;
            case "o":
                this.safeEmit(EVENT.ORDERBOOK, mapOrderbook(frame as never));
                break;
            case "n":
                this.safeEmit(EVENT.NEWS, mapNews(frame as never));
                break;
            default:
                this.log(`unhandled stream frame type: ${frame.T}`);
        }
    }

    private addSubscription(channel: MarketDataChannel, symbols: string[]): void {
        validateSymbols(symbols);
        const set = new Set(this.subscriptions[channel]);
        const added: string[] = [];
        for (const s of symbols) {
            if (!set.has(s)) {
                set.add(s);
                added.push(s);
            }
        }
        this.subscriptions[channel] = Array.from(set);
        if (added.length > 0 && this.authenticated) {
            this.send({ action: "subscribe", [channel]: added });
        }
    }

    private removeSubscription(channel: MarketDataChannel, symbols: string[]): void {
        validateSymbols(symbols);
        const remove = new Set(symbols);
        this.subscriptions[channel] = this.subscriptions[channel].filter(
            (s) => !remove.has(s),
        );
        if (symbols.length > 0 && this.authenticated) {
            this.send({ action: "unsubscribe", [channel]: symbols });
        }
    }

    private updateSubscriptions(frame: ControlOrDataFrame): void {
        for (const channel of CHANNELS) {
            const value = frame[channel];
            if (Array.isArray(value)) {
                this.subscriptions[channel] = value as string[];
            }
        }
    }
}

/** US-equities data feed. */
export type StockFeed = "iex" | "sip" | "delayed_sip";

export interface StockDataStreamOptions extends MarketDataStreamOptions {
    /** Data feed. Defaults to `iex` (free tier). */
    feed?: StockFeed;
}

export class StockDataStream extends MarketDataStream {
    constructor(options: StockDataStreamOptions) {
        const { feed = "iex", sandbox, url, ...rest } = options;
        super({ ...rest, url: url ?? `${streamHost(sandbox)}/v2/${feed}` });
    }
}

export interface CryptoDataStreamOptions extends MarketDataStreamOptions {
    /** Crypto location/route. Defaults to `us`. */
    loc?: string;
}

export class CryptoDataStream extends MarketDataStream {
    constructor(options: CryptoDataStreamOptions) {
        const { loc = "us", sandbox, url, ...rest } = options;
        if (url == null) {
            requireProduction("crypto", sandbox);
        }
        super({ ...rest, url: url ?? `${MARKET_DATA_STREAM_HOST}/v1beta3/crypto/${loc}` });
    }
}

/** Options data feed. */
export type OptionFeed = "indicative" | "opra";

export interface OptionDataStreamOptions extends MarketDataStreamOptions {
    /** Options feed. Defaults to `indicative`. */
    feed?: OptionFeed;
}

export class OptionDataStream extends MarketDataStream {
    constructor(options: OptionDataStreamOptions) {
        const { feed = "indicative", sandbox, url, ...rest } = options;
        super({ ...rest, url: url ?? `${streamHost(sandbox)}/v1beta1/${feed}` });
    }
}

export class NewsStream extends MarketDataStream {
    constructor(options: MarketDataStreamOptions) {
        const { sandbox, url, ...rest } = options;
        if (url == null) {
            requireProduction("news", sandbox);
        }
        super({ ...rest, url: url ?? `${MARKET_DATA_STREAM_HOST}/v1beta1/news` });
    }
}
