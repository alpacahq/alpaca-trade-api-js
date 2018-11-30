'use strict'

const expect = require('chai').expect
const mock = require('../mock-alpaca')
const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca(mock.getConfig())

describe('clock resource', function () {
  describe('get', function () {
    it('returns valid results', function () {
      return expect(alpaca.getClock()).to.eventually.have.property('timestamp')
    })
  })
})
