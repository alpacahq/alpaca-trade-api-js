"use strict";

const expect = require("chai").expect;
const mock = require("../support/mock-server");
const Alpaca = require("../../dist/alpaca-trade-api");

describe("watchlist resource", function () {
  const alpaca = new Alpaca(mock.getConfig());
  describe("getAll", function () {
    it("returns valid results with no parameters", function () {
      return expect(alpaca.getWatchlists()).to.eventually.be.an("array");
    });
  });

  describe("getOne", function () {
    it("returns a watchlist object if valid watchlist id is used", function () {
      const id = "test_watchlist_id";
      return expect(alpaca.getWatchlist(id)).to.eventually.be.an("object");
    });

    it("returns 404 error if unknown watchlist id is used", function () {
      const id = "nonexistent_watchlist_id";
      return expect(alpaca.getWatchlist(id)).to.be.rejectedWith("404");
    });
  });

  describe("addWatchlist", function () {
    it("creates a new empty watchlist", function () {
      return expect(
        alpaca.addWatchlist("Watchlist Name")
      ).to.eventually.have.property("account_id");
    });

    it("creates a new watchlist with something in in", function () {
      return expect(
        alpaca.addWatchlist("Watchlist Name", "AAPL")
      ).to.eventually.have.property("assets");
    });
  });

  describe("addToWatchlist", function () {
    it("adds a symbol to a watchlist if a valid watchlist id and valid symbol are used", function () {
      const id = "test_watchlist_id";
      return expect(
        alpaca.addToWatchlist(id, "AAPL")
      ).to.eventually.have.property("account_id");
    });

    it("returns a 404 if unknown watchlist id is used", function () {
      const id = "nonexistent_watchlist_id";
      return expect(alpaca.addToWatchlist(id, "AAPL")).to.be.rejectedWith(
        "404"
      );
    });
  });

  describe("updateWatchlist", function () {
    it("updates a watchlist name if a valid watchlist id and a name are used", function () {
      const id = "test_watchlist_id";
      return expect(
        alpaca.updateWatchlist(id, { name: "new name", symbols: "AAPL" })
      ).to.eventually.have.property("account_id");
    });

    it("updates a watchlist contents if a valid watchlist id and a symbol or list of symbols are used", function () {
      const id = "test_watchlist_id";
      return expect(
        alpaca.updateWatchlist(id, { symbols: "AAPL" })
      ).to.eventually.have.property("account_id");
    });

    it("updates a watchlist name and contents if a valid watchlist id, a name, and a symbol or list of symbols are used", function () {
      const id = "test_watchlist_id";
      return expect(
        alpaca.updateWatchlist(id, { name: "new name" })
      ).to.eventually.have.property("account_id");
    });

    it("returns a 404 if an unknown watchlist id is used", function () {
      const id = "nonexistent_watchlist_id";
      return expect(
        alpaca.updateWatchlist(id, { name: "new name", symbols: "AAPL" })
      ).to.be.rejectedWith("404");
    });
  });

  describe("deleteWatchlist", function () {
    it("deletes a watchlist if a valid watchlist id is used", function () {
      const id = "test_watchlist_id";
      return expect(alpaca.deleteWatchlist(id)).to.be.fulfilled;
    });

    it("returns a 404 if an unknown watchlist id is used", function () {
      const id = "nonexistent_watchlist_id";
      return expect(alpaca.deleteWatchlist(id)).to.be.rejectedWith("404");
    });
  });

  describe("deleteFromWatchlist", function () {
    it("deletes an asset from a watchlist if a valid watchlist id is used and the asset is in the watchlist", function () {
      const id = "test_watchlist_id";
      const symbol = "TSLA";
      return expect(
        alpaca.deleteFromWatchlist(id, symbol)
      ).to.eventually.have.property("account_id");
    });

    it("returns a 404 if an unknown watchlist id is used", function () {
      const id = "nonexistent_watchlist_id";
      const symbol = "TSLA";
      return expect(alpaca.deleteFromWatchlist(id, symbol)).to.be.rejectedWith(
        "404"
      );
    });

    it("returns a 404 if an asset not presently in the watchlist is used", function () {
      const id = "test_watchlist_id";
      const symbol = "FAKE";
      return expect(alpaca.deleteFromWatchlist(id, symbol)).to.be.rejectedWith(
        "404"
      );
    });
  });
});
