[![CircleCI](https://circleci.com/gh/alpacahq/alpaca-trade-api-js.svg?style=svg)](https://circleci.com/gh/alpacahq/alpaca-trade-api-js)

# Alpaca Trade API Node

Node.js library for Alpaca Trade API.

## API Documentation

The REST API documentation can be found in https://docs.alpaca.markets.

## Installation

```sh
npm install --save alpaca-trade-api
```

## Usage

* Require 'alpaca-trade-api' in your file.

  ```js
  var alpaca = require('alpaca-trade-api');
  ```
* Set API config options (baseUrl, keyId, secretKey).

  ```js
  const alpaca = new Alpaca({
    baseUrl: 'https://api.alpaca.markets', /* Optional: defaults to https://api.alpaca.markets */
    keyId: 'AKFZXJH121U18SHHDRFO',
    secretKey: 'pnq4YHlpMF3LhfLyOvmdfLmlz6BnASrTPQIASeiU'
  });
  ```
* Call methods, which will return a promise.

  ```js
  alpaca.getAccount().then((account) => {
    console.log('Current Account:', account);
  })
  ```
* Websocket example

  ```js
  const client = new alpaca.websockets.client();
  client.onConnect(function() {
    console.log("Connected");
    client.subscribe(['trade_updates', 'account_updates', 'T.FB', 'Q.AAPL', 'A.FB', 'AM.AAPL']);
    setTimeout(() => {
      client.disconnect();
    }, 30 * 1000);
  });
  client.onDisconnect(() => {
    console.log("Disconnected");
  });
  client.onStateChange(newState => {
    console.log(`State changed to ${newState}`);
  });
  client.onOrderUpdate(data => {
    console.log(`Order updates: ${JSON.stringify(data)}`);
  });
  client.onAccountUpdate(data => {
    console.log(`Account updates: ${JSON.stringify(data)}`);
  });
  client.onStockTrades(function(subject, data) {
    console.log(`Stock trades: ${subject}, ${data}`);
  });
  client.onStockQuotes(function(subject, data) {
    console.log(`Stock quotes: ${subject}, ${data}`);
  });
  client.onStockAggSec(function(subject, data) {
    console.log(`Stock agg sec: ${subject}, ${data}`);
  });
  client.onStockAggMin(function(subject, data) {
    console.log(`Stock agg min: ${subject}, ${data}`);
  });
  client.connect();
  ```

## Methods

### Account API
* `getAccount()`: Calls `GET /account` and returns the current account.

### Orders API
* `getOrders(status, until, limit)`: Calls `GET /orders` and returns a list of orders.
* `getOrder(id)`: Calls `GET /orders/{id}` and returns an order.
* `getOrderByClientOrderId(clientOrderId)`: Calls `GET /orders:by_client_order_id` and returns an order by client_order_id.
* `createOrder(order)`: Calls `POST /orders` and creates a new order.
* `cancelOrder(id)`: Calls `DELETE /orders/{id}` and deletes an order.

### Positions API
* `getPositions()`: Calls `GET /positions` and returns all positions.
* `getPosition(symbol)`: Calls `GET /positions/{symbol}` and returns a position.

### Assets API
* `getAssets({ status, asset_class })`: Calls `GET /assets` and returns all assets.
* `getAsset(symbol)`: Calls `GET /assets/{symbol}` and returns an asset.

### Calendar API
* `getCalendar(start, end)`: Calls `GET /calendar` and returns the market calendar.

### Websockets
* `let websocket = new alpaca.websockets.client();`: Create a websocket client instance.
* `websocket.connect()`: Connect to the alpaca server using websocket.
* `websocket.subscribe(channels)`: Subscribe to the alpaca server and possibly Polygon server
    Possible channels: 'trade_updates', 'account_updates', 'T.*', 'Q.*', 'A.*', AM.*'
        The first two are for the alpaca server, the rest are for the Polygon server.
        For more information, please contact the relevant pages.
* `websocket.onOrderUpdate(function(data))`: Register callback function for the channel 'trade_updates'.
* `websocket.onAccountUpdate(function(data))`: Register callback function for the channel 'account_updates'.
* `websocket.onStockTrades(function(data))`: Register callback function for the channel 'T.*'.
* `websocket.onStockQuotes(function(data))`: Register callback function for the channel 'Q.*'.
* `websocket.onStockAggSec(function(data))`: Register callback function for the channel 'A.*'.
* `websocket.onStockAggMin(function(data))`: Register callback function for the channel 'AM.*'.
