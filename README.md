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

```js
const client = alpaca.websocket
client.onConnect(function() {
  console.log("Connected")
  client.subscribe(['trade_updates', 'account_updates', 'T.FB', 'Q.AAPL', 'A.FB', 'AM.AAPL'])
  setTimeout(() => {
    client.disconnect()
  }, 30 * 1000)
})
client.onDisconnect(() => {
  console.log("Disconnected")
})
client.onStateChange(newState => {
  console.log(`State changed to ${newState}`)
})
client.onOrderUpdate(data => {
  console.log(`Order updates: ${JSON.stringify(data)}`)
})
client.onAccountUpdate(data => {
  console.log(`Account updates: ${JSON.stringify(data)}`)
})
client.onStockTrades(function(subject, data) {
  console.log(`Stock trades: ${subject}, ${data}`)
})
client.onStockQuotes(function(subject, data) {
  console.log(`Stock quotes: ${subject}, ${data}`)
})
client.onStockAggSec(function(subject, data) {
  console.log(`Stock agg sec: ${subject}, ${data}`)
})
client.onStockAggMin(function(subject, data) {
  console.log(`Stock agg min: ${subject}, ${data}`)
})
client.connect()
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
getActivities({
  activityTypes: string | string[], // Any valid activity type
  until: Date,
  after: Date,
  direction: string,
  date: Date,
  pageSize: number
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
  type: 'market' | 'limit' | 'stop' | 'stop_limit',
  time_in_force: 'day' | 'gtc' | 'opg' | 'ioc',
  limit_price: number,
  stop_price: number,
  client_order_id: string // optional
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
    start: Date,
    end: Date,
    after: Date,
    until: Date
  }
) => Promise<BarsObject>
```

### Websockets

* `let websocket = alpaca.websocket`: Create a websocket client instance.
* `websocket.connect()`: Connect to the Alpaca server using websocket.
* `websocket.subscribe(channels)`: Subscribe to the Alpaca server and possibly the Polygon server.
    Possible channels: `['trade_updates', 'account_updates', 'T.*', 'Q.*', 'A.*', 'AM.*']`.
    This will unsubscribe from any previously subscribed channels.
    Channels `'trade_updates'` and `'account_updates'` are for the Alpaca server; the rest are for the Polygon server.
    In order to make calls to the Polygon API, you must have opened your Alpaca brokerage account.
    Otherwise Polygon's API will be unavailable.
* `websocket.onOrderUpdate(function(data))`: Register callback function for the channel `'trade_updates'`.
* `websocket.onAccountUpdate(function(data))`: Register callback function for the channel `'account_updates'`.
* `websocket.onStockTrades(function(data))`: Register callback function for the channel `'T.*'`.
* `websocket.onStockQuotes(function(data))`: Register callback function for the channel `'Q.*'`.
* `websocket.onStockAggSec(function(data))`: Register callback function for the channel `'A.*'`.
* `websocket.onStockAggMin(function(data))`: Register callback function for the channel `'AM.*'`.
