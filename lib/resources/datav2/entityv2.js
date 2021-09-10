const { mapKeys, mapValues } = require("lodash");

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

const quote_mapping_v2 = {
  S: "Symbol",
  bx: "BidExchange",
  bp: "BidPrice",
  bs: "BidSize",
  ax: "AskExchange",
  ap: "AskPrice",
  as: "AskSize",
  t: "Timestamp",
  c: "Condition",
  z: "Tape",
};

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

const snapshot_mapping_v2 = {
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  minuteBar: "MinuteBar",
  dailyBar: "DailyBar",
  prevDailyBar: "PrevDailyBar",
};

const status_mapping_v2 = {
  S: "Symbol",
  sc: "StatusCode",
  sm: "StatusMessage",
  rc: "ReasonCode",
  rm: "ReasonMessage",
  t: "Timestamp",
  z: "Tape",
};

const luld_mapping_v2 = {
  S: "Symbol",
  u: "LimitUpPrice",
  d: "LimitDownPrice",
  i: "Indicator",
  t: "Timestamp",
  z: "Tape",
};

const crypto_trade_mapping = {
  S: "Symbol",
  t: "Timestamp",
  x: "Exchanhge",
  p: "Price",
  s: "Size",
  tks: "TakerSide",
  i: "Id",
};

const crypto_quote_mapping = {
  S: "Symbol",
  t: "Timestamp",
  x: "Exchange",
  bp: "BidPrice",
  bs: "BidSize",
  ap: "AskPrice",
  as: "AskSize",
};

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

function AlpacaQuoteV2(data) {
  return aliasObjectKey(data, quote_mapping_v2);
}

function AlpacaTradeV2(data) {
  return aliasObjectKey(data, trade_mapping_v2);
}

function AlpacaBarV2(data) {
  return aliasObjectKey(data, bar_mapping_v2);
}

function AlpacaSnaphotV2(data) {
  let snapshot = aliasObjectKey(data, snapshot_mapping_v2);

  return mapValues(snapshot, (value, key) => {
    return convertSnapshotData(key, value);
  });
}

function AlpacaStatusV2(data) {
  return aliasObjectKey(data, status_mapping_v2);
}

function AlpacaLuldV2(data) {
  return aliasObjectKey(data, luld_mapping_v2);
}

function AlpacaCryptoTrade(data) {
  return aliasObjectKey(data, crypto_trade_mapping);
}

function AlpacaCryptoQuote(data) {
  return aliasObjectKey(data, crypto_quote_mapping);
}

function AlpacaCryptoBar(data) {
  return aliasObjectKey(data, crypro_bar_mapping);
}

function AlpacaCryptoXBBO(data) {
  return aliasObjectKey(data, crypto_xbbo_mapping);
}

function aliasObjectKey(data, mapping) {
  return mapKeys(data, (value, key) => {
    return mapping.hasOwnProperty(key) ? mapping[key] : key;
  });
}

function convertSnapshotData(key, data) {
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

module.exports = {
  AlpacaTradeV2,
  AlpacaQuoteV2,
  AlpacaBarV2,
  AlpacaSnaphotV2,
  AlpacaStatusV2,
  AlpacaLuldV2,
  AlpacaCryptoTrade,
  AlpacaCryptoQuote,
  AlpacaCryptoBar,
  AlpacaCryptoXBBO,
};
