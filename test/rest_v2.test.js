"use strict";

const { expect } = require("chai");
const api = require("../lib/alpaca-trade-api");
const mock = require("./support/mock-server");

function assertTrade(
  trade,
  keys = ["ID", "Exchange", "Price", "Size", "Timestamp", "Conditions", "Tape"]
) {
  expect(trade).to.have.all.keys(keys);
}

function assertBar(bar) {
  expect(bar).to.have.all.keys([
    "OpenPrice",
    "HighPrice",
    "LowPrice",
    "ClosePrice",
    "Volume",
    "Timestamp",
  ]);
}

function assertQuote(
  quote,
  keys = [
    "BidExchange",
    "BidPrice",
    "BidSize",
    "AskExchange",
    "AskPrice",
    "AskSize",
    "Timestamp",
    "Condition",
  ]
) {
  expect(quote).to.have.all.keys(keys);
}

function assertSnapshot(snapshot) {
  expect(snapshot).to.have.all.keys([
    "symbol",
    "LatestTrade",
    "LatestQuote",
    "MinuteBar",
    "DailyBar",
    "PrevDailyBar",
  ]);
  assertTrade(snapshot.LatestTrade);
  assertBar(snapshot.MinuteBar);
  assertQuote(snapshot.LatestQuote);
}

describe("data v2 rest", () => {
  let alpaca;

  before(() => {
    alpaca = new api(mock.getConfig());
  });

  it("get trades with paging", async () => {
    let resp = alpaca.getTradesV2(
      "AAPL",
      {
        start: "2021-02-08",
        end: "2021-02-10",
        limit: 10,
      },
      alpaca.configuration
    );
    const trades = [];

    for await (let t of resp) {
      trades.push(t);
    }

    expect(trades.length).equal(10);
    assertTrade(trades[0]);
  });

  it("get quotes", async () => {
    let resp = alpaca.getQuotesV2(
      "AAPL",
      {
        start: "2021-02-08",
        end: "2021-02-10",
        limit: 4,
      },
      alpaca.configuration
    );
    const quotes = [];

    for await (let q of resp) {
      quotes.push(q);
    }

    expect(quotes.length).equal(4);
    assertQuote(quotes[0]);
  });

  it("get quotes without limit", async () => {
    let resp = alpaca.getQuotesV2(
      "AAPL",
      {
        start: "2021-02-08",
        end: "2021-02-10",
      },
      alpaca.configuration
    );
    const quotes = [];

    for await (let q of resp) {
      quotes.push(q);
    }

    expect(quotes.length).equal(3);
    assertQuote(quotes[0]);
  });

  it("get bars", async () => {
    let resp = alpaca.getBarsV2(
      "AAPL",
      {
        start: "2021-02-01",
        end: "2021-02-10",
        limit: 2,
        timeframe: "1Day",
        adjustment: alpaca.adjustment.RAW,
      },
      alpaca.configuration
    );
    const bars = [];

    for await (let b of resp) {
      bars.push(b);
    }

    expect(bars.length).equal(2);
    assertBar(bars[0]);
  });

  it("get latest AAPL trade", async () => {
    const resp = await alpaca.getLatestTrade("AAPL", alpaca.configuration);

    assertTrade(resp);
  });

  it("get last FB quote", async () => {
    const resp = await alpaca.getLatestQuote("FB", alpaca.configuration);

    assertQuote(resp);
  });

  it("get snapshot for one symbol", async () => {
    const resp = await alpaca.getSnapshot("AAPL", alpaca.configuration);

    assertSnapshot(resp);
  });

  it("get snapashots for symbols", async () => {
    const resp = await alpaca.getSnapshots(
      ["FB", "AAPL"],
      alpaca.configuration
    );

    expect(resp.length).equal(2);
    resp.map((s) => {
      assertSnapshot(s);
    });
  });

  it("get multi trades with wrong symbols param", async () => {
    await expect(
      alpaca.getMultiTradesV2(
        "",
        {
          start: "2021-09-01T00:00:00.00Z",
          end: "2021-09-02T22:00:00Z",
        },
        alpaca.configuration
      )
    ).to.eventually.be.rejectedWith("symbols should be an array");
  });

  it("get multi trades", async () => {
    const resp = await alpaca.getMultiTradesV2(
      ["AAPL", "FB"],
      {
        start: "2021-09-01T00:00:00.00Z",
        end: "2021-09-02T22:00:00Z",
      },
      alpaca.configuration
    );
    let gotSymbols = [];
    for (let symbol in resp) {
      gotSymbols.push(symbol);
      const trade = resp[symbol][0];
      assertTrade(trade, [
        "Symbol",
        "ID",
        "Exchange",
        "Price",
        "Size",
        "Timestamp",
        "Conditions",
        "Tape",
      ]);
    }
    expect(gotSymbols.length).to.equal(2);
  });

  it("get multi trades async", async () => {
    const resp = alpaca.getMultiTradesAsyncV2(
      ["AAPL", "FB"],
      {
        start: "2021-09-01T00:00:00.00Z",
        end: "2021-09-02T22:00:00Z",
      },
      alpaca.configuration
    );
    let gotSymbols = new Map();
    for await (let t of resp) {
      gotSymbols.set(t.Symbol, {});
      assertTrade(t, [
        "ID",
        "Symbol",
        "Exchange",
        "Price",
        "Size",
        "Timestamp",
        "Conditions",
        "Tape",
      ]);
    }
    expect(gotSymbols.size).to.equal(2);
  });

  it("get multi quotes async", async () => {
    const resp = alpaca.getMultiQuotesAsyncV2(
      ["AAPL", "FB"],
      {
        start: "2021-08-11T08:30:00.00Z",
        end: "2021-09-12T16:00:00Z",
      },
      alpaca.configuration
    );
    let gotSymbols = new Map();
    for await (let q of resp) {
      gotSymbols.set(q.Symbol, {});
      assertQuote(q, [
        "Symbol",
        "BidExchange",
        "BidPrice",
        "BidSize",
        "AskExchange",
        "AskPrice",
        "AskSize",
        "Timestamp",
        "Condition",
      ]);
    }
    expect(gotSymbols.size).to.equal(2);
  });
});

function assertCryptoQuote(quote) {
  expect(quote).to.have.all.keys([
    "Symbol",
    "Timestamp",
    "Exchange",
    "BidPrice",
    "BidSize",
    "AskPrice",
    "AskSize",
  ]);
}

describe("crypto data", () => {
  let alpaca;

  before(() => {
    alpaca = new api(mock.getConfig());
  });

  it("get quotes", async () => {
    const resp = alpaca.getCryptoQuotes(
      "BTCUSD",
      {
        start: "2021-09-10",
        end: "2021-09-11",
        limit: 3,
        exchanges: "CBSE",
      },
      alpaca.configuration
    );

    const quotes = [];

    for await (let q of resp) {
      quotes.push(q);
      assertCryptoQuote(q);
    }
    expect(quotes.length).equal(3);
  });
});
