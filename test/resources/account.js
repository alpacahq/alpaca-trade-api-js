'use strict';

require('../testUtils');

const expect = require('chai').expect;

describe('account resource', function() {
  describe('get', function() {
    it('returns valid results', function(done) {
      const alpaca = require('../..')
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY,
      });
      expect(alpaca.getAccount()).to.eventually.include('id').notify(done);
    });
  });
});
