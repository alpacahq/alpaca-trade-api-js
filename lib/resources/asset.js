"use strict";

async function getAll(options = {}) {
  const resp = await this.httpRequest("/assets", options);
  return resp.data;
}

async function getOne(symbol) {
  const resp = this.httpRequest("/assets/" + symbol);
  return resp.data;
}

module.exports = {
  getAll,
  getOne,
};
