'use strict'

const expect = require('chai').expect
const mock = require('../mock-alpaca')
const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca(mock.getConfig())

describe('calendar resource', function () {
  describe('get', function () {
    it('returns valid results without a parameter', function () {
      return expect(alpaca.getCalendar()).to.eventually.have.property('date')
    })

    it('returns valid results with `start` parameter', function () {
      return expect(alpaca.getCalendar('2018-01-01')).to.eventually.have.property('date')
    })

    it('returns valid results with `end` parameter', function () {
      return expect(alpaca.getCalendar(undefined, '2018-01-01')).to.eventually.have.property('date')
    })

    it('returns valid results with both parameters', function () {
      return expect(alpaca.getCalendar('2017-01-01', '2018-01-01')).to.eventually.have.property('date')
    })
  })
})
