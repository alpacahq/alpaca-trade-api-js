"use strict";

const { expect } = require("chai");
const alpacaApi = require("../lib/alpaca-trade-api");
const mockServer = require("./support/mock-streaming");

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

describe("data_stream_v2", () => {
  let streaming_mock;
  let alpaca;
  let socket;
  let port;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor(fn, interval = 1, timeout = 1000) {
    const start = new Date().getTime();
    while (new Date().getTime() <= start + timeout) {
      if (fn()) {
        return true;
      }
      await sleep(interval);
    }
    return false;
  }

  before(() => {
    try {
      streaming_mock = new mockServer.StreamingWsMock(0);
      port = streaming_mock.conn._server.address().port;
      alpaca = new alpacaApi({
        dataStreamUrl: `http://localhost:${port}`,
        keyId: "key1",
        secretKey: "secret1",
        feed: "sip",
      });
      socket = alpaca.data_stream_v2;
    } catch (e) {
      console.log(e);
    }
  });

  after(() => {
    socket.disconnect();
    streaming_mock.close();
  });

  it("user can auth", async () => {
    let status;
    socket.onStateChange((state) => {
      status = state;
    });

    socket.connect();

    const res = await waitFor(() => {
      return status === "authenticated";
    });
    expect(res).to.be.true;
  });

  it("try to auth with wrong apiKey and Secret", async () => {
    let status;
    const alpaca = new alpacaApi({
      dataStreamUrl: `http://localhost:${port}`,
      keyId: "wrongkey",
      secretKey: "wrongsecret",
      feed: "sip",
    });
    const socket = alpaca.data_stream_v2;

    socket.onError((err) => {
      status = err;
    });

    socket.connect();
    const res = await waitFor(() => {
      return status === "auth failed";
    });
    expect(res).to.be.true;
  });

  it("subscribe for symbol", async () => {
    const expectedSubs = JSON.stringify({
      trades: ["AAPL"],
      quotes: [],
      bars: ["GE"],
    });

    socket.subscribeForTrades(["AAPL"]);
    socket.subscribeForBars(["GE"])

    const res = await waitFor(() => {
      return JSON.stringify(socket.getSubscriptions()) === expectedSubs;
    });
    expect(res).to.be.true;
  });

  it("unsubscribe from symbol", async () => {
    const expectedSubs = JSON.stringify({ trades: [], quotes: [], bars: [] });

    socket.unsubscribeFromTrades("AAPL");
    socket.unsubscribeFromBars(["GE"])

    const res = await waitFor(() => {
      return JSON.stringify(socket.getSubscriptions()) === expectedSubs;
    });
    expect(res).to.be.true;
  });

  it("parse streamed trade", async () => {
    let data;
    const parsed = JSON.stringify({
      T: "t",
      ID: 1532,
      Symbol: "AAPL",
      Exchange: "Q",
      Price: 144.6,
      Size: 25,
      Timestamp: "2021-01-27T10:35:34.82840127Z",
      Conditions: ["@", "F", "T", "I"],
      Tape: "C",
    });
    socket.onStockTrade((trade) => {
      data = trade;
    });

    socket.subscribeForTrades(["AAPL"]);

    const res = await waitFor(() => JSON.stringify(data) === parsed);
    expect(res).to.be.true;
  });

  it("parse streamed quote", async () => {
    let data;
    const parsed = JSON.stringify({
      T: "q",
      Symbol: "AAPL",
      BidExchange: "Z",
      BidPrice: 139.74,
      BidSize: 3,
      AskExchange: "Q",
      AskPrice: 139.77,
      AskSize: 1,
      Timestamp: "2021-01-28T15:20:41.384564Z",
      Condition: "R",
      Tape: "C",
    });
    socket.onStockQuote((quote) => {
      data = quote;
    });

    socket.subscribeForQuotes(["AAPL"]);

    const res = await waitFor(() => {
      return JSON.stringify(data) === parsed
    });
    expect(res).to.be.true;
  });
});
