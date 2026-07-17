/**
 * This Typescript example shows how to use the Alpaca market-data REST functions
 * with some simple examples that log their results to the console in a readable
 * tabled format. Don't forget to install the dependencies before running it.
 *
 * In 4.x the historical helpers auto-paginate and return plain arrays /
 * symbol-keyed objects (no more async generators), the client is split into
 * `trading` / `marketData` namespaces, and fields are camelCased.
 */

import { Alpaca, TimeFrame } from "@alpacahq/alpaca-trade-api";

(async () => {
  // Create your alpaca object by setting your credentials.
  // There are more configurable options here, e.g. timeouts, retry and more.
  const alpaca = new Alpaca({
    keyId: "API_KEY",
    secret: "API_SECRET",
  });

  // Get all the trades between a start and end time. Pagination is handled by
  // the SDK, which now returns a plain array (was an async generator).
  const start = new Date("2022-03-10T00:00:00Z");
  const end = new Date("2022-03-10T23:59:59Z");
  let symbol = "TMF";
  const tradeData = await alpaca.marketData.getStockTradesFor(symbol, { start, end });
  console.log("Trades for TMF");
  console.table(tradeData.slice(0, 5));

  // Do the same for quotes as well but set a limit.
  symbol = "IBM";
  let quoteData = await alpaca.marketData.getStockQuotesFor(symbol, { start, end, limit: 5 });
  console.log("Quotes for IBM");
  console.table(quoteData);

  // Did your order fill within the bid/ask spread?
  // Find the fill price and exact fill time.
  quoteData = await alpaca.marketData.getStockQuotesFor(symbol, { start, end });
  const filledPrice = 125.7;
  const filledTime = "2022-03-10T14:34:24.04372096Z";

  // Quote timestamps are real Date objects in 4.x; fields are camelCase.
  const q = quoteData.find((q) => q.timestamp.toISOString() === filledTime);
  if (q) {
    const filledWithinSpread = q.bidPrice <= filledPrice && filledPrice <= q.askPrice;
    console.log(`order filled within spread: ${filledWithinSpread ? "yes" : "no"}`);
  } else {
    console.log("no quote found at the exact fill time");
  }

  // Get previous 10 daily bars for SPY.
  // First get the current day and all trading days.
  symbol = "SPY";
  const clock = await alpaca.trading.clock.legacyClock();
  const today = clock.timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
  const tradingDays = await alpaca.trading.calendar.legacyCalendar();
  // `date` is a real Date object in 4.x; find the last index on/before today.
  let i = -1;
  for (let idx = 0; idx < tradingDays.length; idx++) {
    if (tradingDays[idx].date.toISOString().slice(0, 10) <= today) {
      i = idx;
    }
  }
  const last10TradingDays = tradingDays.slice(i - 9, i + 1);
  // getStockBarsFor returns a plain Bar[] (already paginated).
  const bars = await alpaca.marketData.getStockBarsFor(symbol, {
    start: last10TradingDays[0].date,
    end: last10TradingDays[last10TradingDays.length - 1].date,
    timeframe: TimeFrame.Day,
    adjustment: "all",
  });
  console.log("Last 10 daily bars for SPY");
  console.table(bars);

  // Fetch the current open, bid, ask, and last price in one call for multiple
  // symbols and calculate the spread and today's gain for each.

  // First get all the data we need in a single snapshots call.
  const symbols = ["SPY", "IBM", "AAPL"];
  // The generated snapshots method returns a symbol-keyed object of snapshots
  // whose nested bars/quotes use the raw wire keys (o/h/l/c, bp/ap, ...).
  const snapshots = await alpaca.marketData.stocks.stockSnapshots({ symbols: symbols.join(",") });

  const toDisplay: { [symbol: string]: unknown } = {};
  for (const [sym, s] of Object.entries(snapshots)) {
    toDisplay[sym] = {
      open: s.dailyBar?.o,
      bid: s.latestQuote?.bp,
      ask: s.latestQuote?.ap,
      lastPrice: s.dailyBar?.c,
      spread: (s.latestQuote?.bp ?? 0) - (s.latestQuote?.ap ?? 0),
      todaysGain:
        s.dailyBar && s.dailyBar.o !== 0 ? s.dailyBar.c / s.dailyBar.o - 1 : undefined,
    };
  }
  console.log("Spreads and gains");
  console.table(toDisplay);

  // Get bars for Facebook/Meta.
  const FBBars = await alpaca.marketData.getStockBarsFor("META", {
    start: new Date("2022-06-02"),
    end: new Date("2022-06-22"),
    timeframe: TimeFrame.Day,
    asof: "2022-06-10",
  });
  console.log("META bars");
  console.table(FBBars);
})();
