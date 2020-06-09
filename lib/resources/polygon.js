'use strict'

const { toDateString } = require('../utils/dateformat')

function exchanges() {
  return this.polygonHttpRequest('/meta/exchanges')
}

function symbolTypeMap() {
  return this.polygonHttpRequest('/meta/symbol-types')
}

// options: limit, timestamp, timestamp_limit, reverse
function historicTradesV2(symbol, date, options = {}) {
  const path = `/ticks/stocks/trades/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options, null, null, 'v2')
}

// options: limit, timestamp, timestamp_limit, reverse
function historicQuotesV2(symbol, date, options = {}) {
  const path = `ticks/stocks/nbbo/${symbol}/${toDateString(date)}`
  return this.polygonHttpRequest(path, options, null, null, 'v2')
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

const symbolReference = (resource) => function (symbol) {
  const path = '/reference' + (resource ? `/${resource}` : '') + `/${symbol}`
  return this.polygonHttpRequest(path, {}, null, null, 'v2').then((response) => {
    return response.results;
  })
}

const getSymbol = symbolMeta()
const company = symbolMeta('company')
const analysts = symbolMeta('analysts')
const dividends = symbolReference('dividends')
const splits = symbolReference('splits')
const earnings = symbolMeta('earnings')
const financials = symbolReference('financials')
const news = symbolMeta('news')

module.exports = {
  exchanges,
  symbolTypeMap,
  historicTradesV2,
  historicQuotesV2,
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
