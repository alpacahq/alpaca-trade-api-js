"use strict";

const axios = require("axios");
const { realpath } = require("fs");
const joinUrl = require("urljoin");

function httpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, secretKey, apiVersion, oauth } = this.configuration;
  return axios.request({
    method: method || "GET",
    url: joinUrl(baseUrl, apiVersion, endpoint),
    params: queryParams || {},
    headers:
      oauth !== ""
        ? {
            "content-type": method !== "DELETE" ? "application/json" : "",
            Authorization: "Bearer " + oauth,
          }
        : {
            "content-type": method !== "DELETE" ? "application/json" : "",
            "APCA-API-KEY-ID": keyId,
            "APCA-API-SECRET-KEY": secretKey,
          },
    body: body || undefined,
  });
}

function dataHttpRequest(endpoint, queryParams, body, method) {
  const { dataBaseUrl, keyId, secretKey, oauth } = this.configuration;
  return axios.request({
    method: method || "GET",
    url: joinUrl(dataBaseUrl, "v1", endpoint),
    params: queryParams || {},
    headers:
      oauth !== ""
        ? {
            "content-type": method !== "DELETE" ? "application/json" : "",
            Authorization: "Bearer " + oauth,
          }
        : {
            "content-type": method !== "DELETE" ? "application/json" : "",
            "APCA-API-KEY-ID": keyId,
            "APCA-API-SECRET-KEY": secretKey,
          },
    body: body || undefined,
  });
}

async function requestWrapper(f, endpoint) {
  const resp = await f(endpoint);
  return resp.data;
}

module.exports = {
  httpRequest,
  dataHttpRequest,
  requestWrapper,
};
