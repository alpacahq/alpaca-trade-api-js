'use strict'

const { omitBy, isNil } = require('lodash')
const { toDateString } = require('../utils/dateformat')

function get({ start, end }={}) {
  const queryParams = omitBy({
    start: toDateString(start),
    end: toDateString(end),
  }, isNil)
  return this.httpRequest('/calendar', queryParams)
}

module.exports = {
  get,
}
