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

export interface CorporateActions {
  CashDividends: Array<CashDividend>;
  ReverseSplits: Array<ReverseSplit>;
  ForwardSplits: Array<ForwardSplit>;
  UnitSplits: Array<UnitSplit>;
  CashMergers: Array<CashMerger>;
  StockMergers: Array<StockMerger>;
  StockAndCashMerger: Array<StockAndCashMerger>;
  StockDividends: Array<StockDividends>;
  Redemptions: Array<Redemption>;
  SpinOffs: Array<SpinOff>;
  NameChanges: Array<NameChange>;
  WorthlessRemovals: Array<WorthlessRemoval>;
  RightsDistributions: Array<RightsDistribution>;
}

const cash_dividend_mapping = {
  ex_date: "ExDate",
  foreign: "Foreign",
  payable_date: "PayableDate",
  process_date: "ProcessDate",
  rate: "Rate",
  record_date: "RecordDate",
  special: "Special",
  symbol: "Symbol",
};

export interface CashDividend {
  ExDate: string;
  Foreign: boolean;
  PayableDate: string;
  ProcessDate: string;
  Rate: number;
  RecordDate: string;
  Special: boolean;
  Symbol: string;
}

const reverse_split_mapping = {
  ex_date: "ExDate",
  new_rate: "NewRate",
  old_rate: "OldRate",
  payable_date: "PayableDate",
  process_date: "ProcessDate",
  record_date: "RecordDate",
  symbol: "Symbol",
};

export interface ReverseSplit {
  ExDate: string;
  NewRate: number;
  OldRate: number;
  PayableDate: string;
  ProcessDate: string;
  RecordDate: string;
  Symbol: string;
}

const forward_split_mapping = {
  due_bill_redemption_date: "DueBillRedemptionDate",
  ex_date: "ExDate",
  new_rate: "NewRate",
  old_rate: "OldRate",
  payable_date: "PayableDate",
  process_date: "ProcessDate",
  record_date: "RecordDate",
  symbol: "Symbol",
};

export interface ForwardSplit {
  DueBillRedemptionDate: string;
  ExDate: string;
  NewRate: number;
  OldRate: number;
  PayableDate: string;
  ProcessDate: string;
  RecordDate: string;
  Symbol: string;
}

const unit_split_mapping = {
  alternate_rate: "AlternateRate",
  alternate_symbol: "AlternateSymbol",
  effective_date: "EffectiveDate",
  new_rate: "NewRate",
  new_symbol: "NewSymbol",
  old_rate: "OldRate",
  old_symbol: "OldSymbol",
  process_date: "ProcessDate",
};

export interface UnitSplit {
  AlternateRate: number;
  AlternateSymbol: string;
  EffectiveDate: string;
  NewRate: number;
  NewSymbol: string;
  OldRate: number;
  OldSymbol: string;
  ProcessDate: string;
}

const cash_merger_mapping = {
  acquiree_symbol: "AcquireeSymbol",
  acquirer_symbol: "AcquirerSymbol",
  effective_date: "EffectiveDate",
  process_date: "ProcessDate",
  rate: "Rate",
};

export interface CashMerger {
  AcquireeSymbol: string;
  AcquirerSymbol: string;
  EffectiveDate: string;
  ProcessDate: string;
  Rate: number;
}

const stock_merger_mapping = {
  acquiree_rate: "AcquireeRate",
  acquiree_symbol: "AcquireeSymbol",
  acquirer_rate: "AcquirerRate",
  acquirer_symbol: "AcquirerSymbol",
  effective_date: "EffectiveDate",
  payable_date: "PayableDate",
  process_date: "ProcessDate",
};

export interface StockMerger {
  AcquireeRate: number;
  AcquireeSymbol: string;
  AcquirerRate: number;
  AcquirerSymbol: string;
  EffectiveDate: string;
  PayableDate: string;
  ProcessDate: string;
}

const stock_and_cash_merger_mapping = {
  stock_merger_mapping,
  cash_rate: "CashRate",
};
export interface StockAndCashMerger extends StockMerger {
  CashRate: number;
}

const stock_dividends_mapping = {
  ex_date: "ExDate",
  payable_date: "PayableDate",
  process_date: "ProcessDate",
  rate: "Rate",
  record_date: "RecordDate",
  symbol: "Symbol",
};

