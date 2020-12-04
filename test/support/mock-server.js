"use strict";

import express from "express";
import mockPolygon from "./mock-polygon";
import mockAlpaca from "./mock-alpaca";
import mockData from "./mock-data";

import { apiMethod, apiError } from "./assertions";

/**
 * This server mocks http methods from the alpaca api and returns 200 if the requests are formed correctly.
 * Some endpoints might allow you to pass "cheat code" values to trigger specific responses.
 */

const PORT = process.env.TEST_PORT || 3333;

function createAlpacaMock({ port = PORT } = {}) {
  const app = express()
    .use("/polygon", mockPolygon())
    .use("/alpaca", mockAlpaca())
    .use("/data", mockData());

  app.use(
    apiMethod(() => {
      throw apiError(404, "route not found");
    })
  );

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      message: err.message,
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

// promise of a mock alpaca server
let serverPromise = null;

const start = () => {
  if (!serverPromise) serverPromise = createAlpacaMock();
  return serverPromise;
};

const stop = () => {
  if (!serverPromise) return Promise.resolve();
  return serverPromise
    .then((server) => new Promise((resolve) => server.close(resolve)))
    .then(() => {
      serverPromise = null;
    });
};

const getConfig = () => ({
  baseUrl: `http://localhost:${PORT}/alpaca`,
  dataBaseUrl: `http://localhost:${PORT}/data`,
  polygonBaseUrl: `http://localhost:${PORT}/polygon`,
  keyId: "test_id",
  secretKey: "test_secret",
});

export default {
  start,
  stop,
  getConfig,
};
