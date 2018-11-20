'use strict';

const expect = require('chai').expect;

const { buildQueryString } = require('../../lib/utils/url');

describe('url util', function() {
  describe('buildQueryString', function() {
    it('builds query string correctly', function() {
      const queryParams = {
        param1: 'abc',
        param2: 'xyz',
      };
      const queryString = buildQueryString(queryParams);
      expect(queryString).to.equal('?param1=abc&param2=xyz');
    });

    it('returns empty string if empty query param is passed', function() {
      const queryString = buildQueryString({});
      expect(queryString).to.equal('');
    });
  });
});
