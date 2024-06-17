"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const joi = require("joi");
const { apiMethod, assertSchema } = require("./assertions");
const { assert } = require("console");

/**
 * This server mocks http methods from the alpaca crypto and option data api
 * and returns 200 if the requests are formed correctly.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createV1Beta1DataMock() {
  const v1beta1 = express.Router().use(bodyParser.json());

  v1beta1.get(
    "/news",
    apiMethod((req) => {
      assertSchema(req.query, {
        symbols: joi.string(),
        start: joi.string().isoDate().optional(),
        end: joi.string().isoDate().optional(),
        limit: joi.number().integer().min(0).max(50).optional(),
        page_token: joi.string().optional(),
        sort: joi.string().optional(),
        includeContent: joi.bool().optional(),
        excludeContentless: joi.bool().optional(),
      });

      let resp = { news: [], next_page_token: null };

      news.forEach((n) => resp.news.push(n));
      return resp;
    })
  );

  v1beta1.get(
    "/options/bars",
    apiMethod((req) => {
      assertSchema(req.query, {
        symbols: joi.string(),
        start: joi.string().isoDate().optional(),
        end: joi.string().isoDate().optional(),
        timeframe: joi.string(),
        limit: joi.number().integer().optional(),
        page_token: joi.string().optional(),
      });

      let resp = {
        bars: { AAPL240419P00140000: [options.bars["AAPL240419P00140000"]] },
        next_page_token: null,
      };
      return resp;
    })
  );

  v1beta1.get(
    "/options/snapshots/:underlying_symbol",
    apiMethod((req) => {
      assertSchema(req.query, {
        feed: joi.string().optional(),
        type: joi.string().optional(),
        pageLimit: joi.number().integer().optional(),
        limit: joi.number().integer().optional(),
        strike_price_gte: joi.number().optional(),
        strike_price_lte: joi.number().optional(),
        expiration_date: joi.string().optional(),
        expiration_date_gte: joi.string().optional(),
        expiration_date_lte: joi.string().optional(),
        root_symbol: joi.string().optional(),
        page_token: joi.string().optional(),
      });
      let resp = {
        snapshots: { AAPL240426C00162500: options.snapshots["AAPL240426C00162500"] },
        next_page_token: null,
      };
      return resp;
    })
  );

  return express.Router().use("/v1beta1", v1beta1);
};

const news = [
  {
    id: 20472678,
    headline: "CEO John Krafcik Leaves Waymo",
    author: "Bibhu Pattnaik",
    created_at: "2021-04-03T15:35:21Z",
    updated_at: "2021-04-03T15:35:21Z",
    summary:
      "Waymo\u0026#39;s chief technology officer and its chief operating officer will serve as co-CEOs.",
    url: "https://www.benzinga.com/news/21/04/20472678/ceo-john-krafcik-leaves-waymo",
    images: [
      {
        size: "large",
        url: "https://cdn.benzinga.com/files/imagecache/2048x1536xUP/images/story/2012/waymo_2.jpeg",
      },
      {
        size: "small",
        url: "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2012/waymo_2.jpeg",
      },
      {
        size: "thumb",
        url: "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2012/waymo_2.jpeg",
      },
    ],
    symbols: ["GOOG", "GOOGL", "TSLA"],
  },
  {
    id: 20472512,
    headline:
      "Benzinga's Bulls And Bears Of The Week: Apple, GM, JetBlue, Lululemon, Tesla And More",
    author: "Nelson Hem",
    created_at: "2021-04-03T15:20:12Z",
    updated_at: "2021-04-03T15:20:12Z",
    summary:
      "\n\tBenzinga has examined the prospects for many investor favorite stocks over the past week. \n\tThe past week\u0026#39;s bullish calls included airlines, Chinese EV makers and a consumer electronics giant.\n",
    url: "https://www.benzinga.com/trading-ideas/long-ideas/21/04/20472512/benzingas-bulls-and-bears-of-the-week-apple-gm-jetblue-lululemon-tesla-and-more",
    images: [
      {
        size: "large",
        url: "https://cdn.benzinga.com/files/imagecache/2048x1536xUP/images/story/2012/pexels-burst-373912_0.jpg",
      },
      {
        size: "small",
        url: "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2012/pexels-burst-373912_0.jpg",
      },
      {
        size: "thumb",
        url: "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2012/pexels-burst-373912_0.jpg",
      },
    ],
    symbols: [
      "AAPL",
      "ARKX",
      "BMY",
      "CS",
      "GM",
      "JBLU",
      "JCI",
      "LULU",
      "NIO",
      "TSLA",
      "XPEV",
    ],
  },
];

const options = {
  bars: {
    AAPL240419P00140000: {
      t: "2024-01-18T05:00:00Z",
      o: 0.38,
      h: 0.38,
      l: 0.34,
      c: 0.34,
      v: 12,
      n: 7,
      vw: 0.3525,
    },
  },
  snapshots: {
    AAPL240426C00162500: {
      greeks: {
        delta: 0.7521304109871954,
        gamma: 0.06241426404871288,
        rho: 0.009910739032549095,
        theta: -0.2847623059595503,
        vega: 0.047540520834498785,
      },
      impliedVolatility: 0.3372405712050441,
      latestQuote: {
        ap: 4.3,
        as: 91,
        ax: "B",
        bp: 4.15,
        bs: 16,
        bx: "C",
        c: "A",
        t: "2024-04-22T19:59:59.992734208Z",
      },
      latestTrade: {
        c: "I",
        p: 4.1,
        s: 1,
        t: "2024-04-22T19:57:32.589554432Z",
        x: "A",
      },
    },
  },
};
