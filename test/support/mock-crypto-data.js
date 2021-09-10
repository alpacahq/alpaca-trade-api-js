"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const joi = require("joi");
const { apiMethod, assertSchema, apiError } = require("./assertions");

/**
 * This server mocks http methods from the alpaca crypto data api
 * and returns 200 if the requests are formed correctly.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createCryptoDataMock() {
  const v1alpha1 = express.Router().use(bodyParser.json());

  v1alpha1.use((req, res, next) => {
    if (
      !req.get("APCA-API-KEY-ID") ||
      !req.get("APCA-API-SECRET-KEY") ||
      req.get("APCA-API-SECRET-KEY") === "invalid_secret"
    ) {
      next(apiError(401));
    }
    next();
  });

  v1alpha1.get(
    "/crypto/:symbol/:endpoint",
    apiMethod((req) => {
      assertSchema(req.query, {
        start: joi.string().isoDate(),
        end: joi.string().isoDate().optional(),
        limit: joi.number().integer().min(0).max(10000).optional(),
        page_token: joi.string().optional(),
        timeframe: joi.string().optional(),
        adjustment: joi.string().optional(),
        exchanges: joi.string().optional(),
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
        response[req.params.endpoint].push(
          dataBySymbol[req.params.symbol][req.params.endpoint]
        );
      }
      return response;
    })
  );

  v1alpha1.get(
    "/crypto/:symbol/:endpoint/latest",
    apiMethod((req) => {
      if (!latestDataBySymbol[req.params.symbol]) {
        throw apiError(422);
      }
      let resp = {
        symbol: req.params.symbol,
        trade: latestDataBySymbol[req.params.symbol][req.params.endpoint],
      };
      return resp;
    })
  );

  return express.Router().use("/v1alpha1", v1alpha1);
};

const dataBySymbol = {
  BTCUSD: {
    trades: {},
    quotes: {
      symbol: "BTCUSD",
      quote: {
        t: "2021-09-10T12:09:00.827Z",
        x: "CBSE",
        bp: 46317.6,
        bs: 1.23,
        ap: 46318.09,
        as: 3.4,
      },
    },
    bars: {},
  },
};

const latestDataBySymbol = {
  BTCUSD: {
    trades: {
      symbol: "BTCUSD",
      trade: {
        t: "2021-09-10T12:24:14.739443152Z",
        x: "ERSX",
        p: 46170.9,
        s: 1.5922,
        tks: "",
        i: 0,
      },
    },
    quotes: {
      symbol: "BTCUSD",
      quotes: {
        t: "2021-08-10T05:00:53.834Z",
        x: "CBSE",
        bp: 45499.94,
        bs: 0.0328,
        ap: 45499.95,
        as: 0.00054836,
      },
    },
    xbbo: {},
  },
};
