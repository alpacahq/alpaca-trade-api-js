'use strict'

function get() {
  return this.httpRequest('/account')
}

function updateConfigs(configs) {
  return this.httpRequest('/account/configurations', null, configs, 'PATCH')
}

function getConfigs() {
  return this.httpRequest('/account/configurations')
}

module.exports = {
  get,
  getConfigs,
  updateConfigs
}
