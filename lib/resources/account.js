'use strict';

const api = require('../api');

function get() {
  return api.httpRequest('/account');
}

module.exports = {
  get,
};
