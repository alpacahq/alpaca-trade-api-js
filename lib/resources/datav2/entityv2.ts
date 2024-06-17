import mapKeys from "lodash/mapKeys";
import mapValues from "lodash/mapValues";

const trade_mapping_v2 = {
  S: "Symbol",
  i: "ID",
  x: "Exchange",
  p: "Price",
  s: "Size",
  t: "Timestamp",
  c: "Conditions",
  z: "Tape",
};

export interface AlpacaTrade {
  Symbol: string;
  ID: number;
  Exchange: string;
  Price: number;
  Size: number;
  Timestamp: string;
  Conditions: Array<string>;
  Tape: string;
}

export interface RawTrade {
  T: string;
  S: string;
  i: number;
  x: string;
  p: number;
  s: number;
  t: string;
  c: Array<string>;
  z: string;
}

const quote_mapping_v2 = {
  S: "Symbol",
  bx: "BidExchange",
  bp: "BidPrice",
  bs: "BidSize",
  ax: "AskExchange",
  ap: "AskPrice",
  as: "AskSize",
  t: "Timestamp",
  c: "Conditions",
  z: "Tape",
};

export interface AlpacaQuote {
  Symbol: string;
  BidExchange: string;
  BidPrice: number;
  BidSize: number;
  AskExchange: string;
  AskPrice: number;
  AskSize: number;
  Timestamp: string;
  Conditions: Array<string>;
  Tape: string;
}

export interface RawQuote {
  T: string;
  S: string;
  bx: string;
  bp: number;
  bs: number;
  ax: string;
  ap: number;
  as: number;
  t: string;
  c: Array<string>;
  z: string;
}

const bar_mapping_v2 = {
  S: "Symbol",
  o: "OpenPrice",
  h: "HighPrice",
  l: "LowPrice",
  c: "ClosePrice",
  v: "Volume",
  t: "Timestamp",
  vw: "VWAP",
  n: "TradeCount",
};

export interface AlpacaBar {
  Symbol: string;
  OpenPrice: number;
  HighPrice: number;
  LowPrice: number;
  ClosePrice: number;
  Volume: number;
  Timestamp: string;
  VWAP: number;
  TradeCount: number;
}

export interface RawBar {
  T: string;
  S: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: string;
  vw: number;
  n: number;
}

const snapshot_mapping_v2 = {
  symbol: "symbol",
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  minuteBar: "MinuteBar",
  dailyBar: "DailyBar",
  prevDailyBar: "PrevDailyBar",
};

export interface AlpacaSnapshot {
  Symbol: string;
  LatestTrade: AlpacaTrade;
  LatestQuote: AlpacaQuote;
  MinuteBar: AlpacaBar;
  DailyBar: AlpacaBar;
  PrevDailyBar: AlpacaBar;
}

const status_mapping_v2 = {
  S: "Symbol",
  sc: "StatusCode",
  sm: "StatusMessage",
  rc: "ReasonCode",
  rm: "ReasonMessage",
  t: "Timestamp",
  z: "Tape",
};

export interface AlpacaStatus {
  Symbol: string;
  StatusCode: string;
  StatusMessage: string;
  ReasonCode: string;
  ReasonMessage: string;
  Timestamp: string;
  Tape: string;
}

export interface RawStatus {
  T: string;
  S: string;
  sc: string;
  sm: string;
  rc: string;
  rm: string;
  t: string;
  z: string;
}

const luld_mapping_v2 = {
  S: "Symbol",
  u: "LimitUpPrice",
  d: "LimitDownPrice",
  i: "Indicator",
  t: "Timestamp",
  z: "Tape",
};

export interface AlpacaLuld {
  Symbol: string;
  LimitUpPrice: number;
  LimitDownPrice: number;
  Indicator: string;
  Timestamp: string;
  Tape: string;
}

export interface RawLuld {
  T: string;
  S: string;
  u: number;
  d: number;
  i: string;
  t: string;
  z: string;
}

const cancel_error_mapping_v2 = {
  S: "Symbol",
  i: "ID",
  x: "Exchange",
  p: "Price",
  s: "Size",
  a: "CancelErrorAction",
  z: "Tape",
  t: "Timestamp",
};

export interface AlpacaCancelError {
  Symbol: string;
  ID: number;
  Exchange: string;
  Price: number;
  Size: number;
  CancelErrorAction: string;
  Tape: string;
  Timestamp: string;
}

