'use strict'

const { toDateString } = require('../utils/dateformat')

function exchanges() {
  return this.polygonHttpRequest('/meta/exchanges')
}

function symbolTypeMap() {
  return this.polygonHttpRequest('/meta/symbol-types')
}

// options: limit, offset
/*
 * @deprecated Will be removed in a future release, and will be removed from the Polygon API. Please use historicTradesV2 instead.
 */
function historicTrades(symbol, date, options = {}) {
  console.warn('Calling deprecated function historicTrades. Please use historicTradesV2 instead.')
  const path = `/historic/trades/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options)
}

// options: limit, timestamp, timestamp_limit, reverse
function historicTradesV2(symbol, date, options = {}) {
  const path = `/ticks/stocks/trades/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options, null, null, 'v2')
}

// options: limit, offset
/*
 * @deprecated Will be removed in a future release, and will be removed from the Polygon API. Please use historicQuotesV2 instead.
 */
function historicQuotes(symbol, date, options = {}) {
  console.warn('Calling deprecated function historicQuotes. Please use historicQuotesV2 instead.')
  const path = `/historic/quotes/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options)
}

// options: limit, timestamp, timestamp_limit, reverse
function historicQuotesV2(symbol, date, options = {}) {
  const path = `ticks/stocks/nbbo/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options, null, null, 'v2')
}

// size: 'day', 'minute'
// options: from, to, limit, unadjusted
function historicAggregates(size, symbol, options = {}) {
  const path = `/historic/agg/${size}/${symbol}`
  return this.polygonHttpRequest(path, options)
}

// size: 'day', 'minute'
// from, to: YYYY-MM-DD or unix millisecond timestamps
// options: unadjusted
function historicAggregatesV2(symbol, multiplier, size, from, to, options = {}) {
  const path = `/aggs/ticker/${symbol}/range/${multiplier}/${size}/${from}/${to}`
  return this.polygonHttpRequest(path, options, null, null, 'v2')
}

function lastTrade(symbol) {
  const path = `/last/stocks/${symbol}`
  return this.polygonHttpRequest(path)
}

function lastQuote(symbol) {
  const path = `/last_quote/stocks/${symbol}`
  return this.polygonHttpRequest(path)
}

function conditionMap(ticktype = 'trades') {
  const path = `/meta/conditions/${ticktype}`
  return this.polygonHttpRequest(path)
}

const symbolMeta = (resource) => function (symbol) {
  const path = `/meta/symbols/${symbol}` + (resource ? `/${resource}` : '')
  return this.polygonHttpRequest(path)
}

const getSymbol = symbolMeta()
const company = symbolMeta('company')
const analysts = symbolMeta('analysts')
const dividends = symbolMeta('dividends')
const splits = symbolMeta('splits')
const earnings = symbolMeta('earnings')
const financials = symbolMeta('financials')
const news = symbolMeta('news')

module.exports = {
  exchanges,
  symbolTypeMap,
  historicTrades,
  historicTradesV2,
  historicQuotes,
  historicQuotesV2,
  historicAggregates,
  historicAggregatesV2,
  lastTrade,
  lastQuote,
  conditionMap,
  company,
  analysts,
  dividends,
  earnings,
  financials,
  splits,
  news,
  getSymbol,
}
