'use strict';

require('./testUtils');

const expect = require('chai').expect;
const alpaca = require('../lib/alpaca-trade-api');

describe('alpaca-trade-api', function () {
  describe('configure', function () {
    it('sets the configuration variables correctly', function () {
      const testConfig = {
        baseUrl: 'https://base.example.com',
        polygonBaseUrl: 'https://polygon.example.com',
        keyId: 'test_id',
        secretKey: 'test_secret',
      };
      alpaca.configure(testConfig);
      expect(alpaca.configuration).to.deep.equal(testConfig);
    });
  });
});
