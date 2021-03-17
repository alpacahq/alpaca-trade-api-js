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

please refer to this [example](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/examples/websocket_example_datav2.js) 
code to see how to use the websockets. 

##### Data WS 
The Alapca websocket service now supports V2. Make sure you update your old sample code accordingly.<br> 
You could use it even if you don't have a funded account. <br>


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

### Watchlist API
available methods for you to use:

```js
module.exports = {
    getWatchlists,
    getWatchlist,
    addWatchlist,
    addToWatchlist,
    updateWatchlist,
    deleteWatchlist,
    deleteFromWatchlist,
}
```

#### Get All Watchlists
```js
this.alpaca.getWatchlists().then((response) => {
      console.log(response)
    })
```

#### Get Specific Watchlist
```js
 // xxxx.. are the watchlist id you get on creation or with gat all
 this.alpaca.getWatchlist('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').then((response) => {
      console.log(response)
    })
```

#### Add a Watchlist
```js
this.alpaca.addWatchlist("myWatchList", []).then((response) => {
      console.log(response)
    })
```
#### Add to Watchlist

```js
this.alpaca.addToWatchlist('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', "AAPL").then((response) => {
  console.log(response)
})
```
#### Update a Watchlist
```js
this.alpaca.updateWatchlist("myWatchList", ["AAPL", "GOOG"]).then((response) => {
      console.log(response)
    })
```
#### Delete a Watchlist
```js
this.alpaca.deleteWatchlist('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').then((response) => {
      console.log(response)
    })
```

#### Delete from Watchlist
```js
this.alpaca.deleteFromWatchlist('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', "AAPL").then((response) => {
  console.log(response)
})
```

### Data API

#### Get Bars

```ts
getBarsV2(
  symbol,
  
  {
    limit: number,
    start: date isoformat string yyyy-mm-ddThh:MM:ss-04:00,
    end: date isoformat string yyyy-mm-ddThh:MM:ss-04:00,
    timeframe: "1Min" | "1Hour" | "1Day"
  }
) => Promise<BarsObject>
```
###### example
```js
let resp = this.alpaca.getBarsV2(
    "AAPL",
    {
        start: "2021-02-01",
        end: "2021-02-10",
        limit: 2,
        timeframe: "1Day",
        adjustment: "all",
    },
    alpaca.configuration
);
const bars = [];

for await (let b of resp) {
    console.log(b)
}
```
note: to get the date of response samples you could do this `console.log(new Date(resp['AAPL'][0].startEpochTime*1000))`

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
