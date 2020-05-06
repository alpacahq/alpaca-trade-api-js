

let alpaca_quote_mapping = {
    "T": "symbol",
    "X": "askexchange",
    "P": "askprice",
    "S": "asksize",
    "x": "bidexchange",
    "p": "bidprice",
    "s": "bidsize",
    "c": "conditions",
    "t": "timestamp"
};

let alpaca_trade_mapping = {
    "T": "symbol",
    "i": "tradeID",
    "x": "exchange",
    "p": "price",
    "s": "size",
    "t": "timestamp", // in millisecond
    "z": "tapeID",
    "c": "conditions",
};
// used in websocket with AM.<SYMBOL>
let alpaca_agg_minute_bar_mapping = {
    "T": "symbol",
    "v": "volume",
    "av": "accumulatedVolume",
    "op": "officialOpenPrice",
    "vw": "vwap",
    "o": "openPrice",
    "h": "highPrice",
    "l": "lowPrice",
    "c": "closePrice",
    "a": "averagePrice",
    "s": "startEpochTime",
    "e": "endEpochTime",
};

// used with rest bars endpoint
let alpaca_bar_mapping = {
    "t": "startEpochTime",  // in seconds
    "o": "openPrice",
    "h": "highPrice",
    "l": "lowPrice",
    "c": "closePrice",
    "v": "volume",
};

polygon_quote_mapping = {
    "sym": "symbol",
    "ax": "askexchange",
    "ap": "askprice",
    "as": "asksize",
    "bx": "bidexchange",
    "bp": "bidprice",
    "bs": "bidsize",
    "c": "condition",
    "t": "timestamp"
};

function AlpacaQuote(data) {
    return convert(data, alpaca_quote_mapping)
}

function AlpacaTrade(data) {
    return convert(data, alpaca_trade_mapping)
}

function AggMinuteBar(data) {
    return convert(data, alpaca_agg_minute_bar_mapping)
}

function Bar(data) {
    return convert(data, alpaca_bar_mapping)
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

module.exports = {
    'AlpacaTrade': AlpacaTrade,
    'AlpacaQuote': AlpacaQuote,
    'AggMinuteBar': AggMinuteBar,
    'Bar': Bar
};
