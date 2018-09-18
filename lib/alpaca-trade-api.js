'use strict';

const api = require('./api');
const account = require('./resources/account');
const position = require('./resources/position');
const calendar = require('./resources/calendar');
const asset = require('./resources/asset');
const order = require('./resources/order');

function Alpaca() {
  this.configuration = {
    baseUrl: 'https://api.alpaca.markets',
    keyId: '',
    secretKey: '',
  };
}

Alpaca.prototype.configure = function({ baseUrl = configuration.baseUrl, keyId, secretKey }) {
  this.configuration.baseUrl = baseUrl;
  this.configuration.keyId = keyId;
  this.configuration.secretKey = secretKey;
}
Alpaca.prototype.httpRequest = api.httpRequest;
Alpaca.prototype.getAccount = account.get;
Alpaca.prototype.getPositions = position.getAll;
Alpaca.prototype.getPosition = position.getOne;
Alpaca.prototype.getCalendar = calendar.get;
Alpaca.prototype.getAssets = asset.getAll;
Alpaca.prototype.getAsset = asset.getOne;
Alpaca.prototype.getOrders = order.getAll;
Alpaca.prototype.getOrder = order.getOne;
Alpaca.prototype.getOrderByClientId = order.getByClientId;
Alpaca.prototype.createOrder = order.post;
Alpaca.prototype.cancelOrder = order.remove;

module.exports = new Alpaca();
