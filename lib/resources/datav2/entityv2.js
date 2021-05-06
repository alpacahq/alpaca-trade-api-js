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
};

const snapshot_mapping_v2 = {
  latestTrade: "LatestTrade",
  latestQuote: "LatestQuote",
  minuteBar: "MinuteBar",
  dailyBar: "DailyBar",
  prevDailyBar: "PrevDailyBar",
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
};
