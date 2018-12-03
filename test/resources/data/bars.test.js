'use strict'

const expect = require('chai').expect
const mock = require('../../support/mock-server')
const Alpaca = require('../../../lib/alpaca-trade-api')
const alpaca = new Alpaca(mock.getConfig())

describe('bars resource', function () {
  describe('get', function () {
    it('fetches bars', function () {
      return expect(alpaca.getBars('minute', ['AAPL', 'XTRA'])).to.eventually.have.property('AAPL')
    })

    it('fetches bars with just one symbol', function () {
      return expect(alpaca.getBars('5Min', 'AAPL')).to.eventually.have.property('AAPL')
    })
  })
})
