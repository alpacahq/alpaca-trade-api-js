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

  it('can get financials', () => {
    return expect(alpaca.getFinancials('AAPL')).to.eventually.be.an('array')
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

  it('can get historic aggregates v2', () => {
    return expect(
      alpaca.getHistoricAggregatesV2('AAPL', 1, 'day', '2018-02-01', '2018-02-10', {
        unadjusted: false,
      })
    ).to.eventually.have.property('queryCount')
  })

  it('can get historic trades v2', () => {
    return expect(
      alpaca.getHistoricTradesV2('AAPL', '2018-3-2', { limit: 12 })
    ).to.eventually.have.property('results')
  })

  it('can get historic quotes v2', () => {
    return expect(
      alpaca.getHistoricQuotesV2('AAPL', '2018-3-2', { offset: 3, limit: 16 })
    ).to.eventually.have.property('results')
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
