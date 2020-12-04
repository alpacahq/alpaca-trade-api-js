"use strict";
import { expect } from "chai";
import { toDateString } from "../../lib/utils/dateformat";

describe("date formatting", () => {
  it("formats timestamps as dates", () => {
    const date = new Date(Date.UTC(1969, 6, 20, 0, 20, 18));
    const formatted = toDateString(date);
    expect(formatted).to.equal("1969-07-20");
  });

  it("passes nil through", () => {
    expect(toDateString(null)).to.equal(null);
  });

  it("passes strings through", () => {
    expect(toDateString("2018-12-03")).to.equal("2018-12-03");
  });
});
