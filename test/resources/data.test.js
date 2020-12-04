"use strict";

import { expect } from "chai";
import mock from "../support/mock-server";
import Alpaca from "../../lib/alpaca-trade-api";
const alpaca = new Alpaca(mock.getConfig());

describe("data API", function () {
  describe("get bars", function () {
    it("fetches bars", function () {
      return expect(
        alpaca.getBars("minute", ["AAPL", "XTRA"])
      ).to.eventually.have.property("AAPL");
    });

    it("fetches bars with just one symbol", function () {
      return expect(alpaca.getBars("5Min", "AAPL")).to.eventually.have.property(
        "AAPL"
      );
    });
  });

  describe("get aggregates", function () {
    it("fetches the aggregates", function () {
      return expect(
        alpaca.getAggregates("AAPL", "day", "2020-01-01", "2020-01-05")
      ).to.eventually.have.property("queryCount");
    });
  });

  describe("get last trade", function () {
    it("fetches last trade", function () {
      return expect(alpaca.lastTrade("AAPL")).to.eventually.have.property(
        "last"
      );
    });
  });

  describe("get last quote", function () {
    it("fetches last quote", function () {
      return expect(alpaca.lastQuote("AAPL")).to.eventually.have.property(
        "last"
      );
    });
  });
});
