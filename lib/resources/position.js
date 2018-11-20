'use strict'

function getAll() {
  return this.httpRequest('/positions')
}

function getOne(symbol) {
  return this.httpRequest('/positions/' + symbol)
}

module.exports = {
  getAll,
  getOne,
}
