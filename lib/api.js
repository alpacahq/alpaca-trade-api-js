'use strict';

const request = require('request-promise');
const joinUrl = require('urljoin');

const { buildQueryString } = require('./utils/url');

function httpRequest(endpoint, queryParams = {}, body = {}, method = 'GET') {
  const { baseUrl, keyId, secretKey } = this.configuration;
  const queryString = buildQueryString(queryParams);
  return request({
    method,
    uri: joinUrl(baseUrl, 'v1', endpoint) + queryString,
    headers: {
      'content-type': 'application/json',
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
    body: JSON.stringify(body),
  });
}

module.exports = {
  httpRequest,
};
