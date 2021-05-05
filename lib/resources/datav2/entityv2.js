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
  return convert(data, quote_mapping_v2, false);
}

function AlpacaTradeV2(data) {
  return convert(data, trade_mapping_v2, false);
}

function AlpacaBarV2(data) {
  return convert(data, bar_mapping_v2, false);
}

function AlpacaSnaphotV2(data) {
  return convert(data, snapshot_mapping_v2, true);
}

function convert(data, mapping, isSnaphot) {
  const obj = Object.fromEntries(
    Object.entries(data).map(([key, val]) => [
      mapping.hasOwnProperty(key) ? mapping[key] : key,
      isSnaphot ? convertSnapshotsVal(key.toLowerCase(), val) : val,
    ])
  );
  return obj;
}

function convertSnapshotsVal(key, data) {
  if (key.includes("trade")) {
    return AlpacaTradeV2(data);
  } else if (key.includes("quote")) {
    return AlpacaQuoteV2(data);
  } else if (key.includes("bar")) {
    return AlpacaBarV2(data);
  } else {
    return data;
  }
}

module.exports = {
  AlpacaTradeV2,
  AlpacaQuoteV2,
  AlpacaBarV2,
  AlpacaSnaphotV2,
};
