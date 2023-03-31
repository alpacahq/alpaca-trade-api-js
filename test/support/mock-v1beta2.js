"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const joi = require("joi");
const { apiMethod, assertSchema, apiError } = require("./assertions");
const { assert } = require("console");

/**
 * This server mocks http methods from the alpaca crypto data api
 * and returns 200 if the requests are formed correctly.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createCryptoDataMock() {
  const v1beta2 = express.Router().use(bodyParser.json());

  // CRYPTO
  v1beta2.use((req, res, next) => {
    if (
      !req.get("APCA-API-KEY-ID") ||
      !req.get("APCA-API-SECRET-KEY") ||
      req.get("APCA-API-SECRET-KEY") === "invalid_secret"
    ) {
      next(apiError(401));
    }
    next();
  });

  v1beta2.get(
    "/crypto/latest/:endpoint",
    apiMethod((req) => {
      assertSchema(req.query, {
        symbols: joi.string(),
      });

      let response = {};
      response[req.params.endpoint] = {};
      response[req.params.endpoint]["BTC/USD"] = latestDataBySymbol["BTC/USD"][req.params.endpoint]["BTC/USD"];
      return response;
    })
  );

  v1beta2.get(
    "/crypto/:endpoint",
    apiMethod((req) => {
      assertSchema(req.query, {
        symbols: joi.string(),
        start: joi.string().isoDate(),
        end: joi.string().isoDate().optional(),
        limit: joi.number().integer().min(0).max(10000).optional(),
        page_token: joi.string().optional(),
        timeframe: joi.string().optional(),
      });

      let response = {};
      response[req.params.endpoint] = {};

      let limit = 3;
      if (req.query.limit) {
        limit = req.query.limit > 5 ? 5 : req.query.limit;
      }

      response[req.params.endpoint]["BTC/USD"] = 
        dataBySymbol["BTC/USD"][req.params.endpoint]["BTC/USD"];

      return response;
    })
  );

  return express.Router().use("/v1beta2", v1beta2);
};

const dataBySymbol = {
  "BTC/USD": {
    snapshots: {
      "BTC/USD": {
        DailyBar: {
          Close: 21017,
          High: 21535,
          Low: 20894,
          TradeCount: 9571,
          Open: 21472,
          Timestamp: '2022-08-22T05:00:00Z',
          Volume: 1393.8422,
          VWAP: 21220.0323071005
        },
        LatestQuote: {
          AskPrice: 21004,
          AskSize: 0.0123,
          BidPrice: 21003,
          BidSize: 0.6135,
          Timestamp: '2022-08-22T18:51:47.183948544Z'
        },
        LatestTrade: {
          ID: 40252896,
          Price: 21006,
          Size: 0.0001,
          Timestamp: '2022-08-22T18:51:44.121381Z',
          TakerSide: 'B'
        },
        MinuteBar: {
          Close: 21017,
          High: 21017,
          Low: 20981,
          TradeCount: 8,
          Open: 20981,
          Timestamp: '2022-08-22T18:50:00Z',
          Volume: 0.1201,
          VWAP: 20988.8726061615
        },
        PrevDailyBar: {
          Close: 21472,
          High: 21780,
          Low: 21072,
          TradeCount: 19605,
          Open: 21199,
          Timestamp: '2022-08-21T05:00:00Z',
          Volume: 1610.0564,
          VWAP: 21452.0743806242
        }
      }
    },
    quotes: {
      'BTC/USD':
        [
          {
            AskPrice: 40811,
            AskSize: 0.3,
            BidPrice: 40805,
            BidSize: 2.0291,
            Timestamp: '2022-04-19T00:00:00.024252416Z'
          },
          {
            AskPrice: 40811,
            AskSize: 0.3,
            BidPrice: 40805,
            BidSize: 2.0291,
            Timestamp: '2022-04-19T00:00:00.1752576Z'
          },
          {
            AskPrice: 40811,
            AskSize: 0.3,
            BidPrice: 40805,
            BidSize: 0.3,
            Timestamp: '2022-04-19T00:00:00.207202304Z'
          }
        ]
    },
  },
};

const latestDataBySymbol = {
  "BTC/USD": {
    trades: {
      'BTC/USD': {
        i: 39887309,
        p: 21386,
        s: 3.382,
        t: '2022-08-19T18:47:07.191035Z',
        tks: 'B'
      },
    },
  },
};