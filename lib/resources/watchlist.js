'use strict'

// todo: try this
// const { omitBy, isNil } = require('lodash')

function getAll() {
  return this.httpRequest('/watchlists')
}

function getOne(id) {
  return this.httpRequest(`/watchlists/${id}`)
}

function addWatchlist(name, symbols = undefined) {
  const body = { name: name, symbols: symbols }
    return this.httpRequest('/watchlists', null, body, 'POST')
}

function addToWatchlist(id, symbol) {
    const body = { symbol: symbol }
    return this.httpRequest(`/watchlists/${id}`, null, body, 'POST')
}

function updateWatchlist(id, newWatchList) {
    return this.httpRequest(`/watchlists/${id}`, null, newWatchList, 'PUT')
}

function deleteWatchlist(id) {
    return this.httpRequest(`/watchlists/${id}`, null, null, 'DELETE')
}

function deleteFromWatchlist(id, symbol) {
    return this.httpRequest(`/watchlists/${id}/${symbol}`, null, null, 'DELETE')
}

module.exports = {
  getAll,
  getOne,
  addWatchlist,
  addToWatchlist,
  updateWatchlist,
  deleteWatchlist,
  deleteFromWatchlist
}
