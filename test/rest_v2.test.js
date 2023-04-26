"use strict";

const { expect, assert } = require("chai");
const api = require("../dist/alpaca-trade-api");
const mock = require("./support/mock-server");

const tradeKeys = ["ID", "Exchange", "Price", "Size", "Timestamp", "Conditions", "Tape"];

const quoteKeys = [
  "BidExchange",
  "BidPrice",
  "BidSize",
  "AskExchange",
  "AskPrice",
  "AskSize",
  "Timestamp",
  "Conditions",
];

const barKeys = [
  "OpenPrice",
  "HighPrice",
  "LowPrice",
  "ClosePrice",
  "Volume",
  "Timestamp",
  "TradeCount",
  "VWAP",
];

function assertTrade(trade, keys = tradeKeys) {
  expect(trade).to.have.all.keys(keys);
}

function assertQuote(quote, keys = quoteKeys) {
  expect(quote).to.have.all.keys(keys);
}

function assertBar(bar, keys = barKeys) {
  expect(bar).to.have.all.keys(keys);
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
    let resp = alpaca.getTradesV2("AAPL", {
      start: "2021-02-08",
      end: "2021-02-10",
      limit: 10,
    });
    const trades = [];

    for await (let t of resp) {
      trades.push(t);
    }

    expect(trades.length).equal(10);
    assertTrade(trades[0]);
  });

  it("get quotes", async () => {
    let resp = alpaca.getQuotesV2("AAPL", {
      start: "2021-02-08",
      end: "2021-02-10",
      limit: 4,
    });
    const quotes = [];

    for await (let q of resp) {
      quotes.push(q);
    }

    expect(quotes.length).equal(4);
    assertQuote(quotes[0]);
  });

  it("get quotes without limit", async () => {
    let resp = alpaca.getQuotesV2("AAPL", {
      start: "2021-02-08",
      end: "2021-02-10",
    });
    const quotes = [];

    for await (let q of resp) {
      quotes.push(q);
    }

    expect(quotes.length).equal(10);
    assertQuote(quotes[0]);
  });

  it("get bars", async () => {
    let resp = alpaca.getBarsV2("AAPL", {
      start: "2021-02-01",
      end: "2021-02-10",
      limit: 2,
      timeframe: alpaca.newTimeframe(1, alpaca.timeframeUnit.DAY),
      adjustment: alpaca.adjustment.RAW,
    });
    const bars = [];

    for await (let b of resp) {
      bars.push(b);
    }

    expect(bars.length).equal(2);
    assertBar(bars[0]);
  });

  it("get latest AAPL trade", async () => {
    const resp = await alpaca.getLatestTrade("AAPL");

    assertTrade(resp);
  });

  it("get last FB quote", async () => {
    const resp = await alpaca.getLatestQuote("FB");

    assertQuote(resp);
  });

  it("get snapshot for one symbol", async () => {
    const resp = await alpaca.getSnapshot("AAPL");

    assertSnapshot(resp);
  });

  it("get snapashots for symbols", async () => {
    const resp = await alpaca.getSnapshots(["FB", "AAPL"]);

    expect(resp.length).equal(2);
    resp.map((s) => {
      assertSnapshot(s);
    });
  });

  it("get multi trades with wrong symbols param", async () => {
    await expect(
      alpaca.getMultiTradesV2("", {
        start: "2021-09-01T00:00:00.00Z",
        end: "2021-09-02T22:00:00Z",
      })
    ).to.eventually.be.rejectedWith("symbols.join is not a function");
  });

  it("get multi trades", async () => {
    const resp = await alpaca.getMultiTradesV2(["AAPL", "FB"], {
      start: "2021-09-01T00:00:00.00Z",
      end: "2021-09-02T22:00:00Z",
    });
    let gotSymbols = [];
    for (let [symbol, trade] of resp) {
      gotSymbols.push(symbol);
      assertTrade(trade[0], ["Symbol", ...tradeKeys]);
    }
    expect(gotSymbols.length).to.equal(2);
  });

  it("get multi trades async", async () => {
    const resp = alpaca.getMultiTradesAsyncV2(["AAPL", "FB"], {
      start: "2021-09-01T00:00:00.00Z",
      end: "2021-09-02T22:00:00Z",
    });
    let gotSymbols = new Map();
    for await (let t of resp) {
      gotSymbols.set(t.Symbol, {});
      assertTrade(t, ["Symbol", ...tradeKeys]);
    }
    expect(gotSymbols.size).to.equal(2);
  });

  it("get multi quotes async", async () => {
    const resp = alpaca.getMultiQuotesAsyncV2(["AAPL", "FB"], {
      start: "2021-08-11T08:30:00.00Z",
      end: "2021-09-12T16:00:00Z",
    });
    let gotSymbols = new Map();
    for await (let q of resp) {
      gotSymbols.set(q.Symbol, {});
      assertQuote(q, ["Symbol", ...quoteKeys]);
    }
    expect(gotSymbols.size).to.equal(2);
  });

  it("get multi latest trades", async () => {
    const resp = await alpaca.getLatestTrades(["AAPL", "FB"], alpaca.configuration);

    expect(resp.size).equal(2);
    for (const [s, t] of resp) {
      assertTrade(t, ["Symbol", ...tradeKeys]);
    }
  });

  it("get multi latest bars", async () => {
    const resp = await alpaca.getLatestBars(["SPY"], alpaca.configuration);

    expect(resp.size).equal(1);
    assertBar(resp.get("SPY"), ["Symbol", ...barKeys]);
  });
});

