'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const joi = require('joi')
const { apiMethod, assertSchema, apiError } = require('./assertions')

/**
 * This server mocks http methods from the alpaca data api
 * and returns 200 if the requests are formed correctly.
 * Some endpoints might allow you to pass "cheat code" values to trigger specific responses.
 *
 * This only exports a router, the actual server is created by mock-server.js
 */

module.exports = function createDataMock() {
  const v1 = express.Router().use(bodyParser.json())

  v1.use((req, res, next) => {
    if (
      !req.get('APCA-API-KEY-ID')
      || !req.get('APCA-API-SECRET-KEY')
      || req.get('APCA-API-SECRET-KEY') === 'invalid_secret'
    ) {
      next(apiError(401))
    }
    next()
  })

  v1.get('/bars/:timeframe', apiMethod(req => {
    assertSchema(req.params, {
      timeframe: joi.only('minute', '1Min', '5Min', '15Min', 'day', '1D')
    })
    assertSchema(req.query, {
      symbols: joi.string().regex(/^(\w+,)*(\w+)$/).required(),
      limit: joi.number().integer().min(0).max(1000).optional(),
      start: joi.string().isoDate().optional(),
      end: joi.string().isoDate().optional(),
      after: joi.string().isoDate().optional(),
      until: joi.string().isoDate().optional(),
    })
    if (req.query.start && req.query.after
      || req.query.end && req.query.until) {
      throw apiError(422)
    }
    return barsEntity
  }))

  v1.get('/aggs/ticker/:symbol/range/:multiplier/:timespan/:from/:to', apiMethod(req => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
      multiplier: joi.number().integer().required(),
      timespan: joi.only('minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'),
      from: joi.date().required(),
      to: joi.date().required(),
    })
    return aggsEntity
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

  return express.Router().use('/v1', v1)
}

const barsEntity = {
  "AAPL": [
    {
      "t": 1542952680000000000,
      "o": 172.26,
      "h": 172.3,
      "l": 172.16,
      "c": 172.18,
      "v": 3892,
    }
  ]
}

const aggsEntity = {
  "status": "success",
  "adjusted": true,
  "ticker": "AAPL",
  "queryCount": 1,
  "resultsCount": 1,
  "results": [
    {
      "o": 173.15,
      "c": 173.2,
      "l": 173.15,
      "h": 173.21,
      "v": 1800,
      "n": 4,
      "t": 1517529605000
    }
  ]
}

const lastTradeEntity = {
  "status": "success",
  "symbol": "AAPL",
  "last": {
    "price": 277.97,
    "size": 20,
    "exchange": 11,
    "cond1": 14,
    "cond2": 16,
    "cond3": 0,
    "cond4": 0,
    "timestamp": 1584197840230
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

