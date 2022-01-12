import axios, { AxiosResponse } from "axios";
import {
  AlpacaTradeV2,
  AlpacaBarV2,
  AlpacaQuoteV2,
  AlpacaSnapshotV2,
  AlpacaCryptoTrade,
  AlpacaCryptoQuote,
  AlpacaCryptoBar,
  AlpacaCryptoXBBO,
  CryptoXBBO,
  CryptoQuote,
  CryptoTrade,
  CryptoBar,
  CryptoSnapshot,
  AlpacaSnapshot,
  AlpacaQuote,
  AlpacaTrade,
  AlpacaBar,
  AlpacaCryptoSnapshot,
  AlpacaNews,
  RawAlpacaNews,
} from "./entityv2";

// Number of data points to return.
const V2_MAX_LIMIT = 10000;
const V2_NEWS_MAX_LIMIT = 50;

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
  const headers: any = {
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  };
  if (oauth == "") {
    headers["APCA-API-KEY-ID"] = keyId;
    headers["APCA-API-SECRET-KEY"] = secretKey;
  } else {
    headers["Authorization"] = "Bearer " + oauth;
  }
  return axios
    .get(`${dataBaseUrl}${url}`, {
      params: queryParams,
      headers: headers,
    })
    .catch((err: any) => {
      throw new Error(err.message);
    });
}

function getQueryLimit(
  totalLimit: number,
  pageLimit: number,
  received: number,
  maxLimit: number
): number {
  let limit = 0;
  if (pageLimit !== 0) {
    limit = pageLimit;
  }
  if (totalLimit !== 0) {
    const remaining = totalLimit - received;
    if (remaining <= 0) {
      return -1;
    }
    if ((limit == 0 || limit > remaining) && remaining <= maxLimit) {
      limit = remaining;
    }
  }

  return limit;
}

export async function* getDataV2(
  endpoint: TYPE,
  path: string,
  options: any,
  config: any
): AsyncGenerator<any, void, unknown> {
  let pageToken: string | null = null;
  let received = 0;
  let pageLimit = 0;
  const maxLimit = options.max_limit ?? V2_MAX_LIMIT;
  delete options.maxLimit;
  const totalLimit = options.limit
    ? Math.min(options.limit, V2_MAX_LIMIT)
    : V2_MAX_LIMIT;
  if (options.pageLimit > 0) {
    pageLimit = options.pageLimit;
    delete options.pageLimit;
  }
  while (true) {
    const limit = getQueryLimit(totalLimit, pageLimit, received, maxLimit);
    if (limit < 1) {
      break;
    }

    options = { ...options, limit: limit, page_token: pageToken };
    const resp = await dataV2HttpRequest(path, options, config);
    const items = resp.data[endpoint];
    for (const item of items) {
      yield item;
    }
    received += items.length;
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
): AsyncGenerator<{ symbol: string; data: any }, void, unknown> {
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

export interface GetQuotesParams {
  start: string;
  end?: string;
  page_limit?: number;
  limit?: number;
  feed?: string;
  page_token?: string;
}

export async function* getQuotes(
  symbol: string,
  options: GetQuotesParams,
  config: any
): AsyncGenerator<AlpacaQuote, void, unknown> {
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
  options: GetQuotesParams,
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
  options: GetQuotesParams,
  config: any
): AsyncGenerator<AlpacaQuote, void, unknown> {
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

export async function getLatestTrades(
  symbols: Array<string>,
  config: any
): Promise<Map<string, AlpacaTrade>> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${TYPE.TRADES}/latest`,
    { symbols: symbols.join(",") },
    config
  );
  const multiLatestTrades = resp.data.trades;
  const multiLatestTradesResp = new Map<string, AlpacaTrade>();
  for (const symbol in multiLatestTrades) {
    multiLatestTradesResp.set(
      symbol,
      AlpacaTradeV2({ S: symbol, ...multiLatestTrades[symbol] })
    );
  }
  return multiLatestTradesResp;
}

export async function getLatestQuote(
  symbol: string,
  config: any
): Promise<AlpacaQuote> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/quotes/latest`,
    {},
    config
  );
  return AlpacaQuoteV2(resp.data.quote);
}

export async function getLatestQuotes(
  symbols: Array<string>,
  config: any
): Promise<Map<string, AlpacaQuote>> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${TYPE.QUOTES}/latest`,
    { symbols: symbols.join(",") },
    config
  );
  const multiLatestQuotes = resp.data.quotes;
  const multiLatestQuotesResp = new Map<string, AlpacaQuote>();
  for (const symbol in multiLatestQuotes) {
    multiLatestQuotesResp.set(
      symbol,
      AlpacaQuoteV2({ S: symbol, ...multiLatestQuotes[symbol] })
    );
  }
  return multiLatestQuotesResp;
}

export async function getLatestBar(
  symbol: string,
  config: any
): Promise<AlpacaBar> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${symbol}/bars/latest`,
    {},
    config
  );
  return AlpacaBarV2(resp.data.bar);
}

