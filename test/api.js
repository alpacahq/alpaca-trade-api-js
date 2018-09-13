'use strict';

require('./testUtils');

const expect = require('chai').expect;
const configuration = require('../lib/configuration');
const api = require('../lib/api');

describe('api', function() {
  describe('configure', function() {
    it('sets the configuration variables correctly', function() {
      const testConfig = {
        baseUrl: 'https://test.domain.com',
        keyId: 'test_id',
        secretKey: 'test_secret',
      };
      api.configure(testConfig);
      expect(configuration).to.deep.equal(testConfig);
    });
  });
});
