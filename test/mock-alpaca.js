const express = require('express')
const bodyParser = require('body-parser')
const joi = require('joi')

/**
 * This server mocks http methods from the alpaca api and returns 200 if the requests are formed correctly.
 * Some endpoints might allow you to pass "cheat code" values to trigger specific responses.
 */

const PORT = process.env.TEST_PORT || 3333

function createAlpacaMock({ port = PORT } = {}) {
  const app = express().use(bodyParser.json())
  const v1 = express.Router()
  app.use('/v1', v1)

  v1.get('/account', method((req, res) => {
    res.status(200).json(accountEntity)
  }))

  v1.get('/orders', validateRequest(
    'query',
    {
      status: joi.string().optional().allow('open', 'closed', 'all'),
      limit: joi.number().optional().integer().positive().max(500),
      after: joi.string().isoDate().optional(),
      until: joi.string().isoDate().optional(),
      direction: joi.string().optional().allow('asc', 'desc'),
    },
    [orderEntity],
  ))

  v1.get('/orders/:id', method((req, res) => {
    if (req.params.id === 'nonexistent_order_id') throw apiError(404)
    res.json(orderEntity)
  }))

  v1.get('/orders:by_client_order_id', validateRequest(
    'query',
    { client_order_id: joi.string().required() },
    orderEntity
  ))

  v1.post('/orders', method((req, res) => {
    assertSchema(req.body, {
      symbol: joi.string().required(),
      qty: joi.number().required().integer().positive(),
      side: joi.string().required().allow('buy', 'sell'),
      type: joi.string().required().allow('market', 'limit', 'stop', 'stop_limit'),
      time_in_force: joi.string().required().allow('day', 'gtc', 'opg', 'ioc', 'fok'),
      limit_price: joi.number().positive(),
      stop_price: joi.number().positive(),
      client_order_id: joi.string().optional().max(48)
    })
    if (req.body.type === 'market' && (req.body.limit_price || req.body.stop_price)) {
      throw apiError(422)
    }
    if (req.body.symbol === 'INSUFFICIENT') {
      throw apiError(403)
    }
    res.json(orderEntity)
  }))

  v1.delete('/orders/:id', method((req) => {
    if (req.params.id === 'nonexistent_order_id') throw apiError(404)
    if (req.params.id === 'uncancelable_order_id') throw apiError(422)
  }))



  app.use((req, res) => {
    res.sendStatus(404)
  })

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      message: err.message
    })
  })

  return new Promise(resolve => {
    const server = app.listen(port, () => resolve(server))
  })
}

const apiError = (statusCode = 500, message = 'Mock API Error') => {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

const method = (fn) => async (req, res, next) => {
  try {
    if (!req.get('APCA-API-KEY-ID') || !req.get('APCA-API-SECRET-KEY')) {
      throw apiError(401)
    }
    if (req.get('APCA-API-SECRET-KEY') === 'invalid_secret') {
      throw apiError(401)
    }
    await fn(req, res, next)
    if (!res.headersSent) res.sendStatus(200)
  } catch (err) {
    next(err)
  }
}

const assertSchema = (value, schema) => {
  const result = joi.validate(value, schema)
  if (result.error) {
    throw apiError(400, result.error)
  }
  return result.value
}

const validateRequest = (property, schema, response) => method((req, res) => {
  assertSchema(req[property], schema)
  if (response) res.json(response)
})

const accountEntity = {
  "id": "904837e3-3b76-47ec-b432-046db621571b",
  "status": "ACTIVE",
  "currency": "USD",
  "buying_power": "4000.32",
  "cash": "4000.32",
  "cash_withdrawable": "4000.32",
  "portfolio_value": "4321.98",
  "pattern_day_trader": false,
  "trading_blocked": false,
  "transfers_blocked": false,
  "account_blocked": false,
  "created_at": "2018-10-01T13:35:25Z"
}

const orderEntity = {
  "id": "904837e3-3b76-47ec-b432-046db621571b",
  "client_order_id": "904837e3-3b76-47ec-b432-046db621571b",
  "created_at": "2018-10-05T05:48:59Z",
  "updated_at": "2018-10-05T05:48:59Z",
  "submitted_at": "2018-10-05T05:48:59Z",
  "filled_at": "2018-10-05T05:48:59Z",
  "expired_at": "2018-10-05T05:48:59Z",
  "canceled_at": "2018-10-05T05:48:59Z",
  "failed_at": "2018-10-05T05:48:59Z",
  "asset_id": "904837e3-3b76-47ec-b432-046db621571b",
  "symbol": "AAPL",
  "exchange": "NASDAQ",
  "asset_class": "us_equity",
  "qty": "15",
  "filled_qty": "0",
  "type": "market",
  "side": "buy",
  "time_in_force": "day",
  "limit_price": "107.00",
  "stop_price": "106.00",
  "filled_avg_price": "106.00",
  "status": "accepted"
}

// promise of a mock alpaca server
let singleton = null

const mockAlpaca = () => {
  if (!singleton) singleton = createAlpacaMock()
  return singleton
}

const createTestContext = (before, after) => {
  let server = null
  before(async () => {
    server = await mockAlpaca()
  })

  after(() => {
    return new Promise(resolve => server.close(resolve))
  })

  return {
    baseUrl: `http://localhost:${PORT}`,
    keyId: 'test_id',
    secretKey: 'test_secret',
  }
}

module.exports = mockAlpaca
module.exports.createTestContext = createTestContext
module.exports.createAlpacaMock = createAlpacaMock