export async function getLatestBars(
  symbols: Array<string>,
  config: any
): Promise<Map<string, AlpacaBar>> {
  const resp = await dataV2HttpRequest(
    `/v2/stocks/${TYPE.BARS}/latest`,
    { symbols: symbols.join(",") },
    config
  );
  const multiLatestBars = resp.data.bars;
  const multiLatestBarsResp = new Map<string, AlpacaBar>();
  for (const symbol in multiLatestBars) {
    multiLatestBarsResp.set(
      symbol,
      AlpacaBarV2({ S: symbol, ...multiLatestBars[symbol] })
    );
  }
  return multiLatestBarsResp;
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

  return AlpacaSnapshotV2(resp.data);
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
      return AlpacaSnapshotV2({ symbol: key, ...val });
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
  for await (const b of cryptoBars) {
    yield AlpacaCryptoBar({ S: symbol, ...b });
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

export async function getCryptoSnapshot(
  symbol: string,
  options: { exchange: string },
  config: any
): Promise<CryptoSnapshot> {
  const resp = await dataV2HttpRequest(
    `/v1beta1/crypto/${symbol}/snapshot`,
    options,
    config
  );

  return AlpacaCryptoSnapshot(resp.data);
}

export enum Sort {
  ASC = "asc",
  DESC = "desc",
}

export interface GetNewsParams {
  // Symbols filters the news to the related symbols.
  // If empty or nil, all articles will be returned.
  symbols: Array<string>;
  // Start is the inclusive beginning of the interval
  start?: string;
  // End is the inclusive end of the interval
  end?: string;
  // Sort sets the sort order of the results. Sorting will be done by the UpdatedAt field.
  sort?: Sort;
  // IncludeContent tells the server to include the article content in the response.
  includeContent?: boolean;
  // ExcludeContentless tells the server to exclude articles that has no content.
  excludeContentless?: boolean;
  // TotalLimit is the limit of the total number of the returned news.
  //
  // If it's zero then the NoTotalLimit parameter is considered: if NoTotalLimit is true,
  // then all the articles in the given start-end interval are returned.
  // If NoTotalLimit is false, then 50 articles will be returned.
  //
  // The reason for this complication is that the default (empty GetNewsParams) would
  // not return all the news articles.
  totalLimit?: number;
  // NoTotalLimit is only evaluated if TotalLimit is 0. See the documentation on TotalLimit
  // for more information.
  noTotalLimit?: boolean;
  // PageLimit is the pagination size. If empty, the default page size will be used.
  pageLimit?: number;
}

function getNewsParams(options: GetNewsParams): any {
  const query = {} as any;
  query.symbols = options.symbols?.length ? options.symbols : null;
  query.start = options.start ? options.start : null;
  query.end = options.end ? options.end : null;
  query.sort = options.sort ? options.sort : null;
  query.includeContent = options.includeContent ? options.includeContent : null;
  query.excludeContentless = options.excludeContentless
    ? options.excludeContentless
    : null;
}

export async function getNews(
  options: GetNewsParams,
  config: any
): Promise<AlpacaNews[]> {
  let pageToken: string | null = null;
  let received = 0;
  let pageLimit = 0;
  const result: AlpacaNews[] = [];
  const totalLimit = options.totalLimit
    ? Math.min(options.totalLimit, V2_NEWS_MAX_LIMIT)
    : V2_NEWS_MAX_LIMIT;
  if (options.pageLimit && options.pageLimit > 0) {
    pageLimit = options.pageLimit;
    delete options.pageLimit;
  }
  for (;;) {
    const limit = getQueryLimit(
      totalLimit,
      pageLimit,
      received,
      V2_NEWS_MAX_LIMIT
    );
    if (limit < 1) {
      break;
    }

    const params = getNewsParams(options);
    const resp: AxiosResponse<any> = await dataV2HttpRequest(
      "/v1beta1/news",
      { ...params, limit: limit, page_token: pageToken },
      config
    );
    resp.data.news.map((n: RawAlpacaNews) => result.push(AlpacaNews(n)));
    received += resp.data.news.length;
    pageToken = resp.data.next_page_token;
    if (!pageToken) {
      break;
    }
  }
  return result;
}
