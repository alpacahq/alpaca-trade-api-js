"use strict";

import { expect } from "chai";
import mock from "../support/mock-server";
import Alpaca from "../../lib/alpaca-trade-api";
const alpaca = new Alpaca(mock.getConfig());

describe("clock resource", function () {
  describe("get", function () {
    it("returns valid results", function () {
      return expect(alpaca.getClock()).to.eventually.have.property("timestamp");
    });
  });
});
