/**
 * This examples shows how to use tha alpaca data v2 rest functions during some
 * simple examples. Don't forget to install the dependencies before running it.
 * The results are logged to the console in a readable tabled form.
 * This file was written in Typescript, to run it use eg. the ts-node command.
 */

import Alpaca from "@alpacahq/alpaca-trade-api";
import * as _ from "lodash";
import moment from "moment";

class Example {
  async run() {
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
    let data = [];
    // Because of getTradesV2()git  is a generator function you can loop over on the
    // result with for/await/of
    for await (const t of trades) {
      data.push(t);
    }
    console.log("Trades for TMF");
    console.table(data.slice(0, 5));

    // Do the same for quotes as well but set a limit
    symbol = "IBM";
    const quotes = alpaca.getQuotesV2(symbol, { start, end });
    data = [];
    for await (const q of quotes) {
      data.push(q);
    }
    console.log("Quotes for IBM");
    console.table(data.slice(0, 5));

    // Did your order fill within the bid/ask spread?
    // Find the fill price and exact fill time
    const filledPrice = 125.7;
    const filledTime = "2022-03-10T14:34:24.04372096Z";

    const q = data.filter((q) => q.Timestamp === filledTime)[0];
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

    const barsData = [];
    for await (const b of bars) {
      barsData.push(b);
    }
    console.log("Last 10 daily bars for SPY");
    console.table(barsData);

    // Fetch the current open, bid, ask, and last price in one call for multiple symbols
    // Calculate the spread an todays gain for each

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
      toDisplay[s.Symbol] = values;
    }
    console.table(toDisplay);
  }
}

const example = new Example();
example.run();
