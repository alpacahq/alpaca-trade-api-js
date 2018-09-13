'use strict';

const configuration = require('../configuration')
const api = require('../api');

function get() {
  return api.httpRequest('/account');
}

module.exports = {
  get,
};
