'use strict'

const expect = require('chai').expect
const Alpaca = require('../lib/alpaca-trade-api')


describe('alpaca-trade-api', function () {
  describe('configure', function () {
    it('sets the configuration variables correctly', function () {
      const testConfig = {
        apiVersion: 'v2',
        baseUrl: 'https://base.example.com',
        dataBaseUrl: 'https://data.example.com',
        polygonBaseUrl: 'https://polygon.example.com',
        keyId: 'test_id',
        secretKey: 'test_secret',
      }
      const alpaca = new Alpaca(testConfig)
      expect(alpaca.configuration).to.deep.equal(testConfig)
    })

    it('allows passing paper: true', () => {
      const paperConfig = {
        keyId: 'paper_id',
        secretKey: 'paper_secret',
        paper: true
      }
      const alpaca = new Alpaca(paperConfig)
      expect(alpaca.configuration).to.include({

      })
    })
  })
})
