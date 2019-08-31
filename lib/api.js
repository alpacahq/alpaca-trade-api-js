'use strict'

const request = require('request-promise')
const joinUrl = require('urljoin')

function httpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, secretKey, apiVersion, oauth } = this.configuration
  return request({
    method: method || 'GET',
    uri: joinUrl(baseUrl, apiVersion, endpoint),
    qs: queryParams || {},
    headers: oauth !== '' ? {
      'content-type': method !== 'DELETE' ? 'application/json' : undefined,
      'Authorization': "Bearer " + oauth,
    } : {
        'content-type': method !== 'DELETE' ? 'application/json' : undefined,
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    body: body || undefined,
    json: true,
  })
}

function dataHttpRequest(endpoint, queryParams, body, method) {
  const { dataBaseUrl, keyId, secretKey, oauth } = this.configuration
  return request({
    method: method || 'GET',
    uri: joinUrl(dataBaseUrl, 'v1', endpoint),
    qs: queryParams || {},
    headers: oauth !== '' ? {
      'content-type': method !== 'DELETE' ? 'application/json' : undefined,
      'Authorization': "Bearer " + oauth,
    } : {
        'content-type': method !== 'DELETE' ? 'application/json' : undefined,
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    body: body || undefined,
    json: true,
  })
}

function polygonHttpRequest(endpoint, queryParams, body, method, apiVersion = 'v1') {
  const { baseUrl, keyId, polygonBaseUrl } = this.configuration
  queryParams = queryParams || {}
  queryParams['apiKey'] = keyId
  if (baseUrl.indexOf('staging') > -1) {
    queryParams['staging'] = true
  }
  return request({
    method: method || 'GET',
    uri: joinUrl(polygonBaseUrl, apiVersion, endpoint),
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
