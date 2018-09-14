'use strict';

const { omitBy, isNil } = require('lodash');

function get(start, end) {
  const queryParams = omitBy({ start, end }, isNil);
  return this.httpRequest('/calendar', queryParams);
}

module.exports = {
  get,
};
