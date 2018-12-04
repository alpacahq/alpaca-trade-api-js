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

