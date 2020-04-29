

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
    "sym": "symbol",
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
    "sym": "symbol",
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
    let obj = new Object();
    for (let [key, value] of Object.entries(data)) {
        if (alpaca_quote_mapping.hasOwnProperty(key)) {
            obj[alpaca_quote_mapping[key]] = value;
        }
    }
    return obj;
}

function AlpacaTrade(data) {
    let obj = new Object();
    for (let [key, value] of Object.entries(data)) {
        if (alpaca_trade_mapping.hasOwnProperty(key)) {
            obj[alpaca_trade_mapping[key]] = value;
        }
    }
    return obj;
}

function AggMinuteBar(data) {
    let obj = {};
    for (let [key, value] of Object.entries(data)) {
        if (alpaca_agg_minute_bar_mapping.hasOwnProperty(key)) {
            obj[alpaca_agg_minute_bar_mapping[key]] = value;
        }
    }
    return obj;
}

module.exports = {
    'AlpacaTrade': AlpacaTrade,
    'AlpacaQuote': AlpacaQuote,
    'MinuteBar': MinuteBar
};