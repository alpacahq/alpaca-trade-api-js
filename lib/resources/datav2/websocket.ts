"use strict";

// Listeners
// A client can listen on any of the following events, states, or errors

// Connection states. Each of these will also emit EVENT.STATE_CHANGE
const STATE = {
  AUTHENTICATING: "authenticating",
  AUTHENTICATED: "authenticated",
  CONNECTED: "connected",
  CONNECTING: "connecting",
  DISCONNECTED: "disconnected",
  WAITING_TO_CONNECT: "waiting to connect",
  WAITING_TO_RECONNECT: "waiting to reconnect",
};

// Stock client events
const EVENT = {
  CLIENT_ERROR: "client error",
  STATE_CHANGE: "state change",
  AUTHORIZED: "authorized",
  UNAUTHORIZED: "unauthorized",
  STOCK_TRADES: "stock_trades",
  STOCK_QUOTES: "stock_quotes",
  STOCK_BARS: "stock_bars",
  STOCK_DAILY_BARS: "stock_daily_bars",
  TRADING_STATUSES: "trading_statuses",
  LULDS: "lulds",
};

// Crypto client events
const CRYPTO_EVENT = {
  CLIENT_ERROR: "client error",
  STATE_CHANGE: "state change",
  AUTHORIZED: "authorized",
  UNAUTHORIZED: "unauthorized",
  TRADES: "crypto_trades",
  QUOTES: "crypto_quotes",
  BARS: "crypto_bars",
  DAILY_BARS: "crypto_daily_bars",
};

// Connection errors
const CONN_ERROR = {
  400: "invalid syntax",
  401: "not authenticated",
  402: "auth failed",
  403: "already authenticated",
  404: "auth timeout",
  405: "symbol limit exceeded",
  406: "connection limit exceeded",
  407: "slow client",
  408: "v2 not enabled",
  409: "insufficient subscription",
  500: "internal error",
  MISSING_SECERT_KEY: "missing secret key",
  MISSING_API_KEY: "missing api key",
  UNEXPECTED_MESSAGE: "unexpected message",
};

module.exports = {
  STATE,
  EVENT,
  CRYPTO_EVENT,
  CONN_ERROR,
};
