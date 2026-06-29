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
    mapLuld,
    mapNews,
    mapOrderbook,
    mapQuote,
    mapStatus,
    mapTrade,
    type StreamBar,
    type StreamCancelError,
    type StreamCorrection,
    type StreamLuld,
    type StreamNews,
    type StreamOrderbook,
    type StreamQuote,
    type StreamStatus,
    type StreamTrade,
} from "./types";

export const MARKET_DATA_STREAM_HOST = "wss://stream.data.alpaca.markets";
export const MARKET_DATA_STREAM_SANDBOX_HOST = "wss://stream.data.sandbox.alpaca.markets";

/** Numeric codes Alpaca returns for terminal authentication failures. */
const AUTH_FAILURE_CODES = new Set<number>([401, 402, 404]);

/** Pick the market-data stream host for the selected environment. */
function streamHost(sandbox?: boolean): string {
    return sandbox ? MARKET_DATA_STREAM_SANDBOX_HOST : MARKET_DATA_STREAM_HOST;
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
    "orderbooks",
    "news",
];

/** Options for a market-data subclass (endpoint URL is derived). */
export type MarketDataStreamOptions = Omit<AlpacaWebSocketOptions, "url" | "codec"> & {
    /** Use the market-data sandbox host instead of production. Default false. */
    sandbox?: boolean;
};

interface ControlOrDataFrame {
    T?: string;
    msg?: string;
    code?: number;
    [key: string]: unknown;
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
        orderbooks: [],
        news: [],
    };

    constructor(options: Omit<AlpacaWebSocketOptions, "codec">) {
        super({ ...options, codec: "msgpack" });
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
            return;
        }
        for (const frame of message as ControlOrDataFrame[]) {
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
                    this.emit(EVENT.SUBSCRIPTION, this.getSubscriptions());
                    break;
                case "error": {
                    const message =
                        (frame.code != null && CONN_ERROR.get(frame.code)) ||
                        String(frame.msg ?? "stream error");
                    // Auth failures are terminal: don't reconnect with credentials
                    // the server already rejected.
                    if (frame.code != null && AUTH_FAILURE_CODES.has(frame.code)) {
                        this.failAuthentication(message);
                    } else {
                        this.emit(EVENT.CLIENT_ERROR, message);
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
                this.emit(EVENT.TRADE, mapTrade(frame as never));
                break;
            case "q":
                this.emit(EVENT.QUOTE, mapQuote(frame as never));
                break;
            case "b":
                this.emit(EVENT.BAR, mapBar(frame as never));
                break;
            case "u":
                this.emit(EVENT.UPDATED_BAR, mapBar(frame as never));
                break;
            case "d":
                this.emit(EVENT.DAILY_BAR, mapBar(frame as never));
                break;
            case "s":
                this.emit(EVENT.STATUS, mapStatus(frame as never));
                break;
            case "l":
                this.emit(EVENT.LULD, mapLuld(frame as never));
                break;
            case "c":
                this.emit(EVENT.CORRECTION, mapCorrection(frame as never));
                break;
            case "x":
                this.emit(EVENT.CANCEL_ERROR, mapCancelError(frame as never));
                break;
            case "o":
                this.emit(EVENT.ORDERBOOK, mapOrderbook(frame as never));
                break;
            case "n":
                this.emit(EVENT.NEWS, mapNews(frame as never));
                break;
            default:
                this.log(`unhandled stream frame type: ${frame.T}`);
        }
    }

    private addSubscription(channel: MarketDataChannel, symbols: string[]): void {
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
        const { feed = "iex", sandbox, ...rest } = options;
        super({ ...rest, url: `${streamHost(sandbox)}/v2/${feed}` });
    }
}

export interface CryptoDataStreamOptions extends MarketDataStreamOptions {
    /** Crypto location/route. Defaults to `us`. */
    loc?: string;
}

export class CryptoDataStream extends MarketDataStream {
    constructor(options: CryptoDataStreamOptions) {
        const { loc = "us", sandbox, ...rest } = options;
        super({ ...rest, url: `${streamHost(sandbox)}/v1beta3/crypto/${loc}` });
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
        const { feed = "indicative", sandbox, ...rest } = options;
        super({ ...rest, url: `${streamHost(sandbox)}/v1beta1/${feed}` });
    }
}

export class NewsStream extends MarketDataStream {
    constructor(options: MarketDataStreamOptions) {
        const { sandbox, ...rest } = options;
        super({ ...rest, url: `${streamHost(sandbox)}/v1beta1/news` });
    }
}
