'use strict';

const api = require('./api');
const account = require('./resources/account');
const position = require('./resources/position');

module.exports = function () {
  return {
    configure: api.configure,
    getAccount: account.get,
    getPositions: position.getAll,
    getPosition: position.getOne,
  };
};
