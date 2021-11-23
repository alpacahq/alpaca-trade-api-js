"use strict";

function getAll() {
  return this.sendRequest("/positions");
}

function getOne(symbol) {
  return this.sendRequest("/positions/" + symbol);
}

function closeAll() {
  return this.sendRequest("/positions", null, null, "DELETE");
}

function closeOne(symbol) {
  return this.sendRequest("/positions/" + symbol, null, null, "DELETE");
}

module.exports = {
  getAll,
  getOne,
  closeAll,
  closeOne,
};
