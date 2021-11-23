"use strict";

const axios = require("axios");
const joinUrl = require("urljoin");

function httpRequest(endpoint, queryParams, body, method) {
  const { baseUrl, keyId, secretKey, apiVersion, oauth } = this.configuration;
  const req = {
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
    data: body || undefined,
  };
  return axios(req).catch((err) => {
    throw err.message;
  });
}

function dataHttpRequest(endpoint, queryParams, body, method) {
  const { dataBaseUrl, keyId, secretKey, oauth } = this.configuration;
  const req = {
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
  };

  return axios.request(req).catch((err) => {
    throw err.message;
  });
}

async function makeRequest(f, endpoint, queryParams, body, method) {
  const resp = await f(endpoint, queryParams, body, method);
  return resp.data;
}

module.exports = {
  httpRequest,
  dataHttpRequest,
  makeRequest,
};
