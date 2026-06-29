/**
 * this example shows how to use the alpaca data websocket to subscribe to
 * events. no trading will be done here but you could easily use long-short.js
 * to add trading logic to this example too
 */

const { Alpaca } = require("@alpacahq/alpaca-trade-api");
const API_KEY = "<YOUR_API_KEY>";
const API_SECRET = "<YOUR_API_SECRET>";

class WebsocketSubscriber {
  constructor({ keyId, secretKey, paper = true }) {
    this.alpaca = new Alpaca({
      keyId: keyId,
      secret: secretKey,
      paper: paper,
    });

    // Market-data stream: created by a factory method, with a per-stream feed.
    // The old channel strings (e.g. "alpacadatav1/T.FB") are replaced by typed
    // per-channel subscribe helpers.
    const data_client = this.alpaca.marketData.stockStream({ feed: "iex" });
    data_client.onConnect(function () {
      console.log("Connected");
      data_client.subscribeForTrades(["FB"]);
      data_client.subscribeForQuotes(["AAPL"]);
      data_client.subscribeForBars(["AAPL", "FB"]);
    });
    data_client.onDisconnect(() => {
      console.log("Disconnected");
    });
    data_client.onStateChange((newState) => {
      console.log(`State changed to ${newState}`);
    });
    data_client.onTrade(function (trade) {
      console.log("Stock trade:", trade);
    });
    data_client.onQuote(function (quote) {
      console.log("Stock quote:", quote);
    });
    data_client.onBar(function (bar) {
      console.log("Stock bar:", bar);
    });
    data_client.connect();

    // Trade-updates (account) stream: created by `trading.stream()`.
    const updates_client = this.alpaca.trading.stream();
    updates_client.onConnect(function () {
      console.log("Connected");
      updates_client.subscribeTradeUpdates();
    });
    updates_client.onDisconnect(() => {
      console.log("Disconnected");
    });
    updates_client.onStateChange((newState) => {
      console.log(`State changed to ${newState}`);
    });
    updates_client.onTradeUpdate((update) => {
      console.log(`Trade update: ${update.event} ${update.order.symbol}`);
    });
    updates_client.connect();
  }
}

// Run the WebsocketSubscriber class
let ls = new WebsocketSubscriber({
  keyId: API_KEY,
  secretKey: API_SECRET,
  paper: true,
});
