'use strict';

require('../testUtils');

const expect = require('chai').expect;

describe('account resource', function() {
  it('returns 401 error if invalid API credentials are used', function(done) {
    const alpaca = require('../../lib/alpaca-trade-api')
    alpaca.configure({
      baseUrl: process.env.APCA_API_BASE_URL,
      keyId: process.env.APCA_API_KEY_ID,
      secretKey: 'fake secret',
    });
    expect(alpaca.getAccount()).to.be.rejectedWith('401').and.notify(done);
  });

  describe('get', function() {
    it('returns valid results; otherwise, returns 401 error', async function() {
      const alpaca = require('../../lib/alpaca-trade-api')
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY,
      });

      try {
        const account = await alpaca.getAccount();
        expect(account).to.include('id');
      } catch (error) {
        expect(error.statusCode).to.equal(401);
      }
    });
  });
});
