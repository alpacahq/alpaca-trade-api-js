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
  alpaca.configure({
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
* `getAssets(status, assetClass)`: Calls `GET /assets` and returns all assets.
* `getAsset(symbol)`: Calls `GET /assets/{symbol}` and returns an asset.

### Calendar API
* `getCalendar(start, end)`: Calls `GET /calendar` and returns the market calendar.
