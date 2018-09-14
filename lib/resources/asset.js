'use strict';

const { omitBy, isNil } = require('lodash');

const api = require('../api');

function getAll(status, assetClass) {
  const queryParams = omitBy({ status, asset_class: assetClass }, isNil);
  return api.httpRequest('/assets', queryParams);
}

function getOne(symbol) {
  return api.httpRequest('/assets/' + symbol);
}

module.exports = {
  getAll,
  getOne,
};
