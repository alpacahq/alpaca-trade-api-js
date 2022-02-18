"use strict";

const { expect } = require("chai");
const { isEqual } = require("lodash");
const alpacaApi = require("../dist/alpaca-trade-api");
const mockServer = require("./support/mock-streaming");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

describe("data_stream_v2", () => {
  let streaming_mock;
  let alpaca;
  let socket, socket2;
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
    socket2.disconnect();
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
    socket2 = alpaca.data_stream_v2;

    socket2.onError((err) => {
      status = err;
    });

    socket2.connect();
    const res = await waitFor(() => {
      return status === "auth failed";
    });
    expect(res).to.be.true;
  });

  it("subscribe for symbol", async () => {
    const expectedSubs = {
      trades: ["AAPL"],
      quotes: [],
      bars: ["GE"],
      updatedBars: [],
      dailyBars: [],
      statuses: [],
      lulds: [],
      cancelErrors: ["AAPL"],
      corrections: ["AAPL"],
    };

    socket.subscribeForTrades(["AAPL"]);
    socket.subscribeForBars(["GE"]);

    const res = await waitFor(() => {
      return isEqual(socket.getSubscriptions(), expectedSubs);
    });
    expect(res).to.be.true;
  });

  it("unsubscribe from symbol", async () => {
    const expectedSubs = {
      trades: [],
      quotes: [],
      bars: [],
      updatedBars: [],
      dailyBars: [],
      statuses: [],
      lulds: [],
      cancelErrors: [],
      corrections: [],
    };

    socket.unsubscribeFromTrades("AAPL");
    socket.unsubscribeFromBars(["GE"]);

    const res = await waitFor(() => {
      return isEqual(socket.getSubscriptions(), expectedSubs);
    });
    expect(res).to.be.true;
  });

  it("parse streamed trade", async () => {
    let data;
    const parsed = {
      T: "t",
      ID: 1532,
      Symbol: "AAPL",
      Exchange: "Q",
      Price: 144.6,
      Size: 25,
      Timestamp: "2021-01-27T10:35:34.82840127Z",
      Conditions: ["@", "F", "T", "I"],
      Tape: "C",
    };
    socket.onStockTrade((trade) => {
      data = trade;
    });

    socket.subscribeForTrades(["AAPL"]);

    const res = await waitFor(() => isEqual(data, parsed));
    expect(res).to.be.true;
  });

  it("parse streamed quote", async () => {
    let data;
    const parsed = {
      T: "q",
      Symbol: "AAPL",
      BidExchange: "Z",
      BidPrice: 139.74,
      BidSize: 3,
      AskExchange: "Q",
      AskPrice: 139.77,
      AskSize: 1,
      Timestamp: "2021-01-28T15:20:41.384564Z",
      Conditions: "R",
      Tape: "C",
    };
    socket.onStockQuote((quote) => {
      data = quote;
    });
    socket.subscribeForQuotes(["AAPL"]);

    const res = await waitFor(() => {
      return isEqual(data, parsed);
    });
    expect(res).to.be.true;
  });

  it("subscribe for bar and parse it", async () => {
    let data;
    const parsed = {
      T: "b",
      Symbol: "AAPL",
      OpenPrice: 127.82,
      HighPrice: 128.32,
      LowPrice: 126.32,
      ClosePrice: 126.9,
      Volume: 72015712,
      Timestamp: "2021-05-25T04:00:00Z",
      VWAP: 127.07392,
      TradeCount: 462915,
    };

    socket.onStockBar((bar) => {
      data = bar;
    });

    socket.subscribeForBars(["AAPL"]);

    const res = await waitFor(() => {
      return isEqual(data, parsed);
    });

    expect(res).to.be.true;
  });

  it("subscribe for status and parse it", async () => {
    let data;
    const parsed = {
      T: "s",
      Symbol: "AAPL",
      StatusCode: "StatusCode",
      StatusMessage: "StatusMessage",
      ReasonCode: "ReasonCode",
      ReasonMessage: "ReasonMessage",
      Timestamp: "Timestamp",
      Tape: "Tape",
    };

    socket.onStatuses((s) => {
      data = s;
    });
    socket.subscribeForStatuses(["AAPL"]);

    const res = await waitFor(() => {
      return isEqual(data, parsed);
    });
    expect(res).to.be.true;
  });

  it("subscribe for barUpdate and parse it", async () => {
    let data;
    const parsed = {
      T: "u",
      Symbol: "AAPL",
      OpenPrice: 100,
      HighPrice: 101.2,
      LowPrice: 98.67,
      ClosePrice: 101.3,
      Volume: 2570,
      Timestamp: "2021-03-05T16:00:30Z",
      TradeCount: 1235,
      VWAP: 100.123457,
    };

    socket.onStockUpdatedBar((bu) => {
      data = bu;
    });
    socket.subscribeForUpdatedBars(["AAPL"]);

    const res = await waitFor(() => {
      return isEqual(data, parsed);
    });
    expect(res).to.be.true;
  });
});