export interface RawCancelError {
  T: string;
  S: string;
  i: number;
  x: string;
  p: number;
  s: number;
  a: string;
  z: string;
  t: string;
}

const correction_mapping_v2 = {
  S: "Symbol",
  x: "Exchange",
  oi: "OriginalID",
  op: "OriginalPrice",
  os: "OriginalSize",
  oc: "OriginalConditions",
  ci: "CorrectedID",
  cp: "CorrectedPrice",
  cs: "CorrectedSize",
  cc: "CorrectedConditions",
  z: "Tape",
  t: "Timestamp",
};

export interface AlpacaCorrection {
  Symbol: string;
  Exchange: string;
  OriginalID: number;
  OriginalPrice: number;
  OriginalSize: number;
  OriginalConditions: Array<string>;
  CorrectedID: number;
  CorrectedPrice: number;
  CorrectedSize: number;
  CorrectedConditions: Array<string>;
  Tape: string;
  Timestamp: string;
}

export interface RawCorrection {
  T: string;
  S: string;
  x: string;
  oi: number;
  op: number;
  os: number;
  oc: Array<string>;
  ci: number;
  cp: number;
  cs: number;
  cc: Array<string>;
  z: string;
  t: string;
}

const crypto_trade_mapping = {
  S: "Symbol",
  t: "Timestamp",
  x: "Exchange",
  p: "Price",
  s: "Size",
  tks: "TakerSide",
  i: "ID",
};

export interface CryptoTrade {
  Timestamp: string;
  Price: number;
  Size: number;
  TakerSide: string;
  Id: number;
}

export interface RawCryptoTrade {
  T: string;
  t: string;
  p: number;
  s: number;
  tks: string;
  i: number;
}

const crypto_quote_mapping = {
  t: "Timestamp",
  bp: "BidPrice",
  bs: "BidSize",
  ap: "AskPrice",
  as: "AskSize",
};

export interface CryptoQuote {
  Timestamp: string;
  BidPrice: number;
  BidSize: number;
  AskPrice: number;
  AskSize: number;
}

export interface RawCryptoQuote {
  T: string;
  t: string;
  bp: number;
  bs: number;
  ap: number;
  as: number;
}

const crypto_bar_mapping = {
  t: "Timestamp",
  o: "Open",
  h: "High",
  l: "Low",
  c: "Close",
  v: "Volume",
  vw: "VWAP",
  n: "TradeCount",
};

export interface CryptoBar {
  Timestamp: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  VWAP: number;
  TradeCount: number;
}

export interface RawCryptoBar {
  T: string;
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number;
  n: number;
}

const crypto_snapshot_mapping = {
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  minuteBar: "MinuteBar",
  dailyBar: "DailyBar",
  prevDailyBar: "PrevDailyBar",
};

export interface CryptoSnapshot {
  LatestTrade: CryptoTrade;
  LatestQuote: CryptoQuote;
  MinuteBar: CryptoBar;
  DailyBar: CryptoBar;
  PrevDailyBar: CryptoBar;
}

const crypto_orderbook_entry_mapping = {
  p: "Price",
  s: "Size",
};

export interface CryptoOrderbookEntry {
  Price: number;
  Size: number;
}

const crypto_orderbook_mapping = {
  t: "Timestamp",
  b: "Bids",
  a: "Asks",
};

export interface CryptoOrderbook {
  Timestamp: string;
  Bids: Array<CryptoOrderbookEntry>;
  Asks: Array<CryptoOrderbookEntry>;
}

export interface RawCryptoOrderbook {
  T: string;
  t: string;
  b: Array<CryptoOrderbookEntry>;
  a: Array<CryptoOrderbookEntry>;
}

const news_image_mapping = {
  size: "Size",
  url: "URL",
};

export interface NewsImage {
  Size: string;
  URL: string;
}

const news_mapping = {
  id: "ID",
  author: "Author",
  created_at: "CreatedAt",
  updated_at: "UpdatedAt",
  headline: "Headline",
  summary: "Summary",
  content: "Content",
  images: "Images",
  url: "URL",
  symbols: "Symbols",
  source: "Source",
};

export interface RawAlpacaNews {
  T: string;
  ID: number;
  Author: string;
  CreatedAt: string;
  UpdatedAt: string;
  Headline: string;
  Summary: string;
  Content: string;
  Images: Array<NewsImage>;
  URL: string;
  Symbols: Array<string>;
  Source: string;
}

