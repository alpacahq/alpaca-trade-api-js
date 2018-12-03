'use strict'

const request = require('request-promise')
const joinUrl = require('urljoin')

function httpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, secretKey } = this.configuration
  return request({
    method: method || 'GET',
    uri: joinUrl(baseUrl, endpoint),
    qs: queryParams || {},
    headers: {
      'content-type': method !== 'DELETE' ? 'application/json' : undefined,
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
    body: body || undefined,
    json: true,
  })
}

function dataHttpRequest(endpoint, queryParams, body, method) {
  const { dataBaseUrl, keyId, secretKey } = this.configuration
  console.log('url', joinUrl(dataBaseUrl, endpoint))
  return request({
    method: method || 'GET',
    uri: joinUrl(dataBaseUrl, endpoint),
    qs: queryParams || {},
    headers: {
      'content-type': method !== 'DELETE' ? 'application/json' : undefined,
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
    body: body || undefined,
    json: true,
  })
}

function polygonHttpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, polygonBaseUrl } = this.configuration
  queryParams = queryParams || {}
  queryParams['apiKey'] = keyId
  if (baseUrl.indexOf('staging') > -1) {
    queryParams['staging'] = true
  }
  return request({
    method: method || 'GET',
    uri: joinUrl(polygonBaseUrl, endpoint),
    qs: queryParams || {},
    headers: {
      'content-type': 'application/json',
    },
    body: body || undefined,
    json: true,
  })
}

module.exports = {
  httpRequest,
  dataHttpRequest,
  polygonHttpRequest,
}
