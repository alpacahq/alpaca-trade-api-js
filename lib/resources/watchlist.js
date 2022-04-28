"use strict";

// todo: try this
// const { omitBy, isNil } = require('lodash')

function getAll() {
  return this.sendRequest("/watchlists");
}

function getOne(id) {
  return this.sendRequest(`/watchlists/${id}`);
}

function addWatchlist(name, symbols = undefined) {
  const body = { name: name, symbols: symbols };
  return this.sendRequest("/watchlists", null, body, "POST");
}

function addToWatchlist(id, symbol) {
  const body = { symbol: symbol };
  return this.sendRequest(`/watchlists/${id}`, null, body, "POST");
}

function updateWatchlist(id, newWatchList) {
  return this.sendRequest(`/watchlists/${id}`, null, newWatchList, "PUT");
}

function deleteWatchlist(id) {
  return this.sendRequest(`/watchlists/${id}`, null, null, "DELETE");
}

function deleteFromWatchlist(id, symbol) {
  return this.sendRequest(`/watchlists/${id}/${symbol}`, null, null, "DELETE");
}

module.exports = {
  getAll,
  getOne,
  addWatchlist,
  addToWatchlist,
  updateWatchlist,
  deleteWatchlist,
  deleteFromWatchlist,
};
