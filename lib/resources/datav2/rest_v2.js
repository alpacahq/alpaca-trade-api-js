const axios = require("axios").default;

const entityv2 = require("./entityv2");

// Number of data points to return.
const V2_MAX_LIMIT = 10000;

const TYPE = {
  TRADES: "trades",
  QUOTES: "quotes",
  BARS: "bars",
};

function dataHttpRequest(url, queryParams, config) {
  const { dataBaseUrl, keyId, secretKey, oauth } = config;
  const resp = axios
    .get(`${dataBaseUrl}${url}`, {
      params: queryParams,
      headers:
        oauth !== ""
          ? {
              "content-type": "application/json",
              Authorization: "Bearer " + oauth,
            }
          : {
              "content-type": "application/json",
              "APCA-API-KEY-ID": keyId,
              "APCA-API-SECRET-KEY": secretKey,
            },
    })
    .catch((err) => {
      throw err;
    });
  return resp;
}

async function* getDataV2(endpoint, symbol, options = {}, config) {
  let pageToken = null;
  let totalItems = 0;
  const limit = options.limit;
  while (true) {
    let actualLimit = null;
    if (limit) {
      actualLimit = Math.min(limit - totalItems, V2_MAX_LIMIT);
      if (actualLimit < 1) {
        break;
      }
    }
    let params = options;
    Object.assign(params, { limit: actualLimit, page_token: pageToken });
    const resp = await dataHttpRequest(
      `/v2/stocks/${symbol}/${endpoint}`,
      params,
      config
    );
    const items = resp.data[endpoint];
    for (let item of items) {
      yield item;
    }
    totalItems += items.length;
    pageToken = resp.data.next_page_token;
    if (!pageToken) {
      break;
    }
  }
}

async function* getTrades(symbol, options, config) {
  const trades = getDataV2(
    TYPE.TRADES,
    symbol,
    { start: options.start, end: options.end, limit: options.limit },
    config
  );
  for await (let trade of trades) {
    yield entityv2.AlpacaTradeV2(trade);
  }
}

async function* getQuotes(symbol, options, config) {
  const quotes = getDataV2(
    TYPE.QUOTES,
    symbol,
    { start: options.start, end: options.end, limit: options.limit },
    config
  );
  for await (let quote of quotes) {
    yield entityv2.AlpacaQuoteV2(quote);
  }
}

async function* getBars(symbol, options, config) {
  const bars = getDataV2(
    TYPE.BARS,
    symbol,
    {
      start: options.start,
      end: options.end,
      limit: options.limit,
      timeframe: options.timeframe,
      adjustment: options.adjustment,
    },
    config
  );
  for await (let bar of bars) {
    yield entityv2.AlpacaBarV2(bar);
  }
}

module.exports = {
  getTrades,
  getQuotes,
  getBars,
};
