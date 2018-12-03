'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const joi = require('joi')
const { apiMethod, assertSchema, apiError } = require('./assertions')

/**
 * This server mocks http methods from the polygon api and returns 200 if the requests are formed correctly.
 * Some endpoints might allow you to pass "cheat code" values to trigger specific responses.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createPolygonMock() {
  const v1 = express.Router().use(bodyParser.json())

  v1.use((req, res, next) => {
    if (!req.query.apiKey) {
      next(apiError(401))
    }
    next()
  })

  const validSymbolSortParams = Object.keys(symbolEntity)
    .map(key => `-${key}`)
    .concat(Object.keys(symbolEntity))

  v1.get('/meta/symbols', apiMethod(req => {
    assertSchema(req.query, {
      sort: joi.only(validSymbolSortParams).required(),
      type: joi.only('etp', 'cs').required(),
      perpage: joi.number().integer().positive().max(50).required(),
      page: joi.number().integer().positive().required(),
      isOTC: joi.boolean().required(),
    }, { allowUnknown: true })
    return [symbolEntity]
  }))

  function makeSymbolEndpoint (name, entity) {
    const path = '/meta/symbols/:symbol' + (name ? `/${name}` : '')
    v1.get(path, apiMethod(req => {
      assertSchema(req.params, {
        symbol: joi.string().required()
      })
      if (req.params.symbol === 'FAKE') throw apiError(404)
      return entity
    }))
  }

  makeSymbolEndpoint(null, symbolDetailsEntity)
  makeSymbolEndpoint('company', symbolCompanyEntity)
  makeSymbolEndpoint('analysts', symbolAnalystsEntity)
  makeSymbolEndpoint('dividends', [symbolDividendEntity])
  makeSymbolEndpoint('splits', [symbolSplitEntity])
  makeSymbolEndpoint('earnings', [symbolEarningEntity])
  makeSymbolEndpoint('financials', [symbolFinanceEntity])
  makeSymbolEndpoint('news', [symbolNewsEntity])

  v1.get('/marketstatus/now', apiMethod(() => marketStatusEntity))
  v1.get('/marketstatus/upcoming', apiMethod(() => [holidayEntity]))
  v1.get('/meta/exchanges', apiMethod(() => [exchangeEntity]))
  v1.get('/meta/symbol-types', apiMethod(() => symbolTypeMapEntity))

  v1.get('/historic/trades/:symbol/:date', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      date: joi.date().required(),
    })
    assertSchema(req.query, {
      offset: joi.number().integer().positive().required(),
      limit: joi.number().integer().positive().max(50000).required(),
    }, { allowUnknown: true })
    return historicTradesEntity
  }))

  v1.get('/historic/quotes/:symbol/:date', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      date: joi.date().required(),
    })
    assertSchema(req.query, {
      offset: joi.number().integer().positive().required(),
      limit: joi.number().integer().positive().max(50000).required(),
    }, { allowUnknown: true })
    return historicQuotesEntity
  }))

  v1.get('/historic/agg/:size/:symbol', apiMethod(req => {
    assertSchema(req.params, {
      size: joi.only('day', 'minute'),
      symbol: joi.string().required(),
    })
    assertSchema(req.query, {
      from: joi.date().required(),
      to: joi.date().required(),
      limit: joi.number().integer().positive().max(50000).required(),
      unadjusted: joi.boolean().required(),
    }, { allowUnknown: true })
    return historicAggregatesEntity
  }))

  v1.get('/last/stocks/:symbol', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
    })
    return lastTradeEntity
  }))

  v1.get('/last_quote/stocks/:symbol', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
    })
    return lastQuoteEntity
  }))

  v1.get('/open-close/:symbol/:date', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      date: joi.date().required(),
    })
    return openCloseEntity
  }))

  v1.get('/meta/conditions/:ticktype', apiMethod(req => {
    assertSchema(req.params, {
      ticktype: joi.only('trades', 'quotes')
    })
    return conditionMapEntity
  }))

  v1.use(apiMethod(() => {
    throw apiError(404, 'route not found')
  }))

  return express.Router().use('/v1', v1)
}

const symbolEntity = {
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "type": "cs",
  "isOTC": false,
  "updated": "2018-02-05T05:21:28.437Z",
  "url": "https://api.polygon.io/v1/meta/symbols/AAPL"
}

const symbolDetailsEntity = {
  "symbol": {
    "symbol": "AAPL",
    "name": "Apple Inc",
    "type": "cs",
    "url": "https://api.polygon.io/v1/meta/symbols/AAPL",
    "updated": "2018-11-30T19:34:47.897Z",
    "isOTC": true
  },
  "endpoints": {
    "company": "https://api.polygon.io/v1/meta/symbols/AAPL/company",
    "analysts": "http://localhost:8060/v1/meta/symbols/AAPL/analysts",
    "dividends": "http://localhost:8060/v1/meta/symbols/AAPL/dividends",
    "splits": "http://localhost:8060/v1/meta/symbols/AAPL/splits",
    "news": "https://api.polygon.io/v1/meta/symbols/AAPL/news"
  }
}

const symbolCompanyEntity = {
  "logo": "https://s3.polygon.io/logos/aapl/logo.png",
  "exchange": "Nasdaq Global Select",
  "name": "Apple Inc.",
  "symbol": "AAPL",
  "listdate": "2018-11-30",
  "cik": "0000320193",
  "bloomberg": "EQ0010169500001000",
  "figi": "string",
  "lei": "HWUPKR0MPOU8FGXBT394",
  "sic": 3571,
  "country": "us",
  "industry": "Computer Hardware",
  "sector": "Technology",
  "marketcap": 815604985500,
  "employees": 116000,
  "phone": "(408) 996-1010",
  "ceo": "Tim Cook",
  "url": "http://www.apple.com",
  "description": "Apple Inc. designs, manufactures, and markets mobile communication and media devices, personal computers, and portable digital music players to consumers...\n",
  "similar": [
    "MSFT",
    "IBM",
    "GOOGL"
  ],
  "tags": [
    "Technology",
    "Consumer Electronics",
    "Computer Hardware"
  ],
  "updated": "2018-11-30T19:34:47.901Z"
}

const symbolAnalystsEntity = {
  "symbol": "AAPL",
  "analysts": 27,
  "change": -0.04,
  "strongBuy": {
    "current": 0,
    "month1": 1,
    "month2": 3,
    "month3": 4,
    "month4": 3,
    "month5": 2
  },
  "buy": {
    "current": 0,
    "month1": 1,
    "month2": 3,
    "month3": 4,
    "month4": 3,
    "month5": 2
  },
  "hold": {
    "current": 0,
    "month1": 1,
    "month2": 3,
    "month3": 4,
    "month4": 3,
    "month5": 2
  },
  "sell": {
    "current": 0,
    "month1": 1,
    "month2": 3,
    "month3": 4,
    "month4": 3,
    "month5": 2
  },
  "strongSell": {
    "current": 0,
    "month1": 1,
    "month2": 3,
    "month3": 4,
    "month4": 3,
    "month5": 2
  },
  "updated": "11/10/2018"
}

const symbolDividendEntity = {
  "symbol": "AAPL",
  "type": "Dividend income",
  "exDate": "2016-11-03T04:00:00.000Z",
  "paymentDate": "2016-11-03T04:00:00.000Z",
  "recordDate": "2016-11-03T04:00:00.000Z",
  "declaredDate": "2016-11-03T04:00:00.000Z",
  "amount": 0.57,
  "qualified": "Q",
  "flag": "YE"
}

const symbolSplitEntity = {
  "symbol": "AAPL",
  "exDate": "2016-11-03T04:00:00.000Z",
  "paymentDate": "2016-11-03T04:00:00.000Z",
  "recordDate": "2016-11-03T04:00:00.000Z",
  "declaredDate": "2016-11-03T04:00:00.000Z",
  "ratio": 0.142857,
  "tofactor": 7,
  "forfactor": 1
}

const symbolEarningEntity = {
  "symbol": "AAPL",
  "EPSReportDate": "2018-02-01T00:00:00.000Z",
  "EPSReportDateStr": "2018-02-01",
  "fiscalPeriod": "Q1 2018",
  "fiscalEndDate": "2017-12-31T00:00:00.000Z",
  "actualEPS": 3.89,
  "consensusEPS": 3.82,
  "estimatedEPS": 3.82,
  "announceTime": "AMC",
  "numberOfEstimates": 9,
  "EPSSurpriseDollar": 0.07,
  "yearAgo": 3.36,
  "yearAgoChangePercent": 16,
  "estimatedChangePercent": 14
}

const symbolFinanceEntity = {
  "symbol": "AAPL",
  "reportDate": "2017-12-31T00:00:00.000Z",
  "reportDateStr": "2017-12-31",
  "grossProfit": 33912000000,
  "costOfRevenue": 54381000000,
  "operatingRevenue": 88293000000,
  "totalRevenue": 88293000000,
  "operatingIncome": 26274000000,
  "netIncome": 20065000000,
  "researchAndDevelopment": 3407000000,
  "operatingExpense": 7638000000,
  "currentAssets": 143810000000,
  "totalAssets": 406794000000,
  "totalLiabilities": 266595000000,
  "currentCash": 27491000000,
  "currentDebt": 18478000000,
  "totalCash": 77153000000,
  "totalDebt": 122400000000,
  "shareholderEquity": 140199000000,
  "cashChange": 7202000000,
  "cashFlow": 28293000000,
  "operatingGainsLosses": 0
}

const symbolNewsEntity = {
  "symbols": [
    "MSFT",
    "AAPL",
    "IBM"
  ],
  "title": "Goldman in talks to finance iPhones - WSJ",
  "url": "https://seekingalpha.com/news/3328826-goldman-talks-finance-iphones-wsj",
  "source": "SeekingAlpha",
  "summary": "Continuing its push into more traditional areas of consumer finance, Goldman Sachs (NYSE:GS) is reportedly in talks with Apple (NASDAQ:AAPL) to finance iPhone purchases.Buyers theoretically would be a...",
  "image": "https://static.seekingalpha.com/assets/og_image_410-b8960ce31ec84f7f12dba11a09fc1849b69b234e0f5f39d7c62f46f8692e58a5.png",
  "timestamp": "2018-02-07T12:48:47.000Z",
  "keywords": [
    "financial services",
    "aapl",
    "investing",
    "bsiness news",
    "mobile"
  ]
}

const marketStatusEntity = {
  "market": "open",
  "serverTime": "2018-07-19T08:51:07-04:00",
  "exchanges": {
    "nyse": "open",
    "nasdaq": "open",
    "otc": "extended-hours"
  },
  "currencies": {
    "fx": "open",
    "crypto": "open"
  }
}

const holidayEntity = {
  "exchange": "NYSE",
  "name": "Thanksgiving Day",
  "status": "early-close",
  "date": "2018-11-23T00:00:00.000Z",
  "open": "2018-11-23T09:30:00.000Z",
  "close": "2018-11-23T13:00:00.000Z"
}

const exchangeEntity = {
  "id": 1,
  "type": "exchange",
  "market": "equities",
  "mic": "XASE",
  "name": "NYSE American (AMEX)",
  "tape": "A"
}

const symbolTypeMapEntity = {
  "cs": "Common Stock",
  "adr": "American Depository Receipt",
  "cef": "Closed-End Fund",
  "etp": "Exchange Traded Product",
  "reit": "Real Estate Investment Trust",
  "mlp": "Master Limited Partnership",
  "wrt": "Equity WRT",
  "pub": "Public",
  "nyrs": "New York Registry Shares",
  "unit": "Unit",
  "right": "Right",
  "trak": "Tracking stock or targeted stock",
  "ltdp": "Limited Partnership",
  "rylt": "Royalty Trust",
  "mf": "Mutual Fund",
  "pfd": "Preferred Stock"
}

const historicTradesEntity = {
  "day": "2018-2-2",
  "map": {
    "c1": "condition1",
    "c2": "condition2",
    "c3": "condition3",
    "c4": "condition4",
    "e": "exchange",
    "p": "price",
    "s": "size",
    "t": "timestamp"
  },
  "msLatency": 8,
  "status": "success",
  "symbol": "AAPL",
  "ticks": [
    {
      "c1": 14,
      "c2": 12,
      "c3": 0,
      "c4": 0,
      "e": 12,
      "p": 172.17,
      "s": 50,
      "t": 1517529601006
    }
  ]
}

const historicQuotesEntity = {
  "day": "2018-2-2",
  "map": {
    "aE": "askexchange",
    "aP": "askprice",
    "aS": "asksize",
    "bE": "bidexchange",
    "bP": "bidprice",
    "bS": "bidsize",
    "c": "condition",
    "t": "timestamp"
  },
  "msLatency": 3,
  "status": "success",
  "symbol": "AAPL",
  "ticks": [
    {
      "c": 0,
      "bE": 11,
      "aE": 12,
      "aP": 173.15,
      "bP": 173.13,
      "bS": 25,
      "aS": 55,
      "t": 1517529601006
    }
  ]
}

const historicAggregatesEntity = {
  "map": {
    "a": "average",
    "c": "close",
    "h": "high",
    "k": "transactions",
    "l": "low",
    "o": "open",
    "t": "timestamp",
    "v": "volume"
  },
  "status": "success",
  "aggType": "second",
  "symbol": "AAPL",
  "ticks": [
    {
      "o": 173.15,
      "c": 173.2,
      "l": 173.15,
      "h": 173.21,
      "v": 1800,
      "k": 4,
      "t": 1517529605000
    }
  ]
}

const lastTradeEntity = {
  "status": "success",
  "symbol": "AAPL",
  "last": {
    "price": 159.59,
    "size": 20,
    "exchange": 11,
    "cond1": 14,
    "cond2": 16,
    "cond3": 0,
    "cond4": 0,
    "timestamp": 1518086464720
  }
}

const lastQuoteEntity = {
  "status": "success",
  "symbol": "AAPL",
  "last": {
    "askprice": 159.59,
    "asksize": 2,
    "askexchange": 11,
    "bidprice": 159.45,
    "bidsize": 20,
    "bidexchange": 12,
    "timestamp": 1518086601843
  }
}

const openCloseEntity = {
  "symbol": "AAPL",
  "open": {
    "condition1": 14,
    "condition2": 12,
    "condition3": 0,
    "condition4": 0,
    "exchange": 12,
    "price": 172.17,
    "size": 50,
    "timestamp": "2018-03-05T14:30:00.080Z"
  },
  "close": {
    "condition1": 14,
    "condition2": 12,
    "condition3": 0,
    "condition4": 0,
    "exchange": 12,
    "price": 172.17,
    "size": 50,
    "timestamp": "2018-03-05T14:30:00.080Z"
  },
  "afterHours": {
    "condition1": 14,
    "condition2": 12,
    "condition3": 0,
    "condition4": 0,
    "exchange": 12,
    "price": 172.17,
    "size": 50,
    "timestamp": "2018-03-05T14:30:00.080Z"
  }
}

const conditionMapEntity = {
  "1": "Regular",
  "2": "Acquisition",
  "3": "AveragePrice",
  "4": "AutomaticExecution"
}
