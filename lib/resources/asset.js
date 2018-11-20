'use strict'

const { omitBy, isNil } = require('lodash')

function getAll(status, assetClass) {
  const queryParams = omitBy({ status, asset_class: assetClass }, isNil)
  return this.httpRequest('/assets', queryParams)
}

function getOne(symbol) {
  return this.httpRequest('/assets/' + symbol)
}

module.exports = {
  getAll,
  getOne,
}
