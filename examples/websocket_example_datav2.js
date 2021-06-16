"use strict";

/**
 * This examples shows how to use tha alpaca data v2 websocket to subscribe to events.
 * You should use the alpaca api's data_steam_v2, also add feed besides the other parameters.
 * For subscribing (and unsubscribing) to trades, quotes and bars you should call
 * a function for each like below.
 */

const Alpaca = require("@alpacahq/alpaca-trade-api");
const API_KEY = "<YOUR_API_KEY>";
const API_SECRET = "<YOUR_API_SECRET>";

class DataStream {
  constructor({ apiKey, secretKey, feed }) {
    this.alpaca = new Alpaca({
      keyId: apiKey,
      secretKey,
      feed,
    });

    const socket = this.alpaca.data_stream_v2;

    socket.onConnect(function () {
      console.log("Connected");
      socket.subscribeForQuotes(["AAPL"]);
      socket.subscribeForTrades(["FB"]);
      socket.subscribeForBars(["SPY"]);
      socket.subscribeForStatuses(["*"]);
    });

    socket.onError((err) => {
      console.log(err);
    });

    socket.onStockTrade((trade) => {
      console.log(trade);
    });

    socket.onStockQuote((quote) => {
      console.log(quote);
    });

    socket.onStockBar((bar) => {
      console.log(bar);
    });

    socket.onStatuses((s) => {
      console.log(s);
    });

    socket.onStateChange((state) => {
      console.log(state);
    });

    socket.onDisconnect(() => {
      console.log("Disconnected");
    });

    socket.connect();

    // unsubscribe from FB after a second
    setTimeout(() => {
      socket.unsubscribeFromTrades(["FB"]);
    }, 1000);
  }
}

let stream = new DataStream({
  apiKey: API_KEY,
  secretKey: API_SECRET,
  feed: "sip",
  paper: true,
});
