'use strict'

const { omitBy, isNil } = require('lodash')

function exchanges() {
  return this.polygonHttpRequest('/meta/exchanges')
}

function symbolTypeMap() {
  return this.polygonHttpRequest('/meta/symbol-types')
}

function openClosePrices(symbol, date) {
  return this.polygonHttpRequest(`/open-close/${symbol}/${date}`)
}

function historicTrades(symbol, date, offset, limit) {
  const path = `/historic/trades/${symbol}/${date}`
  const queryParams = omitBy({ offset, limit }, isNil)
  return this.polygonHttpRequest(path, queryParams)
}

function historicQuotes(symbol, date, offset, limit) {
  const path = `/historic/quotes/${symbol}/${date}`
  const queryParams = omitBy({ offset, limit }, isNil)
  return this.polygonHttpRequest(path, queryParams)
}

// size: 'day', 'minute'
// options: from, to, limit, unadjusted
function historicAggregates(size, symbol, options={}) {
  const path = `/historic/agg/${size}/${symbol}`
  return this.polygonHttpRequest(path, options)
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

const symbolMeta = (resource) => function(symbol) {
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
  historicQuotes,
  historicAggregates,
  lastTrade,
  lastQuote,
  openClosePrices,
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
