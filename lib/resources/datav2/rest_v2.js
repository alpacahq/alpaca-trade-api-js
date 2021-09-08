const axios = require("axios").default;
const entityv2 = require("./entityv2");

// Number of data points to return.
const V2_MAX_LIMIT = 10000;

const TYPE = {
  TRADES: "trades",
  QUOTES: "quotes",
  BARS: "bars",
};

function dataV2HttpRequest(url, queryParams, config) {
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
      throw new Error(err);
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
    const resp = await dataV2HttpRequest(
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

async function* getMultiDataV2(endpoint, options = {}, config) {
  let pageToken = null;
  while (true) {
    let params = options;
    Object.assign(params, { limit: options.limit, page_token: pageToken });

    const resp = await dataV2HttpRequest(
      `/v2/stocks/${endpoint}`,
      params,
      config
    );
    const items = resp.data[endpoint];
    for (const symbol in items) {
      for (const data of items[symbol]) {
        yield { symbol: symbol, data: data };
      }
    }
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

async function getMultiTrades(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiTrades = getMultiDataV2(TYPE.TRADES, options, config);
  let trades = {};
  for await (let t of multiTrades) {
    if (!trades[t.symbol]) {
      trades[t.symbol] = [entityv2.AlpacaTradeV2(t.data)];
    } else {
      tradesSoFar = trades[t.symbol];
      tradesSoFar.push(entityv2.AlpacaTradeV2(t.data));
      trades[t.symbol] = tradesSoFar;
    }
  }
  return trades;
}

async function* getMultiTradesAsync(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiTrades = getMultiDataV2(TYPE.TRADES, options, config);
  for await (let t of multiTrades) {
    Object.assign(t.data, { S: t.symbol });
    yield entityv2.AlpacaTradeV2(t.data);
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

async function getMultiQuotes(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiQuotes = getMultiDataV2(TYPE.QUOTES, options, config);
  let quotes = {};
  for await (let q of multiQuotes) {
    if (!quotes[q.symbol]) {
      quotes[q.symbol] = [entityv2.AlpacaQuoteV2(q.data)];
    } else {
      quotesSoFar = quotes[q.symbol];
      quotesSoFar.push(entityv2.AlpacaQuoteV2(q.data));
      quotes[q.symbol] = quotesSoFar;
    }
  }
  return quotes;
}

async function* getMultiQuotesAsync(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiQuotes = getMultiDataV2(TYPE.QUOTES, options, config);
  for await (let q of multiQuotes) {
    Object.assign(q.data, { S: q.symbol });
    yield entityv2.AlpacaQuoteV2(q.data);
  }
}

async function* getBars(symbol, options, config) {
  const bars = getDataV2(TYPE.BARS, symbol, options, config);
  for await (let bar of bars) {
    yield entityv2.AlpacaBarV2(bar);
  }
}

async function getMultiBars(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiBars = getMultiDataV2(TYPE.BARS, options, config);
  let bars = {};
  for await (let b of multiBars) {
    if (!bars[b.symbol]) {
      bars[b.symbol] = [entityv2.AlpacaBarV2(b.data)];
    } else {
      barsSoFar = bars[b.symbol];
      barsSoFar.push(entityv2.AlpacaBarV2(b.data));
      bars[b.symbol] = barsSoFar;
    }
  }
  return bars;
}

async function* getMultiBarsAsync(symbols, options, config) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  Object.assign(options, { symbols: symbols.join() });
  const multiBars = getMultiDataV2(TYPE.BARS, options, config);
  for await (let b of multiBars) {
    Object.assign(b.data, { S: b.symbol });
    yield entityv2.AlpacaBarV2(b.data);
  }
}

async function getLatestTrade(symbol, config) {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/trades/latest`,
    {},
    config
  );
  if (resp.data) {
    return entityv2.AlpacaTradeV2(resp.data.trade);
  }
}

async function getLatestQuote(symbol, config) {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/quotes/latest`,
    {},
    config
  );
  if (resp.data) {
    return entityv2.AlpacaQuoteV2(resp.data.quote);
  }
}

async function getSnapshot(symbol, config) {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/snapshot`,
    {},
    config
  );

  return entityv2.AlpacaSnaphotV2(resp.data);
}

async function getSnapshots(symbols, config) {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/snapshots?symbols=${symbols.join(",")}`,
    {},
    config
  );

  const result = Object.entries(resp.data).map(([key, val]) => {
    return entityv2.AlpacaSnaphotV2({
      symbol: key,
      ...val,
    });
  });

  return result;
}

module.exports = {
  getTrades,
  getMultiTrades,
  getMultiTradesAsync,
  getQuotes,
  getMultiQuotes,
  getMultiQuotesAsync,
  getBars,
  getMultiBars,
  getMultiBarsAsync,
  getLatestTrade,
  getLatestQuote,
  getSnapshot,
  getSnapshots,
};