export interface StockDividends {
  ExDate: string;
  PayableDate: string;
  ProcessDate: string;
  Rate: number;
  RecordDate: string;
  Symbol: string;
}

const redemption_mapping = {
  payable_date: "PayableDate",
  process_date: "ProcessDate",
  rate: "Rate",
  symbol: "Symbol",
};

export interface Redemption {
  PayableDate: string;
  ProcessDate: string;
  Rate: number;
  Symbol: string;
}

const spin_off_mapping = {
  ex_date: "ExDate",
  new_rate: "NewRate",
  new_symbol: "NewSymbol",
  process_date: "ProcessDate",
  record_date: "RecordDate",
  source_rate: "Rate",
  source_symbol: "SourceSymbol",
};

export interface SpinOff {
  ExDate: string;
  NewRate: number;
  NewSymbol: string;
  ProcessDate: string;
  RecordDate: string;
  Rate: number;
  SourceSymbol: string;
}

const name_change_mapping = {
  new_symbol: "NewSymbol",
  old_symbol: "OldSymbol",
  process_date: "ProcessDate",
};

export interface NameChange {
  NewSymbol: string;
  OldSymbol: string;
  ProcessDate: string;
}

const worthless_removal_mapping = {
  symbol: "Symbol",
  process_date: "ProcessDate",
};

export interface WorthlessRemoval {
  Symbol: string;
  ProcessDate: string;
}

const rights_distribution_mapping = {
  source_symbol: "SourceSymbol",
  new_symbol: "NewSymbol",
  rate: "Rate",
  process_date: "ProcessDate",
  ex_date: "ExDate",
  payable_date: "PayableDate",
  record_date: "RecordDate",
  expiration_date: "ExpirationDate",
};

export interface RightsDistribution {
  SourceSymbol: string;
  NewSymbol: string;
  Rate: number;
  ProcessDate: string;
  ExDate: string;
  PayableDate: string;
  RecordDate: string;
  ExpirationDate: string;
}

