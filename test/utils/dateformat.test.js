"use strict";

const expect = require("chai").expect;
const dateformat = require("../../dist/utils/dateformat");

describe("date formatting", () => {
  it("formats timestamps as dates", () => {
    const date = new Date(Date.UTC(1969, 6, 20, 0, 20, 18));
    const formatted = dateformat.toDateString(date);
    expect(formatted).to.equal("1969-07-20");
  });

  it("passes nil through", () => {
    expect(dateformat.toDateString(null)).to.equal(null);
  });

  it("passes strings through", () => {
    expect(dateformat.toDateString("2018-12-03")).to.equal("2018-12-03");
  });
});