const cryptoTradeKeys = ["Timestamp", "Price", "Size", "TakerSide", "ID"];

const cryptoQuoteKeys = ["Timestamp", "BidPrice", "BidSize", "AskPrice", "AskSize"];

const cryptoBarKeys = [
  "Timestamp",
  "Open",
  "High",
  "Low",
  "Close",
  "Volume",
  "VWAP",
  "TradeCount",
];

const cryptoOrderbookKeys = ["Timestamp", "Bids", "Asks"];

function assertCryptoTrade(trade, keys = cryptoTradeKeys) {
  expect(trade).to.have.all.keys(keys);
}

function assertCryptoQuote(quote, keys = cryptoQuoteKeys) {
  expect(quote).to.have.all.keys(keys);
}

function assertCryptoBar(bar, keys = cryptoBarKeys) {
  expect(bar).to.have.all.keys(keys);
}

function assertCryptoSnapshot(snapshot) {
  expect(snapshot).to.have.all.keys([
    "LatestTrade",
    "LatestQuote",
    "MinuteBar",
    "DailyBar",
    "PrevDailyBar",
  ]);
  assertCryptoTrade(snapshot.LatestTrade);
  assertCryptoQuote(snapshot.LatestQuote);
  assertCryptoBar(snapshot.MinuteBar);
  assertCryptoBar(snapshot.DailyBar);
  assertCryptoBar(snapshot.PrevDailyBar);
}

function assertCryptoOrderbook(orderbook, keys = cryptoOrderbookKeys) {
  expect(orderbook).to.have.all.keys(keys);
}

describe("crypto data", () => {
  let alpaca;

  before(() => {
    alpaca = new api(mock.getConfig());
  });

  it("get latest trades", async () => {
    const resp = await alpaca.getLatestCryptoTrades(["BTC/USD", "ETH/USD"]);

    expect(resp.size).equal(2);
    for (const symbol in resp) {
      assertCryptoTrade(resp[symbol]);
    }
  });

  it("get crypto bars", async () => {
    const resp = await alpaca.getCryptoBars(["ETH/USD"], {
      timeframe: "1D",
      start: "2021-08-10",
      limit: 1,
    });

    expect(resp.size).equal(1);
    assertCryptoBar(resp.get("ETH/USD")[0]);
  });

  it("get crypto bars with exchanges", async () => {
    await expect(
      alpaca.getCryptoBars(["DOGE/USD"], {
        start: "2023-04-27",
        limit: 1,
        timeframe: "1D",
        exchanges: ["BNCU"],
      })
    ).to.eventually.be.rejectedWith(
      "code: 400, message: Unexpected query parameter(s): exchanges"
    );
  });

  it("get snapshots", async () => {
    const resp = await alpaca.getCryptoSnapshots(["BTC/USD"]);
    expect(resp.size).equal(1);
    assertCryptoSnapshot(resp.get("BTC/USD"));
  });

  it("get orderbooks", async () => {
    const resp = await alpaca.getCryptoOrderbooks(["ETH/USD", "BTC/USD"]);
    expect(resp.size).equal(2);
    assertCryptoOrderbook(resp.get("BTC/USD"));
    assertCryptoOrderbook(resp.get("ETH/USD"));
  });
});

describe("news API", () => {
  let alpaca;

  before(() => {
    alpaca = new api(mock.getConfig());
  });
  it("get news", async () => {
    const news = await alpaca.getNews({});

    expect(news.length).equal(2);
    const news1 = news[0];

    assert.equal(news1.ID, 20472678);
    assert.equal(news1.Headline, "CEO John Krafcik Leaves Waymo");
    assert.equal(news1.Author, "Bibhu Pattnaik");
    assert.equal(news1.CreatedAt, "2021-04-03T15:35:21Z");
    assert.equal(news1.Images.length, 3);
    assert.equal(news1.Symbols.length, 3);
  });

  it("get news with wrong parameters", async () => {
    await expect(
      alpaca.getNews({ symbols: ["AAPL", "GE"], totalLimit: -1 })
    ).to.eventually.be.rejectedWith("negative total limit");
  });
});
