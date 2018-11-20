'use strict'

const { omitBy, isNil } = require('lodash')

function exchanges() {
  return this.polygonHttpRequest('/meta/exchanges')
}

function symbolTypeMap() {
  return this.polygonHttpRequest('/meta/symbol-types')
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
function historicAggregates(size, symbol, from, to, limit) {
  const path = `/historic/agg/${size}/${symbol}`
  const queryParams = omitBy({ from, to, limit }, isNil)
  return this.polygonHttpRequest(path, queryParams)
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

function getSymbol(symbol, resource) {
  const path = `/meta/symbols/${resource}`
  const queryParams = {symbols: symbol}
  return this.polygonHttpRequest(path, queryParams)
}

function company(symbol) {
  return this.getSymbol(symbol, 'company')
}

function dividends(symbol) {
  return this.getSymbol(symbol, 'dividends')
}

function earnings(symbol) {
  return this.getSymbol(symbol, 'earnings')
}

function financials(symbol) {
  return this.getSymbol(symbol, 'financials')
}

function splits(symbol) {
  const path = `/meta/symbols/${symbol}/splits`
  return this.polygonHttpRequest(path)
}

function news(symbol) {
  const path = `/meta/symbols/${symbol}/news`
  return this.polygonHttpRequest(path)
}


module.exports = {
  exchanges,
  symbolTypeMap,
  historicTrades,
  historicQuotes,
  historicAggregates,
  lastTrade,
  lastQuote,
  conditionMap,
  company,
  dividends,
  earnings,
  financials,
  splits,
  news,
  getSymbol,
}
