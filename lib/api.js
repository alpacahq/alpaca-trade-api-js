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
  return axios(req);
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
    data: body || undefined,
  };

  return axios(req);
}

function sendRequest(f, endpoint, queryParams, body, method) {
  return f(endpoint, queryParams, body, method).then((resp) => resp.data);
}

module.exports = {
  httpRequest,
  dataHttpRequest,
  sendRequest,
};
