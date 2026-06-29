/**
 * Real-time trading (order/account) updates over Alpaca's JSON WebSocket.
 *
 * Protocol differs from market data: JSON framing, an `authenticate` frame, and
 * a `listen` subscription for the `trade_updates` channel.
 */
import {
    AlpacaWebSocket,
    type AlpacaWebSocketOptions,
    EVENT,
} from "./websocket";
import { mapTradeUpdate, type TradeUpdate } from "./types";

export const TRADING_STREAM_PAPER = "wss://paper-api.alpaca.markets/stream";
export const TRADING_STREAM_LIVE = "wss://api.alpaca.markets/stream";

export interface TradingStreamOptions
    extends Omit<AlpacaWebSocketOptions, "url" | "codec"> {
    /** Use the paper endpoint. Defaults to true. */
    paper?: boolean;
    /** Override the endpoint entirely (takes precedence over `paper`). */
    url?: string;
}

interface TradingFrame {
    stream?: string;
    data?: Record<string, unknown>;
}

export class TradingStream extends AlpacaWebSocket {
    private subscribed = false;

    constructor(options: TradingStreamOptions) {
        const { paper = true, url, ...rest } = options;
        super({
            ...rest,
            codec: "json",
            url: url ?? (paper ? TRADING_STREAM_PAPER : TRADING_STREAM_LIVE),
        });
    }

    /** Subscribe to `trade_updates` for the account. */
    subscribeTradeUpdates(): void {
        this.subscribed = true;
        if (this.authenticated) {
            this.sendListen();
        }
    }

    /** Register a handler for order/trade updates. */
    onTradeUpdate(fn: (update: TradeUpdate) => void): this {
        return this.on(EVENT.TRADE_UPDATE, fn);
    }

    protected sendAuth(): void {
        this.send({
            action: "authenticate",
            data: { key_id: this.keyId, secret_key: this.secret },
        });
    }

    protected resubscribe(): void {
        if (this.subscribed) {
            this.sendListen();
        }
    }

    protected handleMessage(message: unknown): void {
        const frame = message as TradingFrame;
        switch (frame.stream) {
            case "authorization":
                if (frame.data?.status === "authorized") {
                    this.onAuthenticated();
                } else {
                    // Terminal: surface the error and stop (no reconnect with
                    // rejected credentials).
                    this.failAuthentication("auth failed");
                }
                break;
            case "listening":
                this.emit(EVENT.SUBSCRIPTION, frame.data?.streams ?? []);
                break;
            case "trade_updates":
                this.emit(
                    EVENT.TRADE_UPDATE,
                    mapTradeUpdate(frame.data ?? {}),
                );
                break;
            default:
                this.log(`unhandled trading frame: ${frame.stream}`);
        }
    }

    private sendListen(): void {
        this.send({ action: "listen", data: { streams: ["trade_updates"] } });
    }
}
