'use strict';

const api = require('./api');
const account = require('./resources/account');

module.exports = function () {
  return {
    configure: api.configure,
    getAccount: account.get,
  };
};
