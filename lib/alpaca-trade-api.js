'use strict'

require('dotenv').config()

const api = require('./api')
const account = require('./resources/account')
const position = require('./resources/position')
const calendar = require('./resources/calendar')
const clock = require('./resources/clock')
const asset = require('./resources/asset')
const order = require('./resources/order')
const bars = require('./resources/data/bars')
const polygon = require('./resources/polygon')

const websockets = require('./resources/websockets')

function Alpaca(config = {}) {
  this.configuration = {
    baseUrl: config.baseUrl || process.env.APCA_API_BASE_URL
      || (config.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets'),
    dataBaseUrl: config.dataBaseUrl || process.env.APCA_DATA_BASE_URL || 'https://data.alpaca.markets',
    polygonBaseUrl: config.polygonBaseUrl || process.env.POLYGON_API_BASE_URL || 'https://api.polygon.io',
    keyId: config.keyId || process.env.APCA_API_KEY_ID || '',
    secretKey: config.secretKey || process.env.APCA_API_SECRET_KEY || '',
    apiVersion: config.apiVersion || process.env.APCA_API_VERSION || 'v2',
    oauth: config.oauth || process.env.APCA_API_OAUTH || '',
  }
  this.websocket = new websockets.AlpacaStreamClient({
    url: this.configuration.baseUrl,
    apiKey: this.configuration.keyId,
    secretKey: this.configuration.secretKey,
    oauth: this.configuration.oauth
  })
  this.websocket.STATE = websockets.STATE
  this.websocket.EVENT = websockets.EVENT
  this.websocket.ERROR = websockets.ERROR
}

Alpaca.prototype.httpRequest = api.httpRequest
Alpaca.prototype.dataHttpRequest = api.dataHttpRequest
Alpaca.prototype.polygonHttpRequest = api.polygonHttpRequest

Alpaca.prototype.getAccount = account.get
Alpaca.prototype.getPositions = position.getAll
Alpaca.prototype.getPosition = position.getOne
Alpaca.prototype.closeAllPositions = position.closeAll
Alpaca.prototype.closePosition = position.closeOne
Alpaca.prototype.getCalendar = calendar.get
Alpaca.prototype.getClock = clock.get
Alpaca.prototype.getAssets = asset.getAll
Alpaca.prototype.getAsset = asset.getOne
Alpaca.prototype.getOrders = order.getAll
Alpaca.prototype.getOrder = order.getOne
Alpaca.prototype.getOrderByClientId = order.getByClientOrderId
Alpaca.prototype.createOrder = order.post
Alpaca.prototype.cancelOrder = order.cancel
Alpaca.prototype.cancelAllOrders = order.cancelAll

Alpaca.prototype.getBars = bars.getBars

Alpaca.prototype.getExchanges = polygon.exchanges
Alpaca.prototype.getSymbolTypeMap = polygon.symbolTypeMap
Alpaca.prototype.getHistoricTrades = polygon.historicTrades
Alpaca.prototype.getHistoricQuotes = polygon.historicQuotes
Alpaca.prototype.getHistoricAggregates = polygon.historicAggregates
Alpaca.prototype.getHistoricAggregatesV2 = polygon.historicAggregatesV2
Alpaca.prototype.getLastTrade = polygon.lastTrade
Alpaca.prototype.getLastQuote = polygon.lastQuote
Alpaca.prototype.getConditionMap = polygon.conditionMap
Alpaca.prototype.getCompany = polygon.company
Alpaca.prototype.getAnalysts = polygon.analysts
Alpaca.prototype.getDividends = polygon.dividends
Alpaca.prototype.getEarnings = polygon.earnings
Alpaca.prototype.getFinancials = polygon.financials
Alpaca.prototype.getSplits = polygon.splits
Alpaca.prototype.getNews = polygon.news
Alpaca.prototype.getSymbol = polygon.getSymbol

module.exports = Alpaca
