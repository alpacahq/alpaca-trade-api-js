'use strict'

// CAUTION: This test makes real api calls and real orders,
// unless you have environment variables pointed at a paper account.
// It also will not work outside of market hours.
// Don't run this in an automated environment,
// only run it to verify things locally.

const Alpaca = require('../lib/alpaca-trade-api')

const paca = new Alpaca({
  paper: true
});

const socket = paca.data_ws;

(async function () {
  console.log(await paca.getAccount())
  console.log(await paca.getClock())
  console.log(await paca.getCalendar({ start: '2018-12-01', end: new Date() }))

  socket.onConnect((...args) => {
    console.log('CONNECTED', ...args)
    socket.subscribe(['T.AAPL', 'T.TWTR', 'Q.*'])
  })

  socket.onStockTrades((subject, data) => {
    console.log('STOCK TRADES', data.sym)
  })

  socket.onOrderUpdate((...args) => {
    console.log('ORDER UPDATE', ...args)
  })

  socket.onStateChange((...args) => {
    console.log('STATE CHANGE', ...args)
  })

  socket.connect()

  let order = await paca.createOrder({
    symbol: 'TWTR',
    qty: 2,
    side: 'buy',
    type: 'stop_limit',
    time_in_force: 'gtc',
    limit_price: 20.52,
    stop_price: 20.12,
    client_order_id: `test_${Math.random()}`
  })
  await paca.cancelOrder(order.id)
  console.log(await paca.getOrderByClientId(order.client_order_id))
  console.log(await paca.getOrders({ status: 'canceled', limit: 2 }))

  console.log(await paca.getAsset('AAPL'))
  await paca.getAssets({ status: 'inactive', asset_class: 'us_equity' })

  console.log(await paca.getBars('1D', ['MSFT', 'AAPL'], {
    limit: 4,
    start: new Date('December 1 2018'),
    end: new Date()
  }))

  // fractional 
  order = await paca.createOrder({
    symbol: 'AAPL',
    qty: 2.324,
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
  })

  // notional 
  order = await paca.createOrder({
    symbol: 'TSLA',
    notional: 124.23,
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
  })

  await new Promise((r) => setTimeout(r, 1500))
  console.log(await paca.getPositions())

  await socket.disconnect()

  console.log('\n✓ done')
})()

