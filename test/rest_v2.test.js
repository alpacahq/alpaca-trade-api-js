"use strict";

const { expect } = require("chai");
const api = require("../lib/alpaca-trade-api");
const mock = require("./support/mock-server");

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
    expect(trades[0]).to.have.all.keys([
      "ID",
      "Exchange",
      "Price",
      "Size",
      "Timestamp",
      "Conditions",
      "Tape",
    ]);
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

    // default amount of data is 4
    expect(quotes.length).equal(4);
    expect(quotes[0]).to.have.all.keys([
      "BidExchange",
      "BidPrice",
      "BidSize",
      "AskExchange",
      "AskPrice",
      "AskSize",
      "Timestamp",
      "Condition",
    ]);
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
    expect(quotes[0]).to.have.all.keys([
      "BidExchange",
      "BidPrice",
      "BidSize",
      "AskExchange",
      "AskPrice",
      "AskSize",
      "Timestamp",
      "Condition",
    ]);
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
    expect(bars[0]).to.have.all.keys([
      "OpenPrice",
      "HighPrice",
      "LowPrice",
      "ClosePrice",
      "Volume",
      "Timestamp",
    ]);
  });

  it("get latest AAPL trade", async () => {
    const resp = await alpaca.getLatestTrade("AAPL", alpaca.configuration);

    expect(resp).to.have.all.keys([
      "ID",
      "Exchange",
      "Price",
      "Size",
      "Timestamp",
      "Conditions",
      "Tape",
    ]);
  });

  it("get last FB quote", async () => {
    const resp = await alpaca.getLatestQuote("FB", alpaca.configuration);

    expect(resp).to.have.all.keys([
      "BidExchange",
      "BidPrice",
      "BidSize",
      "AskExchange",
      "AskPrice",
      "AskSize",
      "Timestamp",
      "Condition",
    ])
  })
});
