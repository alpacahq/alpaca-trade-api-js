# Alpaca Trade API JS

[![npm version](https://img.shields.io/npm/v/@alpacahq/alpaca-trade-api.svg)](https://www.npmjs.com/package/@alpacahq/alpaca-trade-api)
[![CircleCI](https://circleci.com/gh/alpacahq/alpaca-trade-api-js.svg?style=shield)](https://circleci.com/gh/alpacahq/alpaca-trade-api-js)

Node.js library for Alpaca Trade API.

## API Documentation

The REST API documentation can be found in https://docs.alpaca.markets. For detailed information about an endpoint, please consult the REST API docs. Documentation specific to this library can be found below.

## Installation

```sh
npm install --save @alpacahq/alpaca-trade-api
```

## Usage

Import the module first.

```js
const Alpaca = require('@alpacahq/alpaca-trade-api')
```

Instantiate the API with config options, obtained from the dashboard at app.alpaca.markets.

```js
const alpaca = new Alpaca({
  keyId: 'AKFZXJH121U18SHHDRFO',
  secretKey: 'pnq4YHlpMF3LhfLyOvmdfLmlz6BnASrTPQIASeiU',
  paper: true,
  usePolygon: false
})
```

Note: `keyId` and `secretKey` may also be specified by setting the `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` environment variables, respectively. Also, rather than specifying `paper`, you may set `APCA_API_BASE_URL` as an environment variable to direct your API calls to the paper trading API.

Call methods, which will return a promise.

```js
alpaca.getAccount().then((account) => {
  console.log('Current Account:', account)
})
```

The websocket api is a good way to watch and react to the market
we have 2 types of websockets:
- data websocket: get updates data equities
- account/trade websocket: get updates on your account

please refer to this [example](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/examples/websocket_listener.js) 
code to see how to use the websockets. 

##### Data WS 
you could use one of the 2 websockets we provide:
1. The Alpaca WS
2. The Polygon WS

The default WS is Alpaca. and you could use it even if you don't have a
 funded account. The polygon WS can only be used with a funded account.
<br>In order to use the Polygon WS you need to pass this parameter to the
 Alpaca constructor `usePolygon: true`

##### Subscribing to the different WS
The other difference is the way we subscribe to different channels.
###### Alpaca
```js
  client.subscribe(['alpacadatav1/T.FB', 'alpacadatav1/Q.AAPL', 'alpacadatav1/AM.GOOG'])
``` 

###### Polygon
```js
  client.subscribe(['T.FB', 'Q.AAPL', 'AM.GOOG', 'A.TSLA'])
``` 
##### Example Code
```js
const client = alpaca.data_ws
client.onConnect(function() {
  console.log("Connected")
  client.subscribe(['alpacadatav1/T.FB', 'alpacadatav1/Q.AAPL', 'alpacadatav1/AM.AAPL']) // when using alpaca ws
  client.subscribe(['alpacadatav1/T.FB', 'Q.AAPL', 'A.FB', 'AM.AAPL'])  // when using polygon ws
})
client.onDisconnect(() => {
  console.log("Disconnected")
})
client.onStateChange(newState => {
  console.log(`State changed to ${newState}`)
})
client.onStockTrades(function(subject, data) {
  console.log(`Stock trades: ${subject}, price: ${data.price}`)
})
client.onStockQuotes(function(subject, data) {
  console.log(`Stock quotes: ${subject}, bid: ${data.bidprice}, ask: ${data.askprice}`)
})
client.onStockAggSec(function(subject, data) {
  console.log(`Stock agg sec: ${subject}, ${data}`)
})
client.onStockAggMin(function(subject, data) {
  console.log(`Stock agg min: ${subject}, ${data}`)
})
client.connect()
```

##### Account WS 
used like this
```js
const updates_client = this.alpaca.trade_ws
updates_client.onConnect(function () {
    console.log("Connected")
    const trade_keys = ['trade_updates', 'account_updates']
    updates_client.subscribe(trade_keys);
})
updates_client.onDisconnect(() => {
    console.log("Disconnected")
})
updates_client.onStateChange(newState => {
    console.log(`State changed to ${newState}`)
})
updates_client.onOrderUpdate(data => {
    console.log(`Order updates: ${JSON.stringify(data)}`)
})
updates_client.onAccountUpdate(data => {
    console.log(`Account updates: ${JSON.stringify(data)}`)
})
updates_client.connect()
```

## Methods

As a general rule, required method parameters are passed as plain function arguments, and the final parameter is an object containing any optional parameters to the method.

### Account API

#### Get Account

Calls `GET /account` and returns the current account.

```ts
getAccount() => Promise<Account>
```

### Account Configurations API

#### Get Account Configurations

Calls `GET /account/configurations` and returns the current account configurations.

```ts
getAccountConfigurations() => Promise<AccountConfigurations>
```

#### Update Account Configurations

Calls `PATCH /account/configurations` to update the account configurations, and returns
the updated configurations.

```ts
updateAccountConfigurations(AccountConfigurations) => Promise<AccountConfigurations>
```

#### Get Account Activities

Calls `GET /account/activities` and returns account actvities.

```ts
getAccountActivities({
  activityTypes: string | string[], // Any valid activity type
  until: Date,
  after: Date,
  direction: string,
  date: Date,
  pageSize: number,
  pageToken: string
}) => Promise<AccountActivity[]>
```

### Portfolio History API

#### Get Portfolio History

Calls `GET /account/portfolio/history` and returns portfolio history.

```ts
getPortfolioHistory({
  date_start: Date,
  date_end: Date,
  period: '1M' | '3M' | '6M' | '1A' | 'all' | 'intraday',
  timeframe: '1Min' | '5Min' | '15Min' | '1H' | '1D',
  extended_hours: Boolean
}) => Promise<PortfolioHistory>
```

### Orders API

#### Create Order

Calls `POST /orders` and creates a new order.

```ts
createOrder({
  symbol: string, // any valid ticker symbol
  qty: number,
  side: 'buy' | 'sell',
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop',
  time_in_force: 'day' | 'gtc' | 'opg' | 'ioc',
  limit_price: number, // optional,
  stop_price: number, // optional,
  client_order_id: string, // optional,
  extended_hours: boolean, // optional,
  order_class: string, // optional,
  take_profit: object, // optional,
  stop_loss: object, // optional,
  trail_price: string, // optional,
  trail_percent: string // optional,
}) => Promise<Order>
```

#### Get Orders

  Calls `GET /orders` and returns a list of orders.

```ts
getOrders({
  status: 'open' | 'closed' | 'all',
  after: Date,
  until: Date,
  limit: number,
  direction: 'asc' | 'desc'
}) => Promise<Order[]>
```

#### Get Order by ID

Calls `GET /orders/{id}` and returns an order.

```ts
getOrder(uuid) => Promise<Order>
```

#### Get Order by Client ID

Calls `GET /orders:by_client_order_id` and returns an order by `client_order_id`.
You can set `client_order_id` upon order creation to more easily keep track of your orders.

```ts
getOrderByClientOrderId(string) => Promise<Order>
```

#### Update Order by ID

Calls `PATCH /orders/{id}` and updates an existing open order. The updated order will have
a new ID.

```ts
replaceOrder(uuid) => Promise<Order>
```

#### Cancel Order

Calls `DELETE /orders/{id}` and deletes an order.

```ts
cancelOrder(uuid) => Promise
```

#### Cancel all Orders

Calls `DELETE /orders` and deletes all open orders.

```ts
cancelAllOrders() => Promise
```

### Positions API

#### Get Position

Calls `GET /positions/{symbol}` and returns a position.

```ts
getPosition(symbol) => Promise<Position>
```

#### Get All Positions

Calls `GET /positions` and returns all positions.

```ts
getPositions() => Promise<Position[]>
```

#### Close a Position
Calls `DELETE /positions/{symbol}` and liquidates your position in the given symbol.

```ts
closePosition(symbol) => Promise
```

#### Close all Positions
Calls `DELETE /positions` and liquidates all open positions.

```ts
closeAllPositions() => Promise
```

### Assets API

#### Get All Assets

Calls `GET /assets` and returns assets matching your parameters.

```ts
getAssets({
  status: 'active' | 'inactive',
  asset_class: string
}) => Promise<Asset[]>
```

#### Get information about an asset

Calls `GET /assets/{symbol}` and returns an asset entity.

```ts
getAsset(symbol) => Promise<Asset>
```

### Calendar API

Calls `GET /calendar` and returns the market calendar.

```ts
getCalendar({ start: Date, end: Date }) => Promise<Calendar[]>
```

### Data API

#### Get Bars

```ts
getBars(
  'minute' | '1Min' | '5Min' | '15Min' | 'day' | '1D',
  symbol | symbol[], // which ticker symbols to get bars for
  {
    limit: number,
    start: date isoformat string yyyy-mm-ddThh:MM:ss-04:00,
    end: date isoformat string yyyy-mm-ddThh:MM:ss-04:00,
    after: date isoformat string yyyy-mm-ddThh:MM:ss-04:00,
    until: date isoformat string yyyy-mm-ddThh:MM:ss-04:00
  }
) => Promise<BarsObject>
```
###### example
```js
this.alpaca.getBars('1Min', ['AAPL', 'TSLA'], {start:'2020-04-20T09:30:00-04:00', end:'2020-04-29T16:00:00-04:00'}).then((response) => {
          console.log(response)
        })

this.alpaca.getBars('1D', ['AAPL', 'TSLA'], {start:'2020-04-20T00:00:00-04:00', end:'2020-04-29T00:00:00-04:00samples'}).then((response) => {
          console.log(response)
        })


```
note: to get the date of response samples you could do this `console.log(new Date(resp['AAPL'][0].startEpochTime*1000))`

#### Get Aggregates

```ts
getAggregates(
  symbol: string,
  timespan: 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year',
  from: Date,
  to: Date,
) => Promise<AggregatesObject>
```
###### example
```js
this.alpaca.getAggregates('AAPL', 'minute', '2020-04-20', '2020-04-20').then((response) => {
          console.log(response)
        })
```

#### Last trade

```ts
lastTrade(
  symbol: string)
) => Promise<LastTradeObject>
```
###### example
```js
this.alpaca.lastTrade('AAPL').then((response) => {
          console.log(response)
        })
```

#### Last quote

```ts
lastQuote(
  symbol: string)
) => Promise<LastQuoteObject>
```
###### example
```js
this.alpaca.lastQuote('AAPL').then((response) => {
          console.log(response)
        })
```

### Websockets
When to use which websocket?
1. first of all - if you don't have a funded account you cannot use the
 polygon websocket. <br>The data in the Alpaca websocket is free (currently in
  beta) and this is your only option.
2. if you do have a funded account read the docs to understand exactly what
 are the differences between the data streams<br>
 
Now since there's is a redundancy in the data we assume that if you use one
 you will not use the other.<br>
The way you select which websocket to use is by setting the `usePolygon
` argument when creating the Alpaca instance (see example above). 
#### Working with websocket
* The websocket is created when you creating the Alpaca instance
* `let websocket = alpaca.data_ws`: Get the websocket client instance.
* `websocket.connect()`: Connect to the Alpaca server using websocket.
* `client.onConnect(function() {}`: all the following code should be inside
 this function because we should not do anything until we're connected to the
  websocket.
* `websocket.subscribe(channels)`: Subscribe to the Alpaca data server and/or
  the Polygon server.<br>
  Please note that Polygon and Alpaca servers use different channels. <br>
    You need to specify the channel you want to
   subscribe to as specified here:<br>
    Channels for the Polygon service: `['T.*', 'Q.*', 'A.*', 'AM.*']`.<br>
    Channels for the Alpaca data service: `['alpacadatav1/T
    .*', 'alpacadatav1/Q.*', 'alpacadatav1'/AM.*]`
    
    When calling `subscribe()` first it will unsubscribe from any previously
     subscribed channels (so if you want to add channels you need to specifiy
      all channels you want to subscribe to).<br>
    Channels `'trade_updates'`, `'account_updates'` and all `'alpacadatav1
    /*.*'` are for the Alpaca server; the rest are for the Polygon server.
    <br>In order to make calls to the Polygon API, you must have opened your Alpaca brokerage account.
    Otherwise Polygon's API will be unavailable.
#### Callbacks
how to get the data you subscribed to. we do this by calling these methods
 with our callback for each and every channel:
* `websocket.onOrderUpdate(function(data))`: Register callback function for the channel `'trade_updates'`.
* `websocket.onAccountUpdate(function(data))`: Register callback function for the channel `'account_updates'`.
* `websocket.onStockTrades(function(data))`: Register callback function for
 the channel `'T.<SYMBOL>'` or `'alpacadatav1/T.<SYMBOL>'`.
* `websocket.onStockQuotes(function(data))`: Register callback function for
 the channel `'Q.<SYMBOL>'` or `'alpacadatav1/Q.<SYMBOL>'`.
* `websocket.onStockAggSec(function(data))`: Register callback function for
 the channel `'A.<SYMBOL>'`. (Polygon only)
* `websocket.onStockAggMin(function(data))`: Register callback function for
 the channel `'AM.<SYMBOL>'` or `'alpacadatav1/AM.<SYMBOL>'`.
