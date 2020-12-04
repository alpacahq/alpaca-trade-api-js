const ALPACA_QUOTE_MAPPING = {
  T: "symbol",
  X: "askexchange",
  P: "askprice",
  S: "asksize",
  x: "bidexchange",
  p: "bidprice",
  s: "bidsize",
  c: "conditions",
  t: "timestamp",
};

const ALPACA_TRADE_MAPPING = {
  T: "symbol",
  i: "tradeID",
  x: "exchange",
  p: "price",
  s: "size",
  t: "timestamp", // in millisecond
  z: "tapeID",
  c: "conditions",
};
// used in websocket with AM.<SYMBOL>
const ALPACA_AGG_MINUTE_BAR_MAPPING = {
  T: "symbol",
  v: "volume",
  av: "accumulatedVolume",
  op: "officialOpenPrice",
  vw: "vwap",
  o: "openPrice",
  h: "highPrice",
  l: "lowPrice",
  c: "closePrice",
  a: "averagePrice",
  s: "startEpochTime",
  e: "endEpochTime",
};

// used with rest bars endpoint
const ALPACA_BAR_MAPPING = {
  t: "startEpochTime", // in seconds
  o: "openPrice",
  h: "highPrice",
  l: "lowPrice",
  c: "closePrice",
  v: "volume",
};

const polygon_quote_mapping = {
  sym: "symbol",
  ax: "askexchange",
  ap: "askprice",
  as: "asksize",
  bx: "bidexchange",
  bp: "bidprice",
  bs: "bidsize",
  c: "condition",
  t: "timestamp",
};

function AlpacaQuote(data) {
  return convert(data, ALPACA_QUOTE_MAPPING);
}

function AlpacaTrade(data) {
  return convert(data, ALPACA_TRADE_MAPPING);
}

function AggMinuteBar(data) {
  return convert(data, ALPACA_AGG_MINUTE_BAR_MAPPING);
}

function Bar(data) {
  return convert(data, ALPACA_BAR_MAPPING);
}

function convert(data, mapping) {
  const obj = {};
  for (let [key, value] of Object.entries(data)) {
    if (mapping.hasOwnProperty(key)) {
      obj[mapping[key]] = value;
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

export default { AlpacaQuote, AlpacaTrade, AggMinuteBar, Bar };
