'use strict'

const expect = require('chai').expect
const Alpaca = require('../../lib/alpaca-trade-api')
const mock = require('../mock-alpaca')

describe('account resource', function () {
  it('returns 401 error if invalid API credentials are used', function () {
    const alpaca = new Alpaca({
      baseUrl: process.env.APCA_API_BASE_URL,
      keyId: process.env.APCA_API_KEY_ID,
      secretKey: 'invalid_secret',
    })
    return expect(alpaca.getAccount()).to.be.rejectedWith('401')
  })

  describe('get', function () {
    it('returns valid results', async function () {
      const alpaca = new Alpaca({
        baseUrl: process.env.APCA_API_BASE_URL,
        keyId: process.env.APCA_API_KEY_ID,
        secretKey: process.env.APCA_API_SECRET_KEY,
      })
      const account = await alpaca.getAccount()
      expect(account).to.include('id')
    })
  })
})
