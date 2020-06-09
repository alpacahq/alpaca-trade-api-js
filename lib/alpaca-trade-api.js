'use strict'

require('dotenv').config()

const api = require('./api')
const account = require('./resources/account')
const position = require('./resources/position')
const calendar = require('./resources/calendar')
const clock = require('./resources/clock')
const asset = require('./resources/asset')
const order = require('./resources/order')
const data = require('./resources/data')
const watchlist = require('./resources/watchlist')
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
    usePolygon: config.usePolygon ? true : false, // should we use polygon
                                                  // data or alpaca data
  }
  this.data_ws = new websockets.AlpacaStreamClient({
    url: this.configuration.usePolygon ? this.configuration.baseUrl : this.configuration.dataBaseUrl,
    apiKey: this.configuration.keyId,
    secretKey: this.configuration.secretKey,
    oauth: this.configuration.oauth,
    usePolygon: this.configuration.usePolygon
  })
  this.data_ws.STATE = websockets.STATE
  this.data_ws.EVENT = websockets.EVENT
  this.data_ws.ERROR = websockets.ERROR

  this.trade_ws = new websockets.AlpacaStreamClient({
    url: this.configuration.baseUrl,
    apiKey: this.configuration.keyId,
    secretKey: this.configuration.secretKey,
    oauth: this.configuration.oauth,
    usePolygon: this.configuration.usePolygon
  })
  this.trade_ws.STATE = websockets.STATE
  this.trade_ws.EVENT = websockets.EVENT
  this.trade_ws.ERROR = websockets.ERROR
}

// Helper methods
Alpaca.prototype.httpRequest = api.httpRequest
Alpaca.prototype.dataHttpRequest = api.dataHttpRequest
Alpaca.prototype.polygonHttpRequest = api.polygonHttpRequest

// Account
Alpaca.prototype.getAccount = account.get
Alpaca.prototype.updateAccountConfigurations = account.updateConfigs
Alpaca.prototype.getAccountConfigurations = account.getConfigs
Alpaca.prototype.getAccountActivities = account.getActivities
Alpaca.prototype.getPortfolioHistory = account.getPortfolioHistory

// Positions
Alpaca.prototype.getPositions = position.getAll
Alpaca.prototype.getPosition = position.getOne
Alpaca.prototype.closeAllPositions = position.closeAll
Alpaca.prototype.closePosition = position.closeOne

// Calendar
Alpaca.prototype.getCalendar = calendar.get

// Clock
Alpaca.prototype.getClock = clock.get

// Asset
Alpaca.prototype.getAssets = asset.getAll
Alpaca.prototype.getAsset = asset.getOne

// Order
Alpaca.prototype.getOrders = order.getAll
Alpaca.prototype.getOrder = order.getOne
Alpaca.prototype.getOrderByClientId = order.getByClientOrderId
Alpaca.prototype.createOrder = order.post
Alpaca.prototype.replaceOrder = order.patchOrder
Alpaca.prototype.cancelOrder = order.cancel
Alpaca.prototype.cancelAllOrders = order.cancelAll

// Data
Alpaca.prototype.getAggregates = data.getAggregates
Alpaca.prototype.getBars = data.getBars
Alpaca.prototype.lastTrade = data.getLastTrade  // getLastTrade is already preserved for polygon
Alpaca.prototype.lastQuote = data.getLastQuote  // getLastQuote is already preserved for polygon

// Watchlists
Alpaca.prototype.getWatchlists = watchlist.getAll
Alpaca.prototype.getWatchlist = watchlist.getOne
Alpaca.prototype.addWatchlist = watchlist.addWatchlist
Alpaca.prototype.addToWatchlist = watchlist.addToWatchlist
Alpaca.prototype.updateWatchlist = watchlist.updateWatchlist
Alpaca.prototype.deleteWatchlist = watchlist.deleteWatchlist
Alpaca.prototype.deleteFromWatchlist = watchlist.deleteFromWatchlist

// Polygon
Alpaca.prototype.getExchanges = polygon.exchanges
Alpaca.prototype.getSymbolTypeMap = polygon.symbolTypeMap
Alpaca.prototype.getHistoricTradesV2 = polygon.historicTradesV2
Alpaca.prototype.getHistoricQuotesV2 = polygon.historicQuotesV2
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