'use strict'

const expect = require('chai').expect
const mock = require('../support/mock-server')
const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca(mock.getConfig())

describe('asset resource', function () {
  describe('getAll', function () {
    it('returns valid results without parameters', function (done) {
      expect(alpaca.getAssets()).to.eventually.be.an('array').notify(done)
    })

    it('returns valid results with a status parameter', function (done) {
      expect(alpaca.getAssets('active')).to.eventually.be.an('array').notify(done)
    })

    it('returns valid results with an asset_class parameter', function (done) {
      expect(alpaca.getAssets(null, 'us_equity')).to.eventually.be.an('array').notify(done)
    })

    it('returns valid results with both parameters', function (done) {
      expect(alpaca.getAssets('inactive', 'us_equity')).to.eventually.be.an('array').notify(done)
    })
  })

  describe('getOne', function () {
    it('returns 404 error if unknown symbol is used', function () {
      return expect(alpaca.getAsset('FAKE')).to.be.rejectedWith('404')
    })

    it('returns valid results if valid symbol is used otherwise, 404', async function () {
      const symbol = '7b8bfbfb-dea5-4de5-a557-40dc30532955'
      try {
        const asset = await alpaca.getAsset(symbol)
        expect(asset).to.have.property('asset_class')
      } catch (error) {
        expect(error.statusCode).to.equal(404)
      }
    })
  })
})
