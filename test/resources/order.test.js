'use strict'

const expect = require('chai').expect
const mockAlpaca = require('../mock-alpaca')
const Alpaca = require('../../lib/alpaca-trade-api')


describe('order resource', function () {

  const alpaca = new Alpaca(mockAlpaca.getConfig())

  describe('getAll', function () {
    it('returns valid results without a parameter', function () {
      return expect(alpaca.getOrders()).to.eventually.include('[')
    })
  })

  describe('getOne', function () {
    it('returns 404 error if unknown order id is used', function () {
      const fakeOrderId = 'nonexistent_order_id'
      return expect(alpaca.getOrder(fakeOrderId)).to.be.rejectedWith('404')
    })
  })

  describe('getByClientOrderId', function () {
    it('returns valid results if valid client order id', async function () {
      const orderId = '904837e3-3b76-47ec-b432-046db621571b'
      const asset = await alpaca.getOrderByClientId(orderId)
      expect(asset).to.include('client_order_id')
    })
  })

  describe('post', function () {
    it('returns 422 error if market order contains stop_price or limit price', function () {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
        limit_price: '107.00',
        stop_price: '106.00',
        client_order_id: 'string'
      }
      return expect(alpaca.createOrder(testOrder)).to.be.rejectedWith('422')
    })

    it('returns 403 error(insufficient qty) if buying power or shares is not sufficient', function () {
      const testOrder = {
        symbol: 'INSUFFICIENT',
        qty: 150000,
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      }
      return expect(alpaca.createOrder(testOrder)).to.be.rejectedWith('403')
    })

    it('creates a new valid order', async function () {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'buy',
        type: 'market',
        time_in_force: 'day'
      }
      const newOrder = await alpaca.createOrder(testOrder)
      expect(newOrder).to.include('client_order_id')
    })
  })

  describe('remove', function () {
    it('returns 404 error if unknown order id is used', function () {
      const fakeOrderId = 'nonexistent_order_id'
      return expect(alpaca.cancelOrder(fakeOrderId)).to.be.rejectedWith('404')
    })

    it('removes order correctly', async function () {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
      }
      const newOrder = JSON.parse(await alpaca.createOrder(testOrder))
      return expect(alpaca.cancelOrder(newOrder.id)).to.be.fulfilled
    })
  })
})
