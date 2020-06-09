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
  const v2 = express.Router().use(bodyParser.json())

  v1.use((req, res, next) => {
    if (!req.query.apiKey) {
      next(apiError(401))
    }
    next()
  })

  v2.use((req, res, next) => {
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

  function makeSymbolEndpoint(name, entity) {
    const path = '/meta/symbols/:symbol' + (name ? `/${name}` : '')
    v1.get(path, apiMethod(req => {
      assertSchema(req.params, {
        symbol: joi.string().required()
      })
      if (req.params.symbol === 'FAKE') throw apiError(404)
      return entity
    }))
  }

  function makeSymbolEndpointV2(name, entity) {
    const path = '/reference' + (name ? `/${name}` : '') + '/:symbol'
    v2.get(path, apiMethod(req => {
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
  makeSymbolEndpoint('earnings', [symbolEarningEntity])
  makeSymbolEndpointV2('financials', symbolFinanceEntity)
  makeSymbolEndpoint('news', [symbolNewsEntity])
  makeSymbolEndpointV2('dividends', symbolDividendEntity)
  makeSymbolEndpointV2('splits', symbolSplitEntity)

  v1.get('/marketstatus/now', apiMethod(() => marketStatusEntity))
  v1.get('/marketstatus/upcoming', apiMethod(() => [holidayEntity]))
  v1.get('/meta/exchanges', apiMethod(() => [exchangeEntity]))
  v1.get('/meta/symbol-types', apiMethod(() => symbolTypeMapEntity))

  v2.get('/ticks/stocks/trades/:symbol/:date', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      date: joi.date().required(),
    })
    return historicTradesV2Entity
  }))

  v2.get('/ticks/stocks/nbbo/:symbol/:date', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      date: joi.date().required(),
    })
    return historicQuotesV2Entity
  }))

  v2.get('/aggs/ticker/:symbol/range/:multiplier/:size/:from/:to', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      multiplier: joi.number().integer().required(),
      size: joi.only('day', 'minute'),
      from: joi.date().required(),
      to: joi.date().required(),
    })
    assertSchema(req.query, {
      unadjusted: joi.boolean().required(),
    }, { allowUnknown: true })
    return historicAggregatesV2Entity
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

  v2.use(apiMethod(() => {
    throw apiError(404, 'route not found')
  }))

  return express.Router().use('/v1', v1).use('/v2', v2)
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
    "dividends": "http://localhost:8060/v2/reference/dividends/AAPL",
    "splits": "http://localhost:8060/v2/reference/splits/AAPL",
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
  "status": "OK",
  "count": 1,
  "results": [
    {
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
  ]
}

