import axios, { AxiosResponse } from "axios";
import {
  AlpacaTradeV2,
  AlpacaBarV2,
  AlpacaQuoteV2,
  AlpacaSnaphotV2,
  AlpacaCryptoTrade,
  AlpacaCryptoQuote,
  AlpacaCryptoBar,
  AlpacaCryptoXBBO,
  CryptoXBBO,
  CryptoQuote,
  CryptoTrade,
  CryptoBar,
  AlpacaSnapshot,
  AlapacaQuote,
  AlpacaTrade,
  AlpacaBar,
} from "./entityv2";

// Number of data points to return.
const V2_MAX_LIMIT = 10000;

export enum Adjustment {
  RAW = "raw",
  DIVIDEND = "dividend",
  SPLIT = "split",
  BOTH = "both",
}

export enum TYPE {
  TRADES = "trades",
  QUOTES = "quotes",
  BARS = "bars",
}

export function dataV2HttpRequest(
  url: string,
  queryParams: any,
  config: any
): Promise<AxiosResponse<any>> {
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
    .catch((err: any) => {
      throw new Error(err.message);
    });
  return resp;
}

export async function* getDataV2(
  endpoint: TYPE,
  path: string,
  options: any,
  config: any
): AsyncGenerator<any, void, unknown> {
  let pageToken: string | null = null;
  let totalItems = 0;
  const limit = options.limit;
  while (true) {
    let actualLimit: number | null = null;
    if (limit) {
      actualLimit = Math.min(limit - totalItems, V2_MAX_LIMIT);
      if (actualLimit < 1) {
        break;
      }
    }
    Object.assign(options, { limit: actualLimit, page_token: pageToken });
    const resp = await dataV2HttpRequest(`${path}`, options, config);
    const items = resp.data[endpoint];
    for (const item of items) {
      yield item;
    }
    totalItems += items.length;
    pageToken = resp.data.next_page_token;
    if (!pageToken) {
      break;
    }
  }
}

export async function* getMultiDataV2(
  symbols: Array<string>,
  endpoint: string,
  options: any,
  config: any
): AsyncGenerator<
  {
    symbol: string;
    data: any;
  },
  void,
  unknown
> {
  let pageToken = null;
  while (true) {
    const params: any = {
      ...options,
      symbols: symbols.join(","),
      limit: options.page_limit,
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

export interface GetTradesParams {
  start: string;
  end?: string;
  page_limit?: number;
  limit?: number;
  feed?: string;
  page_token?: string;
}

export async function* getTrades(
  symbol: string,
  options: GetTradesParams,
  config: any
): AsyncGenerator<AlpacaTrade, void, unknown> {
  const trades = getDataV2(
    TYPE.TRADES,
    `/v2/stocks/${symbol}/${TYPE.TRADES}`,
    options,
    config
  );
  for await (const trade of trades) {
    yield AlpacaTradeV2(trade);
  }
}

export async function getMultiTrades(
  symbols: Array<string>,
  options: GetTradesParams,
  config: any
): Promise<Map<string, any[]>> {
  const multiTrades = getMultiTradesAsync(symbols, options, config);
  const trades = new Map<string, Array<any>>();
  for await (const t of multiTrades) {
    const items = trades.get(t.Symbol) || new Array<any>();
    trades.set(t.Symbol, [...items, t]);
  }
  return trades;
}

export async function* getMultiTradesAsync(
  symbols: Array<string>,
  options: GetTradesParams,
  config: any
): AsyncGenerator<AlpacaTrade, void, unknown> {
  const multiTrades = getMultiDataV2(symbols, TYPE.TRADES, options, config);
  for await (const t of multiTrades) {
    t.data = { ...t.data, S: t.symbol };
    yield AlpacaTradeV2(t.data);
  }
}

export interface GetQoutesParams {
  start: string;
  end?: string;
  page_limit?: number;
  limit?: number;
  feed?: string;
  page_token?: string;
}

export async function* getQuotes(
  symbol: string,
  options: GetQoutesParams,
  config: any
): AsyncGenerator<AlapacaQuote, void, unknown> {
  const quotes = getDataV2(
    TYPE.QUOTES,
    `/v2/stocks/${symbol}/${TYPE.QUOTES}`,
    options,
    config
  );
  for await (const quote of quotes) {
    yield AlpacaQuoteV2(quote);
  }
}

export async function getMultiQuotes(
  symbols: Array<string>,
  options: GetQoutesParams,
  config: any
): Promise<Map<string, any[]>> {
  const multiQuotes = getMultiQuotesAsync(symbols, options, config);
  const quotes = new Map<string, Array<any>>();
  for await (const q of multiQuotes) {
    const items = quotes.get(q.Symbol) || new Array<any>();
    quotes.set(q.Symbol, [...items, q]);
  }
  return quotes;
}

export async function* getMultiQuotesAsync(
  symbols: Array<string>,
  options: GetQoutesParams,
  config: any
): AsyncGenerator<AlapacaQuote, void, unknown> {
  const multiQuotes = getMultiDataV2(symbols, TYPE.QUOTES, options, config);
  for await (const q of multiQuotes) {
    q.data = { ...q.data, S: q.symbol };
    yield AlpacaQuoteV2(q.data);
  }
}

export interface GetBarsParams {
  timeframe: string;
  adjustment?: Adjustment;
  start: string;
  end?: string;
  page_limit?: number;
  limit?: number;
  feed?: string;
  page_token?: string;
}

export async function* getBars(
  symbol: string,
  options: GetBarsParams,
  config: any
): AsyncGenerator<AlpacaBar, void, unknown> {
  const bars = getDataV2(
    TYPE.BARS,
    `/v2/stocks/${symbol}/${TYPE.BARS}`,
    options,
    config
  );

  for await (const bar of bars) {
    yield AlpacaBarV2(bar);
  }
}

export async function getMultiBars(
  symbols: Array<string>,
  options: GetBarsParams,
  config: any
): Promise<Map<string, any[]>> {
  const multiBars = getMultiBarsAsync(symbols, options, config);
  const bars = new Map<string, Array<any>>();
  for await (const b of multiBars) {
    const items = bars.get(b.Symbol) || new Array<any>();
    bars.set(b.Symbol, [...items, b]);
  }
  return bars;
}

export async function* getMultiBarsAsync(
  symbols: Array<string>,
  options: GetBarsParams,
  config: any
): AsyncGenerator<AlpacaBar, void, unknown> {
  const multiBars = getMultiDataV2(symbols, TYPE.BARS, options, config);
  for await (const b of multiBars) {
    b.data = { ...b.data, S: b.symbol };
    yield AlpacaBarV2(b.data);
  }
}

export async function getLatestTrade(
  symbol: string,
  config: any
): Promise<AlpacaTrade> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/trades/latest`,
    {},
    config
  );
  return AlpacaTradeV2(resp.data.trade);
}

export async function getLatestQuote(
  symbol: string,
  config: any
): Promise<AlapacaQuote> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/quotes/latest`,
    {},
    config
  );
  return AlpacaQuoteV2(resp.data.quote);
}

export async function getSnapshot(
  symbol: string,
  config: any
): Promise<AlpacaSnapshot> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/snapshot`,
    {},
    config
  );

  return AlpacaSnaphotV2(resp.data);
}

export async function getSnapshots(
  symbols: Array<string>,
  config: any
): Promise<AlpacaSnapshot[]> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/snapshots?symbols=${symbols.join(",")}`,
    {},
    config
  );

  const result = Object.entries(resp.data as Map<string, any>).map(
    ([key, val]) => {
      return AlpacaSnaphotV2({
        symbol: key,
        ...val,
      });
    }
  );

  return result;
}

