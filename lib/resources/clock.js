"use strict";

async function get() {
  return this.makeRequest("/clock");
}

module.exports = {
  get,
};
