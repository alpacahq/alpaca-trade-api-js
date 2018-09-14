'use strict';

require('../testUtils');

const expect = require('chai').expect;

describe('calendar resource', function() {
  describe('get', function() {
    it('returns valid results without a parameter', function(done) {
      const alpaca = require('../..');
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY
      });
      expect(alpaca.getCalendar()).to.eventually.include('date').notify(done);
    });

    it('returns valid results with `start` parameter', function(done) {
      const alpaca = require('../..');
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY
      });
      expect(alpaca.getCalendar('2018-01-01')).to.eventually.include('date').notify(done);
    });

    it('returns valid results with `end` parameter', function(done) {
      const alpaca = require('../..');
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY
      });
      expect(alpaca.getCalendar(undefined, '2018-01-01')).to.eventually.include('date').notify(done);
    });

    it('returns valid results with both parameters', function(done) {
      const alpaca = require('../..');
      alpaca.configure({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY
      });
      expect(alpaca.getCalendar('2017-01-01', '2018-01-01')).to.eventually.include('date').notify(done);
    });
  });
});
