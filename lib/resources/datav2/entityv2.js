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
  const res = Object.fromEntries(
    Object.entries(snapshot).map(([key, val]) => [
      key,
      convertSnapshotData(key, val),
    ])
  );
  return res;
}

function aliasObjectKey(data, mapping) {
  const obj = Object.fromEntries(
    Object.entries(data).map(([key, val]) => [
      mapping.hasOwnProperty(key) ? mapping[key] : key,
      val,
    ])
  );
  return obj;
}

function convertSnapshotData(key, data) {
  switch (key) {
    case "LatestTrade":
      return AlpacaTradeV2(data);
    case "LatestQuote":
      return AlpacaQuoteV2(data);
    case "MinuteBar":
      return AlpacaBarV2(data);
    case "DailyBar":
      return AlpacaBarV2(data);
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