export interface AlpacaNews {
  ID: number;
  Author: string;
  CreatedAt: string;
  UpdatedAt: string;
  Headline: string;
  Summary: string;
  Content: string;
  Images: Array<NewsImage>;
  URL: string;
  Symbols: Array<string>;
  Source: string;
}

const option_bar_mapping = {
  S: "Symbol",
  o: "Open",
  h: "High",
  l: "Low",
  c: "Close",
  v: "Volume",
  t: "Timestamp",
  vw: "VWAP",
  n: "TradeCount",
};

export interface AlpacaOptionBar {
  Symbol?: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Timestamp: string;
  VWAP: number;
  TradeCount: number;
}

export interface RawOptionBar {
  T: string;
  S: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: string;
  vw: number;
  n: number;
}

const option_tarde_mapping = {
  S: "Symbol",
  x: "Exchange",
  p: "Price",
  s: "Size",
  t: "Timestamp",
  c: "Condition",
};

export interface AlpacaOptionTrade {
  Symbol?: string;
  Exchange: string;
  Price: number;
  Size: number;
  Timestamp: string;
  Condition: string;
}

export interface RawOptionTrade {
  T: string;
  S: string;
  x: string;
  p: number;
  s: number;
  t: string;
  c: string;
}

const option_quote_mapping = {
  S: "Symbol",
  bx: "BidExchange",
  bp: "BidPrice",
  bs: "BidSize",
  ax: "AskExchange",
  ap: "AskPrice",
  as: "AskSize",
  t: "Timestamp",
  c: "Conditions",
  z: "Tape",
};

export interface AlpacaOptionQuote {
  Symbol?: string;
  BidExchange: string;
  BidPrice: number;
  BidSize: number;
  AskExchange: string;
  AskPrice: number;
  AskSize: number;
  Timestamp: string;
  Condition: string;
}

export interface RawOptionQuote {
  T: string;
  S: string;
  bx: string;
  bp: number;
  bs: number;
  ax: string;
  ap: number;
  as: number;
  c: string;
}

export interface Greeks {
  Delta: number;
  Gamma: number;
  Theta: number;
  Vega: number;
  Rho: number;
}

const option_snapshot_mapping = {
  symbol: "symbol",
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  impliedVolatility: "ImpliedVolatility",
  greeks: "Greeks",
};

export interface AlpacaOptionSnapshot {
  Symbol: string;
  LatestTrade: AlpacaTrade;
  LatestQuote: AlpacaQuote;
  ImpliedVOlatility: number;
  Greeks: Greeks;
}

export function AlpacaTradeV2(data: RawTrade): AlpacaTrade {
  return aliasObjectKey(data, trade_mapping_v2) as AlpacaTrade;
}

export function AlpacaQuoteV2(data: RawQuote): AlpacaQuote {
  return aliasObjectKey(data, quote_mapping_v2) as AlpacaQuote;
}

export function AlpacaBarV2(data: RawBar): AlpacaBar {
  return aliasObjectKey(data, bar_mapping_v2) as AlpacaBar;
}

export function AlpacaSnapshotV2(data: any): AlpacaSnapshot {
  const snapshot = aliasObjectKey(data, snapshot_mapping_v2);

  return mapValues(snapshot, (value: any, key: any) => {
    return convertSnapshotData(key, value, false);
  }) as AlpacaSnapshot;
}

export function AlpacaStatusV2(data: RawStatus): AlpacaStatus {
  return aliasObjectKey(data, status_mapping_v2) as AlpacaStatus;
}

export function AlpacaLuldV2(data: RawLuld): AlpacaLuld {
  return aliasObjectKey(data, luld_mapping_v2) as AlpacaLuld;
}

export function AlpacaCancelErrorV2(data: RawCancelError): AlpacaCancelError {
  return aliasObjectKey(data, cancel_error_mapping_v2) as AlpacaCancelError;
}

export function AlpacaCorrectionV2(data: RawCorrection): AlpacaCorrection {
  return aliasObjectKey(data, correction_mapping_v2) as AlpacaCorrection;
}

export function AlpacaCryptoTrade(data: RawCryptoTrade): CryptoTrade {
  return aliasObjectKey(data, crypto_trade_mapping) as CryptoTrade;
}

export function AlpacaCryptoQuote(data: RawCryptoQuote): CryptoQuote {
  return aliasObjectKey(data, crypto_quote_mapping) as CryptoQuote;
}

