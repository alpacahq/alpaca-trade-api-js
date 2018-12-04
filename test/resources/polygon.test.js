'use strict'

const expect = require('chai').expect
const mockPolygon = require('../support/mock-server')
const Alpaca = require('../../lib/alpaca-trade-api')

describe('polygon methods', () => {

  const alpaca = new Alpaca(mockPolygon.getConfig())

  it('can get endpoints for a symbol', () => {
    return expect(alpaca.getSymbol('AAPL')).to.eventually.have.property('endpoints')
  })

  it('can get a company', () => {
    return expect(alpaca.getCompany('AAPL')).to.eventually.have.property('name')
  })

  it('can get analysts', () => {
    return expect(alpaca.getAnalysts('AAPL')).to.eventually.have.property('strongBuy')
  })

  it('can get dividends', () => {
    return expect(alpaca.getDividends('AAPL')).to.eventually.be.an('array')
  })

  it('can get splits', () => {
    return expect(alpaca.getSplits('AAPL')).to.eventually.be.an('array')
  })

  it('can get a condition map', () => {
    return expect(alpaca.getConditionMap()).to.eventually.be.an('object')
  })

  it('can get the last quote', () => {
    return expect(alpaca.getLastQuote()).to.eventually.have.property('last')
  })

  it('can get the last trade', () => {
    return expect(alpaca.getLastTrade()).to.eventually.have.property('last')
  })

  it('can get historic aggregates', () => {
    return expect(
      alpaca.getHistoricAggregates('day', 'AAPL', {
        from: new Date(),
        to: new Date(),
        limit: 12,
        unadjusted: false,
      })
    ).to.eventually.have.property('aggType')
  })

  it('can get historic trades', () => {
    return expect(
      alpaca.getHistoricTrades('AAPL', '2018-3-2', { offset: 2, limit: 12 })
    ).to.eventually.have.property('ticks')
  })

  it('can get historic quotes', () => {
    return expect(
      alpaca.getHistoricQuotes('AAPL', '2018-3-2', { offset: 3, limit: 16 })
    ).to.eventually.have.property('ticks')
  })

  it('can get the symbol type map', () => {
    return expect(
      alpaca.getSymbolTypeMap()
    ).to.eventually.have.property('cs')
  })

  it('can get the exchanges', async () => {
    return expect(alpaca.getExchanges()).to.eventually.be.an('array')
  })
})
