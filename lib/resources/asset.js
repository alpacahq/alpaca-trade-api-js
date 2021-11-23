"use strict";

function getAll(options = {}) {
  return this.sendRequest("/assets", options);
}

function getOne(symbol) {
  return this.sendRequest("/assets/" + symbol);
}

module.exports = {
  getAll,
  getOne,
};