export function AlpacaCryptoBar(data: RawCryptoBar): CryptoBar {
  return aliasObjectKey(data, crypto_bar_mapping) as CryptoBar;
}

export function AlpacaCryptoSnapshot(data: any): CryptoSnapshot {
  const snapshot = aliasObjectKey(data, crypto_snapshot_mapping);

  return mapValues(snapshot, (value: any, key: any) => {
    return convertSnapshotData(key, value, true);
  }) as CryptoSnapshot;
}

export function AlpacaCryptoOrderbook(data: RawCryptoOrderbook): CryptoOrderbook {
  const mapFn = (entries: any[]) =>
    entries.map<any>((entry) => aliasObjectKey(entry, crypto_orderbook_entry_mapping));

  const orderbook = aliasObjectKey(data, crypto_orderbook_mapping) as CryptoOrderbook;

  return {
    ...orderbook,
    Bids: mapFn(orderbook.Bids),
    Asks: mapFn(orderbook.Asks),
  };
}

export function AlpacaOptionBarV1Beta1(data: RawOptionBar): AlpacaOptionBar {
  return aliasObjectKey(data, option_bar_mapping) as AlpacaOptionBar;
}

export function AlpacaOptionTradeV1Beta1(data: RawOptionTrade): AlpacaOptionTrade {
  return aliasObjectKey(data, option_tarde_mapping) as AlpacaOptionTrade;
}

export function AlpacaOptionQuoteV1Beta1(data: RawOptionQuote): AlpacaOptionQuote {
  return aliasObjectKey(data, option_quote_mapping) as AlpacaOptionQuote;
}

export function AlpacaOptionSnapshotV1Beta1(data: any): AlpacaOptionSnapshot {
  const snapshot = aliasObjectKey(data, option_snapshot_mapping);

  return mapValues(snapshot, (value: any, key: any) => {
    return convertOptionSnapshotData(key, value);
  }) as AlpacaOptionSnapshot;
}

function aliasObjectKey(data: any, mapping: any) {
  return mapKeys(data, (_value: any, key: any) => {
    return Object.hasOwn(mapping, key) ? mapping[key] : key;
  });
}

function convertSnapshotData(key: string, data: any, isCrypto: boolean) {
  switch (key) {
    case "LatestTrade":
      return isCrypto ? AlpacaCryptoTrade(data) : AlpacaTradeV2(data);
    case "LatestQuote":
      return isCrypto ? AlpacaCryptoQuote(data) : AlpacaQuoteV2(data);
    case "MinuteBar":
    case "DailyBar":
    case "PrevDailyBar":
      return isCrypto ? AlpacaCryptoBar(data) : AlpacaBarV2(data);
    default:
      return data;
  }
}

function convertOptionSnapshotData(key: string, data: any) {
  switch (key) {
    case "LatestTrade":
      return AlpacaOptionTradeV1Beta1(data);
    case "LatestQuote":
      return AlpacaOptionQuoteV1Beta1(data);
    default:
      return data;
  }
}

export function AlpacaNews(data: RawAlpacaNews): AlpacaNews {
  const mappedNews = aliasObjectKey(data, news_mapping);

  if (mappedNews.Images) {
    mappedNews.Images.forEach((element: any) => {
      return aliasObjectKey(element, news_image_mapping);
    });
  }

  return mappedNews as AlpacaNews;
}

export enum TimeFrameUnit {
  MIN = "Min",
  HOUR = "Hour",
  DAY = "Day",
  WEEK = "Week",
  MONTH = "Month",
}

export function NewTimeframe(amount: number, unit: TimeFrameUnit): string {
  if (amount <= 0) {
    throw new Error("amount must be a positive integer value");
  }
  if (unit == TimeFrameUnit.MIN && amount > 59) {
    throw new Error("minute timeframe can only be used with amount between 1-59");
  }
  if (unit == TimeFrameUnit.HOUR && amount > 23) {
    throw new Error("hour timeframe can only be used with amounts 1-23");
  }
  if ((unit == TimeFrameUnit.DAY || unit == TimeFrameUnit.WEEK) && amount != 1) {
    throw new Error("day and week timeframes can only be used with amount 1");
  }
  if (unit == TimeFrameUnit.MONTH && ![1, 2, 3, 6, 12].includes(amount)) {
    throw new Error("month timeframe can only be used with amount 1, 2, 3, 6 and 12");
  }
  return `${amount}${unit}`;
}
