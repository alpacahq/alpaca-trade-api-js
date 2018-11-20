'use strict';

const expect = require('chai').expect;

const Alpaca = require('../../lib/alpaca-trade-api')
const alpaca = new Alpaca({
  baseUrl: process.env.APCA_API_BASE_URL,
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
});

describe('clock resource', function () {
  describe('get', function () {
    it('returns valid results', function (done) {
      expect(alpaca.getClock()).to.eventually.include('timestamp').notify(done);
    });
  });
});