const symbolSplitEntity = {
  "status": "OK",
  "count": 1,
  "results": [
    {
      "ticker": "AAPL",
      "exDate": "1999-03-28",
      "paymentDate": "1999-03-28",
      "recordDate": "1999-03-28",
      "declaredDate": "1999-03-28",
      "ratio": 0.142857,
      "tofactor": 7,
      "forfactor": 1
    }
  ]
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
  "status": "OK",
  "count": 1,
  "results": [
    {
      "ticker": "AAPL",
      "period": "Q",
      "calendarDate": "2019-03-31",
      "reportPeriod": "2019-03-31",
      "updated": "1999-03-28",
      "accumulatedOtherComprehensiveIncome": 0,
      "assets": 0,
      "assetsAverage": 0,
      "assetsCurrent": 0,
      "assetTurnover": 0,
      "assetsNonCurrent": 0,
      "bookValuePerShare": 0,
      "capitalExpenditure": 0,
      "cashAndEquivalents": 0,
      "cashAndEquivalentsUSD": 0,
      "costOfRevenue": 0,
      "consolidatedIncome": 0,
      "currentRatio": 0,
      "debtToEquityRatio": 0,
      "debt": 0,
      "debtCurrent": 0,
      "debtNonCurrent": 0,
      "debtUSD": 0,
      "deferredRevenue": 0,
      "depreciationAmortizationAndAccretion": 0,
      "deposits": 0,
      "dividendYield": 0,
      "dividendsPerBasicCommonShare": 0,
      "earningBeforeInterestTaxes": 0,
      "earningsBeforeInterestTaxesDepreciationAmortization": 0,
      "EBITDAMargin": 0,
      "earningsBeforeInterestTaxesDepreciationAmortizationUSD": 0,
      "earningBeforeInterestTaxesUSD": 0,
      "earningsBeforeTax": 0,
      "earningsPerBasicShare": 0,
      "earningsPerDilutedShare": 0,
      "earningsPerBasicShareUSD": 0,
      "shareholdersEquity": 0,
      "averageEquity": 0,
      "shareholdersEquityUSD": 0,
      "enterpriseValue": 0,
      "enterpriseValueOverEBIT": 0,
      "enterpriseValueOverEBITDA": 0,
      "freeCashFlow": 0,
      "freeCashFlowPerShare": 0,
      "foreignCurrencyUSDExchangeRate": 0,
      "grossProfit": 0,
      "grossMargin": 0,
      "goodwillAndIntangibleAssets": 0,
      "interestExpense": 0,
      "investedCapital": 0,
      "investedCapitalAverage": 0,
      "inventory": 0,
      "investments": 0,
      "investmentsCurrent": 0,
      "investmentsNonCurrent": 0,
      "totalLiabilities": 0,
      "currentLiabilities": 0,
      "liabilitiesNonCurrent": 0,
      "marketCapitalization": 0,
      "netCashFlow": 0,
      "netCashFlowBusinessAcquisitionsDisposals": 0,
      "issuanceEquityShares": 0,
      "issuanceDebtSecurities": 0,
      "paymentDividendsOtherCashDistributions": 0,
      "netCashFlowFromFinancing": 0,
      "netCashFlowFromInvesting": 0,
      "netCashFlowInvestmentAcquisitionsDisposals": 0,
      "netCashFlowFromOperations": 0,
      "effectOfExchangeRateChangesOnCash": 0,
      "netIncome": 0,
      "netIncomeCommonStock": 0,
      "netIncomeCommonStockUSD": 0,
      "netLossIncomeFromDiscontinuedOperations": 0,
      "netIncomeToNonControllingInterests": 0,
      "profitMargin": 0,
      "operatingExpenses": 0,
      "operatingIncome": 0,
      "tradeAndNonTradePayables": 0,
      "payoutRatio": 0,
      "priceToBookValue": 0,
      "priceEarnings": 0,
      "priceToEarningsRatio": 0,
      "propertyPlantEquipmentNet": 0,
      "preferredDividendsIncomeStatementImpact": 0,
      "sharePriceAdjustedClose": 0,
      "priceSales": 0,
      "priceToSalesRatio": 0,
      "tradeAndNonTradeReceivables": 0,
      "accumulatedRetainedEarningsDeficit": 0,
      "revenues": 0,
      "revenuesUSD": 0,
      "researchAndDevelopmentExpense": 0,
      "returnOnAverageAssets": 0,
      "returnOnAverageEquity": 0,
      "returnOnInvestedCapital": 0,
      "returnOnSales": 0,
      "shareBasedCompensation": 0,
      "sellingGeneralAndAdministrativeExpense": 0,
      "shareFactor": 0,
      "shares": 0,
      "weightedAverageShares": 0,
      "weightedAverageSharesDiluted": 0,
      "salesPerShare": 0,
      "tangibleAssetValue": 0,
      "taxAssets": 0,
      "incomeTaxExpense": 0,
      "taxLiabilities": 0,
      "tangibleAssetsBookValuePerShare": 0,
      "workingCapital": 0
    }
  ]
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

const historicTradesV2Entity = {
  "results_count": 10,
  "db_latency": 2,
  "success": true,
  "ticker": "AAPL",
  "results": [
    {
      "T": "AAPL",
      "t": 1547787608999125800,
      "y": 1547787608999125800,
      "f": 1547787608999125800,
      "q": 23547,
      "i": "00MGON",
      "x": 11,
      "s": 100,
      "c": [
        {}
      ],
      "p": 223.001,
      "z": 1
    }
  ]
}

const historicQuotesV2Entity = {
  "results_count": 10,
  "db_latency": 2,
  "success": true,
  "ticker": "AAPL",
  "results": [
    {
      "T": "AAPL",
      "t": 1547787608999125800,
      "y": 1547787608999125800,
      "f": 1547787608999125800,
      "q": 23547,
      "c": [
        {}
      ],
      "i": [
        {}
      ],
      "p": 223.001,
      "x": 11,
      "s": 100,
      "P": 223.001,
      "X": 11,
      "S": 100,
      "z": 1
    }
  ]
}

const historicAggregatesV2Entity = {
  "ticker": "AAPL",
  "status": "OK",
  "adjusted": true,
  "queryCount": 55,
  "resultsCount": 2,
  "results": [
    {
      "T": "AAPL",
      "v": 31315282,
      "o": 102.87,
      "c": 103.74,
      "h": 103.82,
      "l": 102.65,
      "t": 1549314000000,
      "n": 4
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
