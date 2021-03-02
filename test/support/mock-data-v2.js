"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const joi = require("joi");
const { apiMethod, assertSchema, apiError } = require("./assertions");

/**
 * This server mocks http methods from the alpaca data v2 api
 * and returns 200 if the requests are formed correctly.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createDataV2Mock() {
  const v2 = express.Router().use(bodyParser.json());

  v2.use((req, res, next) => {
    if (
      !req.get("APCA-API-KEY-ID") ||
      !req.get("APCA-API-SECRET-KEY") ||
      req.get("APCA-API-SECRET-KEY") === "invalid_secret"
    ) {
      next(apiError(401));
    }
    next();
  });

  v2.get(
    "/stocks/:symbol/:endpoint",
    apiMethod((req) => {
      assertSchema(req.query, {
        start: joi.string().isoDate(),
        end: joi.string().isoDate(),
        limit: joi.number().integer().min(0).max(10000).optional(),
        page_token: joi.string().optional(),
        timeframe: joi.string().optional(),
        adjustment: joi.string().optional(),
      });

      let response = {
        symbol: req.params.symbol,
        next_page_token: req.query.limit > 5 ? "token" : null,
      };
      response[req.params.endpoint] = [];
      let limit = 3;
      if (req.query.limit) {
        limit = req.query.limit > 5 ? 5 : req.query.limit;
      }
      for (let i = 0; i < limit; i++) {
        response[req.params.endpoint].push(symbols[req.params.endpoint]);
      }
      return response;
    })
  );

  return express.Router().use("/v2", v2);
};

const symbols = {
  trades: {
    t: "2021-02-08T09:00:19.932405248Z",
    x: "P",
    p: 136.68,
    s: 25,
    c: ["@", "T", "I"],
    i: 55,
    z: "C",
  },
  quotes: {
    t: "2021-02-08T09:02:07.837365238Z",
    ax: "P",
    ap: 136.81,
    as: 1,
    bx: "P",
    bp: 136.56,
    bs: 2,
    c: ["R"],
  },
  bars: {
    t: "2021-02-08T00:00:00Z",
    o: 136.11,
    h: 134.93,
    l: 136.9,
    c: 136.81,
    v: 31491496,
  },
};
