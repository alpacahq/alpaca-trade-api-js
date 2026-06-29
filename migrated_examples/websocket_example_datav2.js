"use strict";

/**
 * This example shows how to use the Alpaca market-data websocket to subscribe
 * to events. In 4.x the stream is created by a factory method
 * (`alpaca.marketData.stockStream({ feed })`) instead of a pre-built property,
 * and the feed is passed per-stream rather than on the client constructor.
 * There are separate functions for subscribing (and unsubscribing) to trades,
 * quotes and bars as seen below.
 */

const { Alpaca } = require("@alpacahq/alpaca-trade-api");
const API_KEY = "<YOUR_API_KEY>";
const API_SECRET = "<YOUR_API_SECRET>";

class DataStream {
  constructor({ apiKey, secretKey, feed }) {
    this.alpaca = new Alpaca({
      keyId: apiKey,
      secret: secretKey,
      paper: true,
    });

    const socket = this.alpaca.marketData.stockStream({ feed });

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

    socket.onTrade((trade) => {
      console.log(trade);
    });

    socket.onQuote((quote) => {
      console.log(quote);
    });

    socket.onBar((bar) => {
      console.log(bar);
    });

    socket.onStatus((s) => {
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
});
