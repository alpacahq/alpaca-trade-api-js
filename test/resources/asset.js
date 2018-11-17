'use strict';

require('../testUtils');

const expect = require('chai').expect;

const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca({
  baseUrl: process.env.APCA_API_BASE_URL,
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
});

describe('asset resource', function () {
  describe('getAll', function () {
    it('returns valid results without parameters', function (done) {
      expect(alpaca.getAssets()).to.eventually.include('[').notify(done);
    });

    it('returns valid results with a status parameter', function (done) {
      expect(alpaca.getAssets('active')).to.eventually.include('[').notify(done);
    });

    it('returns valid results with an asset_class parameter', function (done) {
      expect(alpaca.getAssets(null, 'us_equity')).to.eventually.include('[').notify(done);
    });

    it('returns valid results with both parameters', function (done) {
      expect(alpaca.getAssets('inactive', 'us_equity')).to.eventually.include('[').notify(done);
    });
  });

  describe('getOne', function () {
    it('returns 404 error if unknown symbol is used', function (done) {
      const fakeSymbol = 'I don\'t exist!';
      expect(alpaca.getAsset(fakeSymbol)).to.be.rejectedWith('404').and.notify(done);
    });

    it('returns valid results if valid symbol is used; otherwise, 404', async function () {
      const symbol = '7b8bfbfb-dea5-4de5-a557-40dc30532955';
      try {
        const asset = await alpaca.getAsset(symbol);
        expect(asset).to.include('asset_class');
      } catch (error) {
        expect(error.statusCode).to.equal(404);
      }
    });
  });
});
