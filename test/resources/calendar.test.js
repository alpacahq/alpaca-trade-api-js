"use strict";

import { expect } from "chai";
import mock from "../support/mock-server";
import Alpaca from "../../lib/alpaca-trade-api";
const alpaca = new Alpaca(mock.getConfig());

describe("calendar resource", function () {
  describe("get", function () {
    it("returns valid results without a parameter", function () {
      return expect(alpaca.getCalendar()).to.eventually.be.an("array");
    });

    it("returns valid results with `start` parameter", function () {
      return expect(
        alpaca.getCalendar({ start: "2018-01-01" })
      ).to.eventually.be.an("array");
    });

    it("returns valid results with `end` parameter", function () {
      return expect(
        alpaca.getCalendar({ end: "2018-01-01" })
      ).to.eventually.be.an("array");
    });

    it("returns valid results with both parameters", function () {
      return expect(
        alpaca.getCalendar({
          start: new Date("July 20, 69 00:20:18"),
          end: new Date("2018-01-01"),
        })
      ).to.eventually.be.an("array");
    });
  });
});
