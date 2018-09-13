'use strict';

const request = require('request-promise');
const joinUrl = require('urljoin');

const configuration = require('./configuration');

function configure({ baseUrl = configuration.baseUrl, keyId, secretKey }) {
  configuration.baseUrl = baseUrl;
  configuration.keyId = keyId;
  configuration.secretKey = secretKey;
}

function httpRequest(endpoint, method = 'GET', body = {}) {
  const { baseUrl, keyId, secretKey } = configuration;
  return request({
    method,
    uri: joinUrl(baseUrl, 'v1', endpoint),
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
