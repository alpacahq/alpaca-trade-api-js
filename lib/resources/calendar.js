'use strict';

const api = require('../api');

function get(start = '', end = '') {
  return api.httpRequest('/calendar', { start, end });
}

module.exports = {
  get,
};
