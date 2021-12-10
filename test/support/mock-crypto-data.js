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
  const v1beta1 = express.Router().use(bodyParser.json());

  v1beta1.use((req, res, next) => {
    if (
      !req.get("APCA-API-KEY-ID") ||
      !req.get("APCA-API-SECRET-KEY") ||
      req.get("APCA-API-SECRET-KEY") === "invalid_secret"
    ) {
      next(apiError(401));
    }
    next();
  });

  v1beta1.get(
    "/crypto/:symbol/snapshot",
    apiMethod((req) => {
      if (req.params.symbol == null || req.query.exchange == null) {
        throw apiError(422);
      }
      return { ...snapshots[req.params.symbol][req.query.exchange] };
    })
  );

  v1beta1.get(
    "/crypto/:symbol/:endpoint",
    apiMethod((req) => {
      assertSchema(req.query, {
        start: joi.string().isoDate(),
        end: joi.string().isoDate().optional(),
        limit: joi.number().integer().min(0).max(10000).optional(),
        page_token: joi.string().optional(),
        timeframe: joi.string().optional(),
        adjustment: joi.string().optional(),
        exchanges: joi.array().optional(),
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

  v1beta1.get(
    "/crypto/:symbol/:endpoint/latest",
    apiMethod((req) => {
      if (!latestDataBySymbol[req.params.symbol]) {
        throw apiError(422);
      }
      let resp = {
        ...latestDataBySymbol[req.params.symbol][req.params.endpoint],
      };
      return resp;
    })
  );

  return express.Router().use("/v1beta1", v1beta1);
};

const dataBySymbol = {
  BTCUSD: {
    trades: {},
    quotes: {
      t: "2021-09-10T12:09:00.827Z",
      x: "CBSE",
      bp: 46317.6,
      bs: 1.23,
      ap: 46318.09,
      as: 3.4,
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
    xbbo: {
      symbol: "BTCUSD",
      xbbo: {
        t: "2021-09-13T11:16:42.712Z",
        ax: "ERSX",
        ap: 44720.38,
        as: 1.6939,
        bx: "ERSX",
        bp: 43813.34,
        bs: 1.3855,
      },
    },
  },
};

const snapshots = {
  BTCUSD: {
    ERSX: {
      symbol: "BTCUSD",
      latestTrade: {
          t: "2021-12-09T15:07:13.573434454Z",
          x: "ERSX",
          p: 48714.5,
          s: 0.0205,
          tks: "B",
          i: 0
      },
      latestQuote: {
          t: "2021-12-09T15:08:33.405330416Z",
          x: "ERSX",
          bp: 48738.9,
          bs: 1.5388,
          ap: 48759,
          as: 1.5382
      },
      minuteBar: {
          t: "2021-12-09T15:07:00Z",
          x: "ERSX",
          o: 48714.5,
          h: 48714.5,
          l: 48714.5,
          c: 48714.5,
          v: 0.0205,
          n: 1,
          vw: 48714.5
      },
      dailyBar: {
          t: "2021-12-09T06:00:00Z",
          x: "ERSX",
          o: 49838,
          h: 50310.5,
          l: 48361.3,
          c: 48714.5,
          v: 305.0539,
          n: 215,
          vw: 49176.7255476491
      },
      prevDailyBar: {
          t: "2021-12-08T06:00:00Z",
          x: "ERSX",
          o: 50692,
          h: 51269,
          l: 48734.2,
          c: 49883.4,
          v: 481.7121,
          n: 476,
          vw: 50083.3525751792
      }
    }
  }
}
