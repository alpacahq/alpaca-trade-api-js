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

export interface AlapacaQuote {
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

export interface RawCryptoTrade {
  T: string;
  S: string;
  t: string;
  x: string;
  p: number;
  s: number;
  tks: string;
  i: number;
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

export interface RawCryptoQuote {
  T: string;
  S: string;
  t: string;
  x: string;
  bp: number;
  bs: number;
  ap: number;
  as: number;
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

export interface RawCryptoBar {
  T: string;
  S: string;
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number;
  n: number;
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

export interface RawCryptoXBBO {
  T: string;
  S: string;
  t: string;
  bx: string;
  bp: number;
  bs: number;
  ax: string;
  ap: number;
  as: number;
}

export function AlpacaTradeV2(data: RawTrade): AlpacaTrade {
  return aliasObjectKey(data, trade_mapping_v2) as AlpacaTrade;
}

export function AlpacaQuoteV2(data: RawQuote): AlapacaQuote {
  return aliasObjectKey(data, quote_mapping_v2) as AlapacaQuote;
}

export function AlpacaBarV2(data: RawBar): AlpacaBar {
  return aliasObjectKey(data, bar_mapping_v2) as AlpacaBar;
}

export function AlpacaSnaphotV2(data: AlpacaStatus): AlpacaSnapshot {
  const snapshot = aliasObjectKey(data, snapshot_mapping_v2);

  return mapValues(snapshot, (value: any, key: any) => {
    return convertSnapshotData(key, value);
  }) as AlpacaSnapshot;
}

export function AlpacaStatusV2(data: RawStatus): AlpacaStatus {
  return aliasObjectKey(data, status_mapping_v2) as AlpacaStatus;
}

export function AlpacaLuldV2(data: RawLuld): AlpacaLuld {
  return aliasObjectKey(data, luld_mapping_v2) as AlpacaLuld;
}

export function AlpacaCryptoTrade(data: RawCryptoTrade): CryptoTrade {
  return aliasObjectKey(data, crypto_trade_mapping) as CryptoTrade;
}

export function AlpacaCryptoQuote(data: RawCryptoQuote): CryptoQuote {
  return aliasObjectKey(data, crypto_quote_mapping) as CryptoQuote;
}

export function AlpacaCryptoBar(data: RawCryptoBar): CryptoBar {
  return aliasObjectKey(data, crypro_bar_mapping) as CryptoBar;
}

function aliasObjectKey(data: any, mapping: any) {
  return mapKeys(data, (value: any, key: any) => {
    return mapping.hasOwnProperty(key) ? mapping[key] : key;
  });
}

export function AlpacaCryptoXBBO(data: RawCryptoXBBO): CryptoXBBO {
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
