import axios, { AxiosResponse } from "axios";
import {
  AlpacaTradeV2,
  AlpacaBarV2,
  AlpacaQuoteV2,
  AlpacaSnapshotV2,
  AlpacaCryptoTrade,
  AlpacaCryptoQuote,
  AlpacaCryptoBar,
  AlpacaCryptoOrderbook,
  CryptoQuote,
  CryptoTrade,
  CryptoBar,
  CryptoSnapshot,
  CryptoOrderbook,
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
  ALL = "all",
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
      throw new Error(
        `code: ${err.response?.status || err.statusCOode}, message: ${
          err.response?.data.message
        }`
      );
    });
}

function getQueryLimit(totalLimit: number, pageLimit: number, received: number): number {
  let limit = 0;
  if (pageLimit !== 0) {
    limit = pageLimit;
  }
  if (totalLimit !== 0) {
    const remaining = totalLimit - received;
    if (remaining <= 0) {
      // this should never happen
      return -1;
    }
    if (limit == 0 || limit > remaining) {
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
  const pageLimit = options.pageLimit
    ? Math.min(options.pageLimit, V2_MAX_LIMIT)
    : V2_MAX_LIMIT;

  delete options.pageLimit;
  options.limit = options.limit ?? 0;

  while (options.limit > received || options.limit === 0) {
    let limit;

    if (options.limit !== 0) {
      limit = getQueryLimit(options.limit, pageLimit, received);

      if (limit == -1) {
        break;
      }
    } else {
      limit = null;
    }

    const resp: AxiosResponse<any> = await dataV2HttpRequest(
      path,
      { ...options, limit, page_token: pageToken },
      config
    );

    const items = resp.data[endpoint] || [];

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
  url: string,
  endpoint: string,
  options: any,
  config: any
): AsyncGenerator<{ symbol: string; data: any }, void, unknown> {
  let pageToken: string | null = null;
  let received = 0;
  const pageLimit = options.pageLimit
    ? Math.min(options.pageLimit, V2_MAX_LIMIT)
    : V2_MAX_LIMIT;
  delete options.pageLimit;
  options.limit = options.limit ?? 0;
  while (options.limit > received || options.limit === 0) {
    let limit;
    if (options.limit !== 0) {
      limit = getQueryLimit(options.limit, pageLimit, received);
      if (limit == -1) {
        break;
      }
    } else {
      limit = null;
    }
    const params: any = {
      ...options,
      symbols: symbols.join(","),
      limit: limit,
      page_token: pageToken,
    };
    const resp = await dataV2HttpRequest(`${url}${endpoint}`, params, config);
    const items = resp.data[endpoint];
    for (const symbol in items) {
      for (const data of items[symbol]) {
        received++;
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
  asof?: string;
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
  const multiTrades = getMultiDataV2(
    symbols,
    "/v2/stocks/",
    TYPE.TRADES,
    options,
    config
  );
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
  asof?: string;
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
  const multiQuotes = getMultiDataV2(
    symbols,
    "/v2/stocks/",
    TYPE.QUOTES,
    options,
    config
  );
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
  asof?: string;
  page_token?: string;
}

export async function* getBars(
  symbol: string,
  options: GetBarsParams,
  config: any
): AsyncGenerator<AlpacaBar, void, unknown> {
  const bars = getDataV2(TYPE.BARS, `/v2/stocks/${symbol}/${TYPE.BARS}`, options, config);

  for await (const bar of bars || []) {
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
  const multiBars = getMultiDataV2(symbols, "/v2/stocks/", TYPE.BARS, options, config);
  for await (const b of multiBars) {
    b.data = { ...b.data, S: b.symbol };
    yield AlpacaBarV2(b.data);
  }
}

export async function getLatestTrade(symbol: string, config: any): Promise<AlpacaTrade> {
  const resp = await dataV2HttpRequest(`/v2/stocks/${symbol}/trades/latest`, {}, config);
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

export async function getLatestQuote(symbol: string, config: any): Promise<AlpacaQuote> {
  const resp = await dataV2HttpRequest(`/v2/stocks/${symbol}/quotes/latest`, {}, config);
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

export async function getLatestBar(symbol: string, config: any): Promise<AlpacaBar> {
  const resp = await dataV2HttpRequest(`/v2/stocks/${symbol}/bars/latest`, {}, config);
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

export async function getSnapshot(symbol: string, config: any): Promise<AlpacaSnapshot> {
  const resp = await dataV2HttpRequest(`/v2/stocks/${symbol}/snapshot`, {}, config);

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
  const result = Object.entries(resp.data as Map<string, any>).map(([key, val]) => {
    return AlpacaSnapshotV2({ symbol: key, ...val });
  });
  return result;
}

export interface GetCryptoTradesParams {
  start: string;
  end?: string;
  limit?: number;
  page_limit?: number;
}

export async function getCryptoTrades(
  symbols: string[],
  options: GetCryptoTradesParams,
  config: any
): Promise<Map<string, any[]>> {
  const cryptoTrades = getMultiDataV2(
    symbols,
    "/v1beta3/crypto/us/",
    TYPE.TRADES,
    options,
    config
  );
  const trades = new Map<string, Array<any>>();
  for await (const t of cryptoTrades) {
    const items = trades.get(t.symbol) || new Array<any>();
    trades.set(t.symbol, [...items, AlpacaCryptoTrade(t.data)]);
  }

  return trades;
}

export interface GetCryptoBarsParams {
  start?: string;
  end?: string;
  timeframe: string;
  limit?: number;
  page_limit?: number;
}

export async function getCryptoBars(
  symbols: string[],
  options: GetCryptoBarsParams,
  config: any
): Promise<Map<string, CryptoBar[]>> {
  const cryptoBars = getMultiDataV2(
    symbols,
    "/v1beta3/crypto/us/",
    TYPE.BARS,
    options,
    config
  );
  const bars = new Map<string, Array<CryptoBar>>();
  for await (const t of cryptoBars) {
    const items = bars.get(t.symbol) || new Array<CryptoBar>();
    bars.set(t.symbol, [...items, AlpacaCryptoBar(t.data)]);
  }
  return bars;
}

export async function getLatestCryptoBars(
  symbols: Array<string>,
  config: any
): Promise<Map<string, CryptoBar>> {
  const params = { symbols: symbols.join(",") };
  const resp = await dataV2HttpRequest(`/v1beta3/crypto/us/latest/bars`, params, config);

  const multiLatestCryptoBars = resp.data.bars;
  const result = new Map<string, CryptoBar>();
  for (const symbol in multiLatestCryptoBars) {
    const bar = multiLatestCryptoBars[symbol];
    result.set(symbol, AlpacaCryptoBar(bar));
  }

  return result;
}

export async function getLatestCryptoTrades(
  symbols: Array<string>,
  config: any
): Promise<Map<string, CryptoTrade>> {
  const params = { symbols: symbols.join(",") };
  const resp = await dataV2HttpRequest(
    `/v1beta3/crypto/us/latest/trades`,
    params,
    config
  );

  const multiLatestCryptoTrades = resp.data.trades;
  const result = new Map<string, CryptoTrade>();
  for (const symbol in multiLatestCryptoTrades) {
    const trade = multiLatestCryptoTrades[symbol];
    result.set(symbol, AlpacaCryptoTrade(trade));
  }

  return result;
}

export async function getLatestCryptoQuotes(
  symbols: Array<string>,
  config: any
): Promise<Map<string, CryptoQuote>> {
  const params = { symbols: symbols.join(",") };
  const resp = await dataV2HttpRequest(
    `/v1beta3/crypto/us/latest/quotes`,
    params,
    config
  );

  const multiLatestCryptoQuotes = resp.data.quotes;
  const result = new Map<string, CryptoQuote>();
  for (const symbol in multiLatestCryptoQuotes) {
    const quote = multiLatestCryptoQuotes[symbol];
    result.set(symbol, AlpacaCryptoQuote(quote));
  }

  return result;
}

export async function getCryptoSnapshots(
  symbols: Array<string>,
  config: any
): Promise<Map<string, CryptoSnapshot>> {
  const params = { symbols: symbols.join(",") };
  const resp = await dataV2HttpRequest(`/v1beta3/crypto/us/snapshots`, params, config);
  const snapshots = resp.data.snapshots;
  const result = new Map<string, CryptoSnapshot>();
  for (const symbol in snapshots) {
    const snapshot = snapshots[symbol];
    result.set(symbol, AlpacaCryptoSnapshot(snapshot));
  }
  return result;
}

export async function getLatestCryptoOrderbooks(
  symbols: Array<string>,
  config: any
): Promise<Map<string, CryptoOrderbook>> {
  const params = { symbols: symbols.join(",") };
  const resp = await dataV2HttpRequest(
    `/v1beta3/crypto/us/latest/orderbooks`,
    params,
    config
  );
  const orderbooks = resp.data.orderbooks;
  const result = new Map<string, CryptoOrderbook>();
  for (const symbol in orderbooks) {
    const orderbook = orderbooks[symbol];
    result.set(symbol, AlpacaCryptoOrderbook(orderbook));
  }
  return result;
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
  totalLimit?: number;
  // PageLimit is the pagination size. If empty, the default page size will be used.
  pageLimit?: number;
}

function getNewsParams(options: GetNewsParams): any {
  const query = {} as any;
  query.symbols = options.symbols?.length > 0 ? options.symbols.join(",") : null;
  query.start = options.start;
  query.end = options.end;
  query.sort = options.sort;
  query.includeContent = options.includeContent;
  query.excludeContentless = options.excludeContentless;
  return query;
}

export async function getNews(
  options: GetNewsParams,
  config: any
): Promise<AlpacaNews[]> {
  if (options.totalLimit && options.totalLimit < 0) {
    throw new Error("negative total limit");
  }
  if (options.pageLimit && options.pageLimit < 0) {
    throw new Error("negative page limit");
  }

  let pageToken: string | null = null;
  let received = 0;
  const pageLimit = options.pageLimit
    ? Math.min(options.pageLimit, V2_NEWS_MAX_LIMIT)
    : V2_NEWS_MAX_LIMIT;
  delete options.pageLimit;
  const totalLimit = options.totalLimit ?? 10;
  const result: AlpacaNews[] = [];
  const params = getNewsParams(options);
  let limit;
  for (;;) {
    limit = getQueryLimit(totalLimit, pageLimit, received);
    if (limit < 1) {
      break;
    }

    const resp: AxiosResponse<any> = await dataV2HttpRequest(
      "/v1beta1/news",
      { ...params, limit: limit, page_token: pageToken },
      config
    );
    resp.data.news.forEach((n: RawAlpacaNews) => result.push(AlpacaNews(n)));
    received += resp.data.news.length;
    pageToken = resp.data.next_page_token;
    if (!pageToken) {
      break;
    }
  }
  return result;
}
