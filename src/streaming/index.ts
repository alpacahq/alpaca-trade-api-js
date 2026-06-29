/**
 * Real-time streaming clients for Alpaca's WebSocket APIs.
 *
 * Hand-written module (the generated SDK is REST-only).
 *
 * @example Market data (data-visualization backend)
 * ```ts
 * import { streaming } from "@alpacahq/alpaca-ts-alpha";
 *
 * const stocks = new streaming.StockDataStream({
 *   credentials: { keyId, secret },
 *   feed: "iex",
 * });
 * stocks.onBar((bar) => pushToClients(bar));
 * stocks.onConnect(() => stocks.subscribeForBars(["AAPL", "MSFT"]));
 * stocks.connect();
 * ```
 *
 * @example Trade updates (trading bot)
 * ```ts
 * import { streaming } from "@alpacahq/alpaca-ts-alpha";
 *
 * const trading = new streaming.TradingStream({ credentials: { keyId, secret }, paper: true });
 * trading.onTradeUpdate((u) => console.log(u.event, u.order.symbol)); // u.order is a typed Order
 * // raw snake_case wire keys are still preserved too: u.order["client_order_id"]
 * trading.onConnect(() => trading.subscribeTradeUpdates());
 * trading.connect();
 * ```
 */
export * from "./websocket";
export * from "./types";
export * from "./marketDataStream";
export * from "./tradingStream";

import { EVENT } from "./websocket";
import {
    StockDataStream,
    CryptoDataStream,
    OptionDataStream,
    NewsStream,
} from "./marketDataStream";
import { TradingStream } from "./tradingStream";
import { provideStreaming } from "../streamingRegistry";

// Register the streaming implementation so the REST facade can construct stream
// clients without a static dependency on this module (and its `ws`/msgpack
// deps). Runs whenever this module is loaded - i.e. always for the main
// `@alpacahq/alpaca-ts-alpha` entrypoint, never for `@alpacahq/alpaca-ts-alpha/rest`.
provideStreaming({
    TradingStream,
    StockDataStream,
    CryptoDataStream,
    OptionDataStream,
    NewsStream,
    EVENT,
});
