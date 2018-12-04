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

const alpacaSocks = paca.websockets;

(async function () {
  console.log(await paca.getAccount())
  console.log(await paca.getClock())
  console.log(await paca.getCalendar({ start: '2018-12-01', end: new Date() }))

  alpacaSocks.onConnect((...args) => {
    console.log('CONNECTED', ...args)

    alpacaSocks.subscribe(['T.*', 'Q.*'])
  })

  alpacaSocks.onStockTrades((...args) => {
    console.log('STOCK TRADES', ...args)
  })

  alpacaSocks.onStockQuotes((...args) => {
    console.log('STOCK QUOTES', ...args)
  })

  alpacaSocks.onOrderUpdate((...args) => {
    console.log('ORDER UPDATE', ...args)
  })

  alpacaSocks.onStateChange((...args) => {
    console.log('STATE CHANGE', ...args)
  })

  alpacaSocks.connect()

  const order = await paca.createOrder({
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

  const positions = await paca.getPositions()
  console.log(await paca.getPosition(positions[0].symbol))

  console.log(await paca.getAsset('AAPL'))
  await paca.getAssets({ status: 'inactive', asset_class: 'us_equity' })

  console.log(await paca.getBars('1D', ['MSFT', 'AAPL'], {
    limit: 4,
    start: new Date('December 1 2018'),
    end: new Date()
  }))

  console.log(await paca.getExchanges())
  console.log(await paca.getSymbolTypeMap())
  console.log(await paca.getHistoricTrades('AAPL', new Date(), { limit: 2, offset: 2 }))
  console.log(await paca.getHistoricQuotes('AAPL', new Date(), { limit: 2, offset: 2 }))
  console.log(await paca.getHistoricAggregates('minute', 'AAPL', {
    from: new Date('December 1 2018'),
    to: new Date(),
    limit: 2,
    unadjusted: false,
  }))
  console.log(await paca.getLastTrade('AAPL'))
  console.log(await paca.getLastQuote('AAPL'))
  console.log(await paca.getConditionMap())
  console.log(await paca.getCompany('AAPL'))
  console.log(await paca.getAnalysts('AAPL'))
  console.log(await paca.getDividends('AAPL'))
  console.log(await paca.getSplits('AAPL'))
  console.log(await paca.getFinancials('AAPL'))
  console.log(await paca.getEarnings('AAPL'))
  console.log(await paca.getNews('AAPL'))

  await alpacaSocks.disconnect()

  console.log('\n✓ done')
})()

