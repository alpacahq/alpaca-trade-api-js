/**
 * This Typescript example shows how to use the alpaca data v2 rest functions with some
 * simple examples that log their results to the console in a readable tabled format.
 * Don't forget to install the dependencies before running it.
 */

import Alpaca from "@alpacahq/alpaca-trade-api";
import {
  AlpacaQuote,
  AlpacaTrade,
  AlpacaBar,
} from "@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2";
import * as _ from "lodash";
import moment from "moment";

(async () => {
  // Create your alpaca object by setting your credentials
  // There are more configurable options there, e.g.
  // URLs and more
  const alpaca = new Alpaca({
    keyId: "API_KEY",
    secretKey: "API_SECRET",
  });

  // Get all the trades between a start and end time. The paging was implemented
  // in the SDK
  const start = "2022-03-10T00:00:00Z";
  const end = "2022-03-10T23:59:59Z";
  let symbol = "TMF";
  const trades = alpaca.getTradesV2(symbol, { start, end });
  const tradeData: AlpacaTrade[] = [];
  // Due to the pagination setup in the actual API, the SDK returns async generators
  // for functions like getTradesV2. If you want to get results out of the generator
  // it is recommend you use a for await loop like below.
  for await (const t of trades) {
    tradeData.push(t);
  }
  console.log("Trades for TMF");
  console.table(tradeData.slice(0, 5));

  // Do the same for quotes as well but set a limit
  symbol = "IBM";
  let quotes = alpaca.getQuotesV2(symbol, { start, end, limit: 5 });
  let quoteData: AlpacaQuote[] = [];
  for await (const q of quotes) {
    quoteData.push(q);
  }
  console.log("Quotes for IBM");
  console.table(quoteData);

  // Did your order fill within the bid/ask spread?
  // Find the fill price and exact fill time
  quotes = alpaca.getQuotesV2(symbol, { start, end });
  quoteData = [];
  for await (const q of quotes) {
    quoteData.push(q);
  }
  const filledPrice = 125.7;
  const filledTime = "2022-03-10T14:34:24.04372096Z";

  const q = quoteData.filter((q) => q.Timestamp === filledTime)[0];
  const filledWithinSpread =
    q.BidPrice <= filledPrice && filledPrice <= q.AskPrice;
  console.log(
    `order filled within spread: ${filledWithinSpread ? "yes" : "no"}`
  );

  // Get previous 10 daily bars for SPY
  // First get the current day and all trading days
  symbol = "SPY";
  const clock = await alpaca.getClock();
  const tradingDays = await alpaca.getCalendar();
  const i = _.findLastIndex(
    tradingDays,
    (d: any) => d.date <= moment(clock).format("YYYY-MM-DD")
  );
  const last10TradingDays = tradingDays.slice(i - 9, i + 1);
  const bars = alpaca.getBarsV2(symbol, {
    start: last10TradingDays.shift().date,
    end: last10TradingDays.pop().date,
    timeframe: "1Day",
    adjustment: "all",
  });

  let barsData: AlpacaBar[] = [];
  for await (const b of bars) {
    barsData.push(b);
  }
  console.log("Last 10 daily bars for SPY");
  console.table(barsData);

  // Fetch the current open, bid, ask, and last price in one call for multiple symbols
  // Calculate the spread and todays gain for each

  // First get all the data we need in a single snapshots call
  const symbols = ["SPY", "IBM", "AAPL"];
  const snapshots = await alpaca.getSnapshots(symbols);

  const toDisplay: any = {};
  for (const s of snapshots) {
    const values = {
      open: s.DailyBar.OpenPrice,
      bid: s.LatestQuote.BidPrice,
      ask: s.LatestQuote.AskPrice,
      lastPrice: s.DailyBar.ClosePrice,
      spread: s.LatestQuote.BidPrice - s.LatestQuote.AskPrice,
      todaysGain: s.DailyBar.ClosePrice / s.DailyBar.OpenPrice - 1,
    };
    toDisplay[(s as any).symbol] = values;
  }
  console.log("Spreads and gains");
  console.table(toDisplay);

  // Get bars for Facebook
  const FBBars = alpaca.getBarsV2("META", {
    start: "2022-06-02",
    end: "2022-06-22",
    timeframe: "1Day",
    asof: "2022-06-10",
  });
  barsData = [];

  for await (const b of FBBars) {
    barsData.push(b);
  }

  console.log("META bars");
  console.table(barsData);
})();
