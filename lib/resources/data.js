'use strict'

const { toDateString } = require('../utils/dateformat')
const entity = require('./entity');

// timeframe is one of
// minute, 1Min, 5Min, 15Min, day or 1D.
// minute is an alias of 1Min. Similarly, day is of 1D.
// Symbols may be a string or an array
// options: limit, start, end, after, until
function getBars(timeframe, symbols, options = {}) {
  symbols = typeof symbols === 'string' ? symbols : symbols.join(',')
  return this.dataHttpRequest(`/bars/${timeframe}`, Object.assign(
      { symbols: symbols },
      options
  )).then((resp) => {
    const convertedResponse = {};
    Object.keys(resp).forEach((symbol) => {
      convertedResponse[symbol] = [];
      resp[symbol].forEach((bar) =>
      {
        convertedResponse[symbol].push(entity.Bar(bar))
      })
    });
    return convertedResponse;
  })
}

function getAggregates(symbol, timespan, from, to) {
  const path = `/aggs/ticker/${symbol}/range/1/${timespan}/${toDateString(from)}/${toDateString(to)}`
  return this.dataHttpRequest(path).then((resp) => {
    const convertedResponse = [];
    resp.results.forEach((bar) =>
    {
      convertedResponse.push(entity.Bar(bar))
    });
    resp.results = convertedResponse;
    return resp;
  })
}

function getLastTrade(symbol) {
  const path = `/last/stocks/${symbol}`
  return this.dataHttpRequest(path)
}

function getLastQuote(symbol) {
  const path = `/last_quote/stocks/${symbol}`
  return this.dataHttpRequest(path)
}

module.exports = {
  getAggregates: getAggregates,
  getBars: getBars,
  getLastTrade: getLastTrade,
  getLastQuote: getLastQuote
}
