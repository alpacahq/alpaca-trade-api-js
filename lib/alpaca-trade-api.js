'use strict';

require('dotenv').config()

const api = require('./api');
const account = require('./resources/account');
const position = require('./resources/position');
const calendar = require('./resources/calendar');
const clock = require('./resources/clock')
const asset = require('./resources/asset');
const order = require('./resources/order');
const polygon = require('./resources/polygon');

const websockets = require('./resources/websockets');

function Alpaca() {
  this.configuration = {
    baseUrl: 'https://api.alpaca.markets',
    keyId: '',
    secretKey: '',
    polygonBaseUrl: 'https://api.polygon.io/v1',
  };
  if (process.env.APCA_API_BASE_URL) {
    this.configuration.baseUrl = process.env.APCA_API_BASE_URL;
  }
  if (process.env.APCA_API_KEY_ID) {
    this.configuration.keyId = process.env.APCA_API_KEY_ID;
  }
  if (process.env.APCA_API_SECRET_KEY) {
    this.configuration.secretKey = process.env.APCA_API_SECRET_KEY;
  }
}

Alpaca.prototype.configure = function ({ baseUrl = this.configuration.baseUrl, polygonBaseUrl = this.configuration.polygonBaseUrl, keyId, secretKey }) {
  this.configuration.baseUrl = baseUrl;
  this.configuration.polygonBaseUrl = polygonBaseUrl;
  this.configuration.keyId = keyId;
  this.configuration.secretKey = secretKey;
  this.websockets.client.setConfiguration(baseUrl, keyId, secretKey);
}
Alpaca.prototype.httpRequest = api.httpRequest;
Alpaca.prototype.polygonHttpRequest = api.polygonHttpRequest;
Alpaca.prototype.getAccount = account.get;
Alpaca.prototype.getPositions = position.getAll;
Alpaca.prototype.getPosition = position.getOne;
Alpaca.prototype.getCalendar = calendar.get;
Alpaca.prototype.getClock = clock.get;
Alpaca.prototype.getAssets = asset.getAll;
Alpaca.prototype.getAsset = asset.getOne;
Alpaca.prototype.getOrders = order.getAll;
Alpaca.prototype.getOrder = order.getOne;
Alpaca.prototype.getOrderByClientId = order.getByClientOrderId;
Alpaca.prototype.createOrder = order.post;
Alpaca.prototype.cancelOrder = order.remove;

Alpaca.prototype.getExchanges = polygon.exchanges;
Alpaca.prototype.getSymbolTypeMap = polygon.symbolTypeMap;
Alpaca.prototype.getHistoricTrades = polygon.historicTrades;
Alpaca.prototype.getHistoricQuotes = polygon.historicQuotes;
Alpaca.prototype.getHistoricAggregates = polygon.historicAggregates;
Alpaca.prototype.getLastTrade = polygon.lastTrade;
Alpaca.prototype.getLastQuote = polygon.lastQuote;
Alpaca.prototype.getConditionMap = polygon.conditionMap;
Alpaca.prototype.getCompany = polygon.company;
Alpaca.prototype.getDividends = polygon.dividends;
Alpaca.prototype.getEarnings = polygon.earnings;
Alpaca.prototype.getFinancials = polygon.financials;
Alpaca.prototype.getSplits = polygon.splits;
Alpaca.prototype.getNews = polygon.news;
Alpaca.prototype.getSymbol = polygon.getSymbol;

Alpaca.prototype.websockets = {
  client: websockets.AlpacaStreamClient,
  ERROR: websockets.ERROR,
  STATE: websockets.STATE,
  EVENT: websockets.EVENT,
};

module.exports = new Alpaca();
