'use strict'

function getAll(options={}) {
  return this.httpRequest('/assets', options)
}

function getOne(symbol) {
  return this.httpRequest('/assets/' + symbol)
}

module.exports = {
  getAll,
  getOne,
}
