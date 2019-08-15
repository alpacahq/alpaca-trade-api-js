'use strict'

function getAll() {
  return this.httpRequest('/positions')
}

function getOne(symbol) {
  return this.httpRequest('/positions/' + symbol)
}

function closeAll() {
  return this.httpRequest('/positions', null, null, 'DELETE')
}

function closeOne(symbol) {
  return this.httpRequest('/positions/' + symbol, null, null, 'DELETE')
}

module.exports = {
  getAll,
  getOne,
  closeAll,
  closeOne,
}
