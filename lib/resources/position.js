"use strict";

function getAll() {
  return this.makeRequest("/positions");
}

function getOne(symbol) {
  return this.makeRequest("/positions/" + symbol);
}

function closeAll() {
  return this.makeRequest("/positions", null, null, "DELETE");
}

function closeOne(symbol) {
  return this.makeRequest("/positions/" + symbol, null, null, "DELETE");
}

module.exports = {
  getAll,
  getOne,
  closeAll,
  closeOne,
};
