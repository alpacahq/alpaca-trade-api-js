'use strict'

function get() {
  return this.httpRequest('/clock')
}

module.exports = {
  get,
}
