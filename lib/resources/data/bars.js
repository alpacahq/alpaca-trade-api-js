'use strict'

// timeframe is one of
// minute, 1Min, 5Min, 15Min, day or 1D.
// minute is an alias of 1Min. Similarly, day is of 1D.
// Symbols may be a string or an array
// options: limit, start, end, after, until
function getBars (timeframe, symbols, options={}) {
  symbols = typeof symbols === 'string' ? symbols : symbols.join(',')
  return this.dataHttpRequest(`/bars/${timeframe}`, Object.assign(
    { symbols: symbols },
    options
  ))
}

module.exports = {
  getBars: getBars
}
