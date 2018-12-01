'use strict'

const expect = require('chai').expect
const mock = require('../support/mock-server')
const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca(mock.getConfig())

describe('position resource', function () {
  describe('getAll', function () {
    it('returns valid results', async function () {
      return expect(alpaca.getPositions()).to.eventually.be.an('array')
    })
  })

  describe('getOne', function () {
    it('returns 422 error if unknown symbol is used', function () {
      return expect(alpaca.getPosition('FAKE')).to.be.rejectedWith('422')
    })

    it('returns valid results if valid symbol is used', async function () {
      const position = await alpaca.getPosition('SPY')
      expect(position).to.have.property('asset_id')
    })

    it('returns 404 if you have no position for that symbol', async function () {
      return expect(alpaca.getPosition('NONE')).to.be.rejectedWith('404')
    })
  })
})
