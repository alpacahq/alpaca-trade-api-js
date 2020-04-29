

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

function Quote(data) {
    let obj = new Object();
    for (let [key, value] of Object.entries(data)) {
        if (alpaca_quote_mapping.hasOwnProperty(key)) {
            obj[alpaca_quote_mapping[key]] = value;
        }
    }
    return obj;
}

module.exports = {
    'Quote': Quote,
};