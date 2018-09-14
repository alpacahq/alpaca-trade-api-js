'use strict';

const { omitBy, isNil } = require('lodash');

const api = require('../api');

function get(start, end) {
  const queryParams = omitBy({ start, end }, isNil);
  return api.httpRequest('/calendar', queryParams);
}

module.exports = {
  get,
};