export interface GetCryptoTradesParams {
  start: string;
  end?: string;
  limit?: number;
  page_limit?: number;
  exchanges?: Array<string>;
}

export async function* getCryptoTrades(
  symbol: string,
  options: GetCryptoTradesParams,
  config: any
): AsyncGenerator<CryptoTrade, void, unknown> {
  const cryptoTrades = getDataV2(
    TYPE.TRADES,
    `/v1beta1/crypto/${symbol}/trades`,
    options,
    config
  );
  for await (const t of cryptoTrades) {
    yield AlpacaCryptoTrade({ S: symbol, ...t });
  }
}

export interface GetCryptoQuotesParams {
  start: string;
  end?: string;
  limit?: number;
  page_limit?: number;
  exchanges?: Array<string>;
}

export async function* getCryptoQuotes(
  symbol: string,
  options: GetCryptoQuotesParams,
  config: any
): AsyncGenerator<CryptoQuote, void, unknown> {
  const cryptoQuotes = getDataV2(
    TYPE.QUOTES,
    `/v1beta1/crypto/${symbol}/quotes`,
    options,
    config
  );
  for await (const q of cryptoQuotes) {
    yield AlpacaCryptoQuote({ S: symbol, ...q });
  }
}

export interface GetCryptoBarsParams {
  start: string;
  end?: string;
  timeframe: string;
  limit?: number;
  page_limit?: number;
  exchanges?: Array<string>;
}

export async function* getCryptoBars(
  symbol: string,
  options: GetCryptoBarsParams,
  config: any
): AsyncGenerator<CryptoBar, void, unknown> {
  const cryptoBars = getDataV2(
    TYPE.BARS,
    `/v1beta1/crypto/${symbol}/bars`,
    options,
    config
  );
  if (Symbol.iterator in Object(cryptoBars)) {
    for await (const b of cryptoBars) {
      yield AlpacaCryptoBar({ S: symbol, ...b });
    }
  }
}

export async function getLatestCryptoTrade(
  symbol: string,
  options: { exchange: string },
  config: any
): Promise<CryptoTrade> {
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/trades/latest`,
    options,
    config
  );
  return AlpacaCryptoTrade({
    S: resp.data.symbol,
    ...resp.data.trade,
  });
}

export async function getLatestCryptoQuote(
  symbol: string,
  options: { exchange: string },
  config: any
): Promise<CryptoQuote> {
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/quotes/latest`,
    options,
    config
  );
  return AlpacaCryptoQuote({
    S: resp.data.symbol,
    ...resp.data.quote,
  });
}

export async function getLatestCryptoXBBO(
  symbol: string,
  options: { exchanges?: Array<string> },
  config: any
): Promise<CryptoXBBO> {
  const params = { exchanges: options.exchanges?.join(",") };
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/xbbo/latest`,
    params,
    config
  );
  return AlpacaCryptoXBBO({ S: resp.data.symbol, ...resp.data.xbbo });
}