export function convertCorporateActions(data: any): CorporateActions {
  let cas = {} as CorporateActions;
  if (data.cash_dividends?.length > 0) {
    cas.CashDividends = cas.CashDividends ? cas.CashDividends : Array<CashDividend>();
    data.cash_dividends.forEach((cd: any) => {
      cas.CashDividends.push(aliasObjectKey(cd, cash_dividend_mapping) as CashDividend);
    });
  }
  if (data.reverse_splits?.length > 0) {
    cas.ReverseSplits = cas.ReverseSplits ? cas.ReverseSplits : Array<ReverseSplit>();
    data.reverse_splits.forEach((rs: any) => {
      cas.ReverseSplits.push(aliasObjectKey(rs, reverse_split_mapping) as ReverseSplit);
    });
  }
  if (data.forward_splits?.length > 0) {
    cas.ForwardSplits = cas.ForwardSplits ? cas.ForwardSplits : Array<ForwardSplit>();
    data.forward_splits.forEach((fs: any) => {
      cas.ForwardSplits.push(aliasObjectKey(fs, forward_split_mapping) as ForwardSplit);
    });
  }
  if (data.unit_splits?.length > 0) {
    cas.UnitSplits = cas.UnitSplits ? cas.UnitSplits : Array<UnitSplit>();
    data.unit_splits.forEach((fs: any) => {
      cas.UnitSplits.push(aliasObjectKey(fs, unit_split_mapping) as UnitSplit);
    });
  }
  if (data.cash_mergers?.length > 0) {
    cas.CashMergers = cas.CashMergers ? cas.CashMergers : Array<CashMerger>();
    data.cash_mergers.forEach((cm: any) => {
      cas.CashMergers.push(aliasObjectKey(cm, cash_merger_mapping) as CashMerger);
    });
  }
  if (data.stock_mergers?.length > 0) {
    cas.StockMergers = cas.StockMergers ? cas.StockMergers : Array<StockMerger>();
    data.stock_mergers.forEach((sm: any) => {
      cas.StockMergers.push(aliasObjectKey(sm, stock_merger_mapping) as StockMerger);
    });
  }
  if (data.stock_and_cash_mergers?.length > 0) {
    cas.StockAndCashMerger = cas.StockAndCashMerger
      ? cas.StockAndCashMerger
      : Array<StockAndCashMerger>();
    data.stock_and_cash_mergers.forEach((scm: any) => {
      cas.StockAndCashMerger.push(
        aliasObjectKey(scm, stock_and_cash_merger_mapping) as StockAndCashMerger
      );
    });
  }
  if (data.stock_dividends?.length > 0) {
    cas.StockDividends = cas.StockDividends
      ? cas.StockDividends
      : Array<StockDividends>();
    data.stock_dividends.forEach((sd: any) => {
      cas.StockDividends.push(
        aliasObjectKey(sd, stock_dividends_mapping) as StockDividends
      );
    });
  }
  if (data.redemptions?.length > 0) {
    cas.Redemptions = cas.Redemptions ? cas.Redemptions : Array<Redemption>();
    data.redemptions.forEach((r: any) => {
      cas.Redemptions.push(aliasObjectKey(r, redemption_mapping) as Redemption);
    });
  }
  if (data.spin_offs?.length > 0) {
    cas.SpinOffs = cas.SpinOffs ? cas.SpinOffs : Array<SpinOff>();
    data.spin_offs.forEach((so: any) => {
      cas.SpinOffs.push(aliasObjectKey(so, spin_off_mapping) as SpinOff);
    });
  }
  if (data.name_changes?.length > 0) {
    cas.NameChanges = cas.NameChanges ? cas.NameChanges : Array<NameChange>();
    data.name_changes.forEach((nc: any) => {
      cas.NameChanges.push(aliasObjectKey(nc, name_change_mapping) as NameChange);
    });
  }
  if (data.worthless_removals?.length > 0) {
    cas.WorthlessRemovals = cas.WorthlessRemovals
      ? cas.WorthlessRemovals
      : Array<WorthlessRemoval>();
    data.worthless_removals.forEach((wr: any) => {
      cas.WorthlessRemovals.push(
        aliasObjectKey(wr, worthless_removal_mapping) as WorthlessRemoval
      );
    });
  }
  if (data.rights_distributions?.length > 0) {
    cas.RightsDistributions = cas.RightsDistributions
      ? cas.RightsDistributions
      : Array<RightsDistribution>();
    data.rights_distributions.forEach((rd: any) => {
      cas.RightsDistributions.push(
        aliasObjectKey(rd, rights_distribution_mapping) as RightsDistribution
      );
    });
  }
  return cas;
}

export function getCorporateActionsSize(cas: CorporateActions): number {
  let sum = 0;
  for (const key in cas) {
    sum += cas[key as keyof CorporateActions]
      ? cas[key as keyof CorporateActions].length
      : 0;
  }
  return sum;
}

export function mergeCorporateActions(
  ca1: CorporateActions,
  ca2: CorporateActions
): CorporateActions {
  return {
    CashDividends: (ca1.CashDividends || []).concat(ca2.CashDividends || []),
    ReverseSplits: (ca1.ReverseSplits || []).concat(ca2.ReverseSplits || []),
    ForwardSplits: (ca1.ForwardSplits || []).concat(ca2.ForwardSplits || []),
    UnitSplits: (ca1.UnitSplits || []).concat(ca2.UnitSplits || []),
    CashMergers: (ca1.CashMergers || []).concat(ca2.CashMergers || []),
    StockMergers: (ca1.StockMergers || []).concat(ca2.StockMergers || []),
    StockAndCashMerger: (ca1.StockAndCashMerger || []).concat(
      ca2.StockAndCashMerger || []
    ),
    StockDividends: (ca1.StockDividends || []).concat(ca2.StockDividends || []),
    Redemptions: (ca1.Redemptions || []).concat(ca2.Redemptions || []),
    SpinOffs: (ca1.SpinOffs || []).concat(ca2.SpinOffs || []),
    NameChanges: (ca1.NameChanges || []).concat(ca2.NameChanges || []),
    WorthlessRemovals: (ca1.WorthlessRemovals || []).concat(ca2.WorthlessRemovals || []),
    RightsDistributions: (ca1.RightsDistributions || []).concat(
      ca2.RightsDistributions || []
    ),
  };
}
