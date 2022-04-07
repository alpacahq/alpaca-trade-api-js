"use strict";

const expect = require("chai").expect;
const { isEqual } = require("lodash");
const entityV2 = require("../../dist/resources/datav2/entityv2");

function assertData(got, expected) {
  expect(got).have.all.keys(Object.keys(expected));
  expect(isEqual(got, expected)).to.be.true;
}

describe("test convert functions", () => {
  it("test aliasObjectKey for trades", () => {
    const got = entityV2.AlpacaTradeV2(data.trade);
    assertData(got, expected.trade);
  });

  it("test aliasObjectKey for quotes", () => {
    const got = entityV2.AlpacaQuoteV2(data.quote);
    assertData(got, expected.quote);
  });

  it("test aliasObjectKey for bars", () => {
    const got = entityV2.AlpacaBarV2(data.bar);
    assertData(got, expected.bar);
  });

  it("test aliasObjectKey for snapshot", () => {
    const got = entityV2.AlpacaSnapshotV2(data.snapshot);
    assertData(got, expected.snapshot);
  });

  it("test aliasObjectKey for crypto orderbooks", () => {
    const got = entityV2.AlpacaCryptoOrderbook(data.cryptoOrderbook);
    assertData(got, expected.cryptoOrderbook);
  });
});

const data = {
  trade: {
    t: "2021-02-08T09:00:19.932405248Z",
    x: "P",
    p: 136.68,
    s: 25,
    c: ["@", "T", "I"],
    i: 55,
    z: "C",
  },
  quote: {
    t: "2021-02-08T09:02:07.837365238Z",
    ax: "P",
    ap: 136.81,
    as: 1,
    bx: "P",
    bp: 136.56,
    bs: 2,
    c: ["R"],
  },
  bar: {
    t: "2021-02-08T00:00:00Z",
    o: 136.11,
    h: 134.93,
    l: 136.9,
    c: 136.81,
    v: 31491496,
  },
  snapshot: {
    symbol: "AAPL",
    latestTrade: {
      t: "2021-05-03T19:59:59.898542039Z",
      x: "V",
      p: 132.55,
      s: 100,
      c: ["@"],
      i: 12637,
      z: "C",
    },
    latestQuote: {
      t: "2021-05-03T21:00:00.006562245Z",
      ax: "V",
      ap: 0,
      as: 0,
      bx: "V",
      bp: 0,
      bs: 0,
      c: ["R"],
    },
    minuteBar: {
      t: "2021-05-03T19:59:00Z",
      o: 132.43,
      h: 132.55,
      l: 132.43,
      c: 132.55,
      v: 9736,
    },
    dailyBar: {
      t: "2021-05-03T04:00:00Z",
      o: 132.04,
      h: 134.06,
      l: 131.83,
      c: 132.55,
      v: 1364180,
    },
    prevDailyBar: {
      t: "2021-04-30T04:00:00Z",
      o: 131.8,
      h: 133.55,
      l: 131.07,
      c: 131.44,
      v: 2088793,
    },
  },
  cryptoOrderbook: {
    S: 'BTCUSD',
    x: 'ERSX',
    t: "2022-04-06T14:19:40.984Z",
    b: [ { p: 44066.1, s: 0 }, { p: 44063.4, s: 1.361635 } ],
    a: []
  },
};

const expected = {
  trade: {
    Timestamp: "2021-02-08T09:00:19.932405248Z",
    Exchange: "P",
    Price: 136.68,
    Size: 25,
    Conditions: ["@", "T", "I"],
    ID: 55,
    Tape: "C",
  },
  quote: {
    Timestamp: "2021-02-08T09:02:07.837365238Z",
    AskExchange: "P",
    AskPrice: 136.81,
    AskSize: 1,
    BidExchange: "P",
    BidPrice: 136.56,
    BidSize: 2,
    Conditions: ["R"],
  },
  bar: {
    Timestamp: "2021-02-08T00:00:00Z",
    OpenPrice: 136.11,
    HighPrice: 134.93,
    LowPrice: 136.9,
    ClosePrice: 136.81,
    Volume: 31491496,
  },
  snapshot: {
    symbol: "AAPL",
    LatestTrade: {
      Timestamp: "2021-05-03T19:59:59.898542039Z",
      Exchange: "V",
      Price: 132.55,
      Size: 100,
      Conditions: ["@"],
      ID: 12637,
      Tape: "C",
    },
    LatestQuote: {
      Timestamp: "2021-05-03T21:00:00.006562245Z",
      AskExchange: "V",
      AskPrice: 0,
      AskSize: 0,
      BidExchange: "V",
      BidPrice: 0,
      BidSize: 0,
      Conditions: ["R"],
    },
    MinuteBar: {
      Timestamp: "2021-05-03T19:59:00Z",
      OpenPrice: 132.43,
      HighPrice: 132.55,
      LowPrice: 132.43,
      ClosePrice: 132.55,
      Volume: 9736,
    },
    DailyBar: {
      Timestamp: "2021-05-03T04:00:00Z",
      OpenPrice: 132.04,
      HighPrice: 134.06,
      LowPrice: 131.83,
      ClosePrice: 132.55,
      Volume: 1364180,
    },
    PrevDailyBar: {
      Timestamp: "2021-04-30T04:00:00Z",
      OpenPrice: 131.8,
      HighPrice: 133.55,
      LowPrice: 131.07,
      ClosePrice: 131.44,
      Volume: 2088793,
    },
  },
  cryptoOrderbook: {
    Symbol: 'BTCUSD',
    Exchange: 'ERSX',
    Timestamp: "2022-04-06T14:19:40.984Z",
    Bids: [ { Price: 44066.1, Size: 0 }, { Price: 44063.4, Size: 1.361635 } ],
    Asks: []
  },
};
