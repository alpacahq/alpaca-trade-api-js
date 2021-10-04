const axios = require("axios").default;
const entityv2 = require("./entityv2");

// Number of data points to return.
const V2_MAX_LIMIT = 10000;

const TYPE = {
  TRADES: "trades",
  QUOTES: "quotes",
  BARS: "bars",
};

const ADJUSTMENT = {
  RAW: "raw",
  DIVIDEND: "dividend",
  SPLIT: "split",
  BOTH: "both",
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
      let message = err.message;
      if (err.response.statusText) {
        message += "\n" + err.response.statusText;
      }
      throw new Error(message);
    });
  return resp;
}

async function* getDataV2(endpoint, path, options = {}, config) {
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
    const resp = await dataV2HttpRequest(`${path}`, params, config);
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
    let params = {
      ...options,
      limit: options.pageLimit,
      page_token: pageToken,
    };

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
    `/v2/stocks/${symbol}/${TYPE.TRADES}`,
    { start: options.start, end: options.end, limit: options.limit },
    config
  );
  for await (let trade of trades) {
    yield entityv2.AlpacaTradeV2(trade);
  }
}

async function getMultiTrades(
  symbols,
  options = { start: null, end: null, pageLimit: null, feed: null },
  config
) {
  const multiTrades = getMultiTradesAsync(symbols, options, config);
  let trades = {};
  for await (let t of multiTrades) {
    const items = trades[t.Symbol] || [];
    trades[t.Symbol] = [...items, t];
  }
  return trades;
}

async function* getMultiTradesAsync(
  symbols,
  options = { start: null, end: null, pageLimit: null, feed: null },
  config
) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  options = { ...options, symbols: symbols.join() };
  const multiTrades = getMultiDataV2(TYPE.TRADES, options, config);
  for await (let t of multiTrades) {
    t.data = { ...t.data, S: t.symbol };
    yield entityv2.AlpacaTradeV2(t.data);
  }
}

async function* getQuotes(symbol, options, config) {
  const quotes = getDataV2(
    TYPE.QUOTES,
    `/v2/stocks/${symbol}/${TYPE.QUOTES}`,
    { start: options.start, end: options.end, limit: options.limit },
    config
  );
  for await (let quote of quotes) {
    yield entityv2.AlpacaQuoteV2(quote);
  }
}

async function getMultiQuotes(
  symbols,
  options = { start: null, end: null, pageLimit: null, feed: null },
  config
) {
  const multiQuotes = getMultiQuotesAsync(symbols, options, config);
  let quotes = {};
  for await (let q of multiQuotes) {
    const items = quotes[q.Symbol] || [];
    quotes[q.Symbol] = [...items, q];
  }
  return quotes;
}

async function* getMultiQuotesAsync(
  symbols,
  options = { start: null, end: null, pageLimit: null, feed: null },
  config
) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  options = { ...options, symbols: symbols.join() };
  const multiQuotes = getMultiDataV2(TYPE.QUOTES, options, config);
  for await (let q of multiQuotes) {
    q.data = { ...q.data, S: q.symbol };
    yield entityv2.AlpacaQuoteV2(q.data);
  }
}

async function* getBars(symbol, options, config) {
  const bars = getDataV2(
    TYPE.BARS,
    `/v2/stocks/${symbol}/${TYPE.BARS}`,
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

async function getMultiBars(
  symbols,
  options = {
    start: null,
    end: null,
    timeframe: null,
    adjustment: null,
    pageLimit: null,
    feed: null,
  },
  config
) {
  const multiBars = getMultiBarsAsync(symbols, options, config);
  let bars = {};
  for await (let b of multiBars) {
    const items = bars[b.Symbol] || [];
    bars[b.Symbol] = [...items, b];
  }
  return bars;
}

async function* getMultiBarsAsync(
  symbols,
  options = {
    start: null,
    end: null,
    timeframe: null,
    adjustment: null,
    pageLimit: null,
    feed: null,
  },
  config
) {
  if (!Array.isArray(symbols)) {
    throw new Error("symbols should be an array");
  }
  options = { ...options, symbols: symbols.join() };
  const multiBars = getMultiDataV2(TYPE.BARS, options, config);
  for await (let b of multiBars) {
    b.data = { ...b.data, S: b.symbol };
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

async function* getCryptoTrades(
  symbol,
  options = { start: null, end: null, limit: null, exchanges: null },
  config
) {
  if (options.exchanges != null && !Array.isArray(options.exchanges)) {
    throw new Error("exchanges should be a list of strings");
  }
  const cryptoTrades = getDataV2(
    TYPE.TRADES,
    `/v1beta1/crypto/${symbol}/trades`,
    { start: options.start, end: options.end, limit: options.limit },
    config
  );
  for await (let t of cryptoTrades) {
    yield entityv2.AlpacaCryptoTrade({ S: symbol, ...t });
  }
}

async function* getCryptoQuotes(
  symbol,
  options = { start: null, end: null, limit: null, exchanges: null },
  config
) {
  if (options.exchanges != null && !Array.isArray(options.exchanges)) {
    throw new Error("exchanges should be a list of strings");
  }
  const cryptoQuotes = getDataV2(
    TYPE.QUOTES,
    `/v1beta1/crypto/${symbol}/quotes`,
    options,
    config
  );
  for await (const q of cryptoQuotes) {
    yield entityv2.AlpacaCryptoQuote({ S: symbol, ...q });
  }
}

async function* getCryptoBars(
  symbol,
  options = {
    start: null,
    end: null,
    timeframe: null,
    limit: null,
    exchanges: null,
  },
  config
) {
  if (options.timeframe == null) {
    throw new Error("timeframe is required  ");
  }
  if (options.exchanges != null && !Array.isArray(options.exchanges)) {
    throw new Error("exchanges should be a list of strings");
  }
  const cryptoBars = getDataV2(
    TYPE.BARS,
    `/v1beta1/crypto/${symbol}/bars`,
    options,
    config
  );
  if (Symbol.iterator in Object(cryptoBars)) {
    for await (const b of cryptoBars) {
      yield entityv2.AlpacaCryptoBar({ S: symbol, ...b });
    }
  }
}

async function getLatestCryptoTrade(
  symbol,
  options = { exchange: null },
  config
) {
  if (options.exchange == null) {
    throw new Error("exchange is required");
  }
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/trades/latest`,
    options,
    config
  );
  return entityv2.AlpacaCryptoTrade({
    S: resp.data.symbol,
    ...resp.data.trade,
  });
}

async function getLatestCryptoQuote(
  symbol,
  options = { exchange: null },
  config
) {
  if (options.exchange == null) {
    throw new Error("exchange is required");
  }
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/quotes/latest`,
    options,
    config
  );
  console.log(resp.data);
  return entityv2.AlpacaCryptoQuote({
    S: resp.data.symbol,
    ...resp.data.quote,
  });
}

async function getLatestCryptoXBBO(
  symbol,
  options = { exchanges: null },
  config
) {
  if (!Array.isArray(options.exchanges)) {
    throw new Error("exchanges should be a list of strings");
  }
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/xbbo/latest`,
    { exchanges: options.exchanges.join(",") },
    config
  );
  return entityv2.AlpacaCryptoXBBO({ S: resp.data.symbol, ...resp.data.xbbo });
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
  getCryptoTrades,
  getCryptoBars,
  getCryptoQuotes,
  getLatestCryptoTrade,
  getLatestCryptoQuote,
  getLatestCryptoXBBO,
  ADJUSTMENT,
};
