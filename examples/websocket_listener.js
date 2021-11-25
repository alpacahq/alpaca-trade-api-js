/**
 * this example shows how to use the alpaca data websocket to subscribe to
 * events. no trading will be done here but you could easily use long-short.js
 * to add trading logic to this example too
 */

const Alpaca = require("@alpacahq/alpaca-trade-api");
const API_KEY = "<YOUR_API_KEY>";
const API_SECRET = "<YOUR_API_SECRET>";

class WebsocketSubscriber {
  constructor({ keyId, secretKey, paper = true }) {
    this.alpaca = new Alpaca({
      keyId: keyId,
      secretKey: secretKey,
      paper: paper,
    });

    const data_client = this.alpaca.data_ws;
    data_client.onConnect(function () {
      console.log("Connected");
      const keys = [
        "alpacadatav1/T.FB",
        "alpacadatav1/Q.AAPL",
        "alpacadatav1/AM.AAPL",
        "alpacadatav1/AM.FB",
      ];
      data_client.subscribe(keys);
    });
    data_client.onDisconnect(() => {
      console.log("Disconnected");
    });
    data_client.onStateChange((newState) => {
      console.log(`State changed to ${newState}`);
    });
    data_client.onStockTrades(function (subject, data) {
      console.log(`Stock trades: ${subject}, price: ${data.price}`);
    });
    data_client.onStockQuotes(function (subject, data) {
      console.log(
        `Stock quotes: ${subject}, bid: ${data.bidprice}, ask: ${data.askprice}`
      );
    });
    data_client.onStockAggSec(function (subject, data) {
      console.log(`Stock agg sec: ${subject}, ${data}`);
    });
    data_client.onStockAggMin(function (subject, data) {
      console.log(`Stock agg min: ${subject}, ${data}`);
    });
    data_client.connect();

    const updates_client = this.alpaca.trade_ws;
    updates_client.onConnect(function () {
      console.log("Connected");
      const trade_keys = ["trade_updates", "account_updates"];
      updates_client.subscribe(trade_keys);
    });
    updates_client.onDisconnect(() => {
      console.log("Disconnected");
    });
    updates_client.onStateChange((newState) => {
      console.log(`State changed to ${newState}`);
    });
    updates_client.onOrderUpdate((data) => {
      console.log(`Order updates: ${JSON.stringify(data)}`);
    });
    updates_client.onAccountUpdate((data) => {
      console.log(`Account updates: ${JSON.stringify(data)}`);
    });
    updates_client.connect();
  }
}

// Run the LongShort class
let ls = new WebsocketSubscriber({
  keyId: API_KEY,
  secretKey: API_SECRET,
  paper: true,
});
