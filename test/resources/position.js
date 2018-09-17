'use strict';

require('../testUtils');

const expect = require('chai').expect;

const alpaca = require('../../lib/alpaca-trade-api')

alpaca.configure({
  baseUrl: process.env.APCA_API_BASE_URL,
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
});

describe('position resource', function() {
  describe('getAll', function() {
    it('returns valid results', function(done) {
      expect(alpaca.getPositions()).to.eventually.include('[').notify(done);
    });
  });

  describe('getOne', function() {
    it('returns 422 error if unknown symbol is used', function(done) {
      const fakeSymbol = 'I don\'t exist!';
      expect(alpaca.getPosition(fakeSymbol)).to.be.rejectedWith('422').and.notify(done);
    });

    it('returns valid results if valid symbol is used; otherwise, 422', async function() {
      const symbol = '411101bc-4d72-4c07-acec-e9a2a8cbb9f5';
      try {
        const position = await alpaca.getPosition(symbol);
        expect(position).to.include('asset_id');
      } catch (error) {
        expect(error.statusCode).to.equal(422);
      }
    });
  });
});
