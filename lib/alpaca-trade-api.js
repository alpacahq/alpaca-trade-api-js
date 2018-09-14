'use strict';

const api = require('./api');
const account = require('./resources/account');
const position = require('./resources/position');
const calendar = require('./resources/calendar');
const asset = require('./resources/asset');

module.exports = function () {
  return {
    configure: api.configure,
    getAccount: account.get,
    getPositions: position.getAll,
    getPosition: position.getOne,
    getCalendar: calendar.get,
    getAssets: asset.getAll,
    getAsset: asset.getOne,
  };
};
