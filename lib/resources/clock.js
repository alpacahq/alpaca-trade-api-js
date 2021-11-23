"use strict";

function get() {
  return this.sendRequest("/clock");
}

module.exports = {
  get,
};
