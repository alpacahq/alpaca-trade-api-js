import {
    type MarketDataClient,
    marketData,
    TimeFrame,
} from "../../src";

declare const client: MarketDataClient;
declare const legacyAdjustment: string;

client.getStockBars({
    symbols: "AAPL",
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.getStockBarsFor("AAPL", {
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.getStockCandles({
    symbols: ["AAPL", "MSFT"],
    timeframe: TimeFrame.Minute,
    adjustment: [
        marketData.StockAdjustment.Dividend,
        marketData.StockAdjustment.SpinOff,
    ],
});

client.getStockCandlesFor("AAPL", {
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.iterateStockBars({
    symbols: "AAPL",
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.collectStockBarsBySymbol({
    symbols: "AAPL",
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.iterateStockBarSingle({
    symbol: "AAPL",
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});

client.collectStockBarSingle({
    symbol: "AAPL",
    timeframe: TimeFrame.Day,
    adjustment: legacyAdjustment,
});
