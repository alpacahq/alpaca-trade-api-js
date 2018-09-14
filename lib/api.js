'use strict';

const request = require('request-promise');
const joinUrl = require('urljoin');

const configuration = require('./configuration');
const { buildQueryString } = require('./utils/url');

function configure({ baseUrl = configuration.baseUrl, keyId, secretKey }) {
  configuration.baseUrl = baseUrl;
  configuration.keyId = keyId;
  configuration.secretKey = secretKey;
}

function httpRequest(endpoint, queryParams = {}, body = {}, method = 'GET') {
  const { baseUrl, keyId, secretKey } = configuration;
  const queryString = buildQueryString(queryParams);
  return request({
    method,
    uri: joinUrl(baseUrl, 'v1', endpoint) + queryString,
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
  });
}

module.exports = {
  configure,
  httpRequest,
};
