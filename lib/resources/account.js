'use strict'

function get() {
  return this.httpRequest('/account')
}

module.exports = {
  get,
}
