'use strict';

require('../testUtils');

const expect = require('chai').expect;

const alpaca = require('../../lib/alpaca-trade-api');

alpaca.configure({
  baseUrl: process.env.APCA_API_BASE_URL,
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY
});

describe('order resource', function () {
  describe('getAll', function () {
    it('returns valid results without a parameter', function (done) {
      expect(alpaca.getOrders()).to.eventually.include('[').notify(done);
    });
  });

  describe('getOne', function () {
    it('returns 404 error if unknown order id is used', function (done) {
      const fakeOrderId = '904837e3-3b76-47ec-b432-046db621571b';
      expect(alpaca.getOrder(fakeOrderId)).to.be.rejectedWith('404').and.notify(done);
    });

    it('returns valid results if valid order id is used; otherwise, 404', async function () {
      const orderId = '904837e3-3b76-47ec-b432-046db621571b';
      try {
        const asset = await alpaca.getOrder(orderId);
        expect(asset).to.include('client_order_id');
      } catch (error) {
        expect(error.statusCode).to.equal(404);
      }
    });
  });

  describe('getByClientOrderId', function () {
    it('returns valid results if valid client order id is used; otherwise, 404', function (done) {
      try {
        const clientOrderId = 'myOrder1';
        expect(alpaca.getOrders(clientOrderId)).to.eventually.include('[').notify(done);
      } catch (error) {
        expect(error.statusCode).to.equal(404);
      }
    });
  });

  describe('post', function () {
    it('returns 422 error if market order contains stop_price or limit price', function (done) {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
        limit_price: '107.00',
        stop_price: '106.00',
        client_order_id: 'string'
      };
      expect(alpaca.createOrder(testOrder)).to.be.rejectedWith('422').notify(done);
    });

    it('returns 403 error(insufficient qty) if buying power or shares is not sufficient', function (done) {
      const testOrder = {
        symbol: 'AAPL',
        qty: 150000,
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      };
      expect(alpaca.createOrder(testOrder)).to.be.rejectedWith('403').notify(done);
    });

    it('creates a new valid order', async function () {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'buy',
        type: 'market',
        time_in_force: 'day'
      };
      const newOrder = await alpaca.createOrder(testOrder);
      expect(newOrder).to.include('client_order_id');
    });
  });

  describe('remove', function () {
    it('returns 404 error if unknown order id is used', function (done) {
      const fakeOrderId = '904837e3-3b76-47ec-b432-046db621571b';
      expect(alpaca.cancelOrder(fakeOrderId)).to.be.rejectedWith('404').and.notify(done);
    });

    it('removes order correctly', async function () {
      const testOrder = {
        symbol: 'AAPL',
        qty: 15,
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
      };
      const newOrder = JSON.parse(await alpaca.createOrder(testOrder));
      expect(alpaca.cancelOrder(newOrder.id)).to.be.fulfilled;
    });
  });
});
