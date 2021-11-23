"use strict";

const { omitBy, isNil } = require("lodash");
const { toDateString } = require("../utils/dateformat");

async function get({ start, end } = {}) {
  const queryParams = omitBy(
    {
      start: toDateString(start),
      end: toDateString(end),
    },
    isNil
  );
  return this.makeRequest("/calendar", queryParams);
}

module.exports = {
  get,
};
