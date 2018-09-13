'use strict';

const api = require('../api');

function getAll() {
  return api.httpRequest('/positions');
}

function getOne(symbol) {
  return api.httpRequest('/positions/' + symbol);
}

module.exports = {
  getAll,
  getOne,
};
