'use strict';

const request = require('request-promise');
const joinUrl = require('urljoin');

const { buildQueryString } = require('./utils/url');

function httpRequest(endpoint, queryParams = {}, body = {}, method = 'GET') {
  const { baseUrl, keyId, secretKey } = this.configuration;
  const queryString = buildQueryString(queryParams);
  return request({
    method,
    uri: joinUrl(baseUrl, 'v1', endpoint, queryString),
    headers: {
      'content-type': method !== 'DELETE' ? 'application/json' : undefined,
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
    body: JSON.stringify(body),
  });
}

function polygonHttpRequest(endpoint, queryParams = {}, body = {}, method = 'GET') {
  const { baseUrl, keyId, secretKey, polygonBaseUrl } = this.configuration;
  queryParams['apiKey'] = keyId;
  if (baseUrl.indexOf('staging') > -1) {
    queryParams['staging'] = true
  }
  const queryString = buildQueryString(queryParams);
  return request({
    method,
    uri: joinUrl(polygonBaseUrl, endpoint, queryString),
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

module.exports = {
  httpRequest,
  polygonHttpRequest,
};
