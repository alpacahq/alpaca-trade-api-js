'use strict'

const axios = require('axios')
const joinUrl = require('url-join')
const qs = require('qs');

async function httpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, secretKey, apiVersion, oauth } = this.configuration
  return (await axios({
    method: method || 'GET',
    url: joinUrl(baseUrl, apiVersion, endpoint, '?' + qs.stringify(queryParams || {})),
    headers: oauth !== '' ? {
      'content-type': "application/json",//method !== 'DELETE' ? 'application/json' : undefined,
      'Authorization': "Bearer " + oauth,
    } : {
        'content-type': 'application/json',//method !== 'DELETE' ? 'application/json' : undefined, //TODO: is there any reason delete should not have a json header type?
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    data: body || undefined,
    json: true,
  })).data
}

async function dataHttpRequest(endpoint, queryParams, body, method) {
  const { dataBaseUrl, keyId, secretKey, oauth } = this.configuration
  return (await axios({
    method: method || 'GET',
    url: joinUrl(dataBaseUrl, 'v1', endpoint, '?' + qs.stringify(queryParams)),
    headers: oauth !== '' ? {
      'content-type': 'application/json',//method !== 'DELETE' ? 'application/json' : undefined,
      'Authorization': "Bearer " + oauth,
    } : {
        'content-type': 'application/json',//method !== 'DELETE' ? 'application/json' : undefined,
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    data: body || undefined,
    json: true,
  })).data
}

async function polygonHttpRequest(endpoint, queryParams, body, method, apiVersion = 'v1') {
  const { baseUrl, keyId, polygonBaseUrl } = this.configuration
  queryParams = queryParams || {}
  queryParams['apiKey'] = keyId
  if (baseUrl.indexOf('staging') > -1) {
    queryParams['staging'] = true
  }
  return (await axios({
    method: method || 'GET',
    url: joinUrl(polygonBaseUrl, apiVersion, endpoint, '?' + qs.stringify(queryParams || {})),
    headers: {
      'content-type': 'application/json',
    },
    data: body || undefined,
    json: true,
  })).data
}

module.exports = {
  httpRequest,
  dataHttpRequest,
  polygonHttpRequest,
}
