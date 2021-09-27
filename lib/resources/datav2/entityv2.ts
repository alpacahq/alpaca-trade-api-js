import mapKeys from "lodash/mapKeys";
import mapValues from "lodash/mapValues";

const trade_mapping_v2 = {
  i: "ID",
  S: "Symbol",
  x: "Exchange",
  p: "Price",
  s: "Size",
  t: "Timestamp",
  c: "Conditions",
  z: "Tape",
};

export interface AlpacaTrade {
  ID: number;
  Symbol: string;
  Exchange: string;
  Price: number;
  Size: number;
  Timestamp: string;
  Conditions: Array<string>;
  Tape: string;
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

export interface AlapacaQuote {
  Symbol: string;
  BidExchange: string;
  BidSize: number;
  AskExchange: string;
  AskPrice: number;
  AskSize: number;
  Timestamp: string;
  Conditions: Array<string>;
  Tape: string;
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
  HishPrice: number;
  LowPrice: number;
  ClosePrice: number;
  Volume: number;
  Timestamp: string;
  VWAP: number;
  TradeCount: number;
}

const snapshot_mapping_v2 = {
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  minuteBar: "MinuteBar",
  dailyBar: "DailyBar",
  prevDailyBar: "PrevDailyBar",
};

export interface AlpacaSnapshot {
  LatestTrade: AlpacaTrade;
  LatestQuote: AlapacaQuote;
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

const crypto_trade_mapping = {
  S: "Symbol",
  t: "Timestamp",
  x: "Exchanhge",
  p: "Price",
  s: "Size",
  tks: "TakerSide",
  i: "Id",
};

export interface CryptoTrade {
  Symbol: string;
  Timestamp: string;
  Exchange: string;
  Price: number;
  Size: number;
  TakerSide: string;
  Id: number;
}

const crypto_quote_mapping = {
  S: "Symbol",
  t: "Timestamp",
  x: "Exchange",
  bp: "BidPrice",
  bs: "BidSize",
  ap: "AskPrice",
  as: "AskSize",
};

export interface CryptoQuote {
  Symbol: string;
  Timestamp: string;
  Exchange: string;
  BidPrice: number;
  BidSize: number;
  AskPrice: number;
  AskSize: number;
}

const crypro_bar_mapping = {
  S: "Symbol",
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
  Symbol: string;
  Timestamp: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  VWAP: number;
  TradeCount: number;
}

const crypto_xbbo_mapping = {
  S: "Symbol",
  t: "Timestamp",
  ap: "AskPrice",
  as: "AskSize",
  ax: "AskExchange",
  bp: "BidPrice",
  bs: "BidSize",
  bx: "BidExchange",
};

export interface CryptoXBBO {
  Symbol: string;
  Timestamp: string;
  BidExchange: string;
  BidPrice: number;
  BidSize: number;
  AskExchange: string;
  AskPrice: number;
  AskSize: number;
}

export function AlpacaTradeV2(data: any): AlpacaTrade {
  return aliasObjectKey(data, trade_mapping_v2) as AlpacaTrade;
}

export function AlpacaQuoteV2(data: any): AlapacaQuote {
  return aliasObjectKey(data, quote_mapping_v2) as AlapacaQuote;
}

export function AlpacaBarV2(data: any): AlpacaBar {
  return aliasObjectKey(data, bar_mapping_v2) as AlpacaBar;
}

export function AlpacaSnaphotV2(data: any): AlpacaSnapshot {
  let snapshot = aliasObjectKey(data, snapshot_mapping_v2);

  return mapValues(snapshot, (value: any, key: any) => {
    return convertSnapshotData(key, value);
  }) as AlpacaSnapshot;
}

export function AlpacaStatusV2(data: any): AlpacaStatus {
  return aliasObjectKey(data, status_mapping_v2) as AlpacaStatus;
}

export function AlpacaLuldV2(data: any): AlpacaLuld {
  return aliasObjectKey(data, luld_mapping_v2) as AlpacaLuld;
}

export function AlpacaCryptoTrade(data: any): CryptoTrade {
  return aliasObjectKey(data, crypto_trade_mapping) as CryptoTrade;
}

export function AlpacaCryptoQuote(data: any): CryptoQuote {
  return aliasObjectKey(data, crypto_quote_mapping) as CryptoQuote;
}

export function AlpacaCryptoBar(data: any) {
  return aliasObjectKey(data, crypro_bar_mapping);
}

function aliasObjectKey(data: any, mapping: any) {
  return mapKeys(data, (value: any, key: any) => {
    return mapping.hasOwnProperty(key) ? mapping[key] : key;
  });
}

export function AlpacaCryptoXBBO(data: any): CryptoXBBO {
  return aliasObjectKey(data, crypto_xbbo_mapping) as CryptoXBBO;
}

function convertSnapshotData(key: string, data: any) {
  switch (key) {
    case "LatestTrade":
      return AlpacaTradeV2(data);
    case "LatestQuote":
      return AlpacaQuoteV2(data);
    case "MinuteBar":
    case "DailyBar":
    case "PrevDailyBar":
      return AlpacaBarV2(data);
    default:
      return data;
  }
}
