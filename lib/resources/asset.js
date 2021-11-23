"use strict";

async function getAll(options = {}) {
  return this.makeRequest("/assets", options);
}

async function getOne(symbol) {
  return this.makeRequest("/assets/" + symbol);
}

module.exports = {
  getAll,
  getOne,
};
