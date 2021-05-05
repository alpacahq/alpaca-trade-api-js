"use strict";

const { expect } = require("chai");
const api = require("../lib/alpaca-trade-api");
const mock = require("./support/mock-server");

function checkTrade(trade) {
  expect(trade).to.have.all.keys([
    "ID",
    "Exchange",
    "Price",
    "Size",
    "Timestamp",
    "Conditions",
    "Tape",
  ]);
}

function checkBar(bar) {
  expect(bar).to.have.all.keys([
    "OpenPrice",
    "HighPrice",
    "LowPrice",
    "ClosePrice",
    "Volume",
    "Timestamp",
  ]);
}

function checkQuote(quote) {
  expect(quote).to.have.all.keys([
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

function checkSnapshot(snapshot) {
  expect(snapshot).to.have.all.keys([
    "symbol",
    "LatestTrade",
    "LatestQuote",
    "MinuteBar",
    "DailyBar",
    "PrevDailyBar",
  ]);
  checkTrade(snapshot.LatestTrade);
  checkBar(snapshot.MinuteBar);
  checkQuote(snapshot.LatestQuote);
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
    checkTrade(trades[0]);
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
    checkQuote(quotes[0]);
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
    checkQuote(quotes[0]);
  });

  it("get bars", async () => {
    let resp = alpaca.getBarsV2(
      "AAPL",
      {
        start: "2021-02-01",
        end: "2021-02-10",
        limit: 2,
        timeframe: "1Day",
        adjustment: "all",
      },
      alpaca.configuration
    );
    const bars = [];

    for await (let b of resp) {
      bars.push(b);
    }

    expect(bars.length).equal(2);
    checkBar(bars[0]);
  });

  it("get latest AAPL trade", async () => {
    const resp = await alpaca.getLatestTrade("AAPL", alpaca.configuration);

    checkTrade(resp);
  });

  it("get last FB quote", async () => {
    const resp = await alpaca.getLatestQuote("FB", alpaca.configuration);

    checkQuote(resp);
  });

  it("get snapshot for one symbol", async () => {
    const resp = await alpaca.getSnapshot("AAPL", alpaca.configuration);

    checkSnapshot(resp);
  });

  it("get snapashots for symbols", async () => {
    const resp = await alpaca.getSnapshots(
      ["FB", "AAPL"],
      alpaca.configuration
    );

    expect(resp.length).equal(2);
    resp.map((s) => {
      checkSnapshot(s);
    });
  });
});
