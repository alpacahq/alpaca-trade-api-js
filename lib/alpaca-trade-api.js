require("dotenv").config();

const api = require("./api");
const account = require("./resources/account");
const position = require("./resources/position");
const calendar = require("./resources/calendar");
const clock = require("./resources/clock");
const asset = require("./resources/asset");
const order = require("./resources/order");
const watchlist = require("./resources/watchlist");

const dataV2 = require("./resources/datav2/rest_v2");
const entityV2 = require("./resources/datav2/entityv2");
const crypto_websocket = require("./resources/datav2/crypto_websocket_v2");
const news_stream = require("./resources/datav2/news_websocket");
const websockets_v2 = require("./resources/datav2/stock_websocket_v2");

const websockets = require("./resources/websockets");

class Alpaca {
  constructor(config = {}) {
    this.configuration = {
      baseUrl:
        config.baseUrl ||
        process.env.APCA_API_BASE_URL ||
        (config.paper
          ? "https://paper-api.alpaca.markets"
          : "https://api.alpaca.markets"),
      dataBaseUrl:
        config.dataBaseUrl ||
        process.env.APCA_DATA_BASE_URL ||
        process.env.DATA_PROXY_WS ||
        "https://data.alpaca.markets",
      dataStreamUrl:
        config.dataStreamUrl ||
        process.env.APCA_API_STREAM_URL ||
        "https://stream.data.alpaca.markets",
      keyId: config.keyId || process.env.APCA_API_KEY_ID || "",
      secretKey: config.secretKey || process.env.APCA_API_SECRET_KEY || "",
      apiVersion: config.apiVersion || process.env.APCA_API_VERSION || "v2",
      oauth: config.oauth || process.env.APCA_API_OAUTH || "",
      feed: config.feed || "iex", // use 'sip' if you have PRO subscription
      verbose: config.verbose,
      exchanges: config.exchanges || [], // should be a string with comma separated exchanges
      // or a list of strings
    };
    this.data_ws = new websockets.AlpacaStreamClient({
      url: this.configuration.dataBaseUrl,
      apiKey: this.configuration.keyId,
      secretKey: this.configuration.secretKey,
      oauth: this.configuration.oauth,
    });
    this.data_ws.STATE = websockets.STATE;
    this.data_ws.EVENT = websockets.EVENT;
    this.data_ws.ERROR = websockets.ERROR;

    this.trade_ws = new websockets.AlpacaStreamClient({
      url: this.configuration.baseUrl,
      apiKey: this.configuration.keyId,
      secretKey: this.configuration.secretKey,
      oauth: this.configuration.oauth,
    });
    this.trade_ws.STATE = websockets.STATE;
    this.trade_ws.EVENT = websockets.EVENT;
    this.trade_ws.ERROR = websockets.ERROR;

    this.data_stream_v2 = new websockets_v2.AlpacaStocksClient({
      url: this.configuration.dataStreamUrl,
      feed: this.configuration.feed,
      apiKey: this.configuration.keyId,
      secretKey: this.configuration.secretKey,
      verbose: this.configuration.verbose,
    });

    this.adjustment = dataV2.Adjustment;
    this.timeframeUnit = entityV2.TimeFrameUnit;
    this.crypto_stream_v2 = new crypto_websocket.AlpacaCryptoClient({
      url: this.configuration.dataStreamUrl,
      apiKey: this.configuration.keyId,
      secretKey: this.configuration.secretKey,
      exchanges: this.configuration.exchanges,
      verbose: this.configuration.verbose,
    });

    this.news_stream = new news_stream.AlpacaNewsCLient({
      url: this.configuration.dataStreamUrl,
      apiKey: this.configuration.keyId,
      secretKey: this.configuration.secretKey,
      verbose: this.configuration.verbose,
    });
  }

  // Helper methods
  httpRequest = api.httpRequest.bind(this);
  dataHttpRequest = api.dataHttpRequest;
  sendRequest(endpoint, queryParams, body, method) {
    return api.sendRequest(
      this.httpRequest,
      endpoint,
      queryParams,
      body,
      method
    );
  }

  // Account
  getAccount = account.get;
  updateAccountConfigurations = account.updateConfigs;
  getAccountConfigurations = account.getConfigs;
  getAccountActivities = account.getActivities;
  getPortfolioHistory = account.getPortfolioHistory;

  // Positions
  getPositions = position.getAll;
  getPosition = position.getOne;
  closeAllPositions = position.closeAll;
  closePosition = position.closeOne;

  // Calendar
  getCalendar = calendar.get;

  // Clock
  getClock = clock.get;

  // Asset
  getAssets = asset.getAll;
  getAsset = asset.getOne;

  // Order
  getOrders = order.getAll;
  getOrder = order.getOne;
  getOrderByClientId = order.getByClientOrderId;
  createOrder = order.post;
  replaceOrder = order.patchOrder;
  cancelOrder = order.cancel;
  cancelAllOrders = order.cancelAll;

  //DataV2
  getTradesV2(symbol, options, config = this.configuration) {
    return dataV2.getTrades(symbol, options, config);
  }
  getMultiTradesV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiTrades(symbols, options, config);
  }
  getMultiTradesAsyncV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiTradesAsync(symbols, options, config);
  }
  getQuotesV2(symbol, options, config = this.configuration) {
    return dataV2.getQuotes(symbol, options, config);
  }
  getMultiQuotesV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiQuotes(symbols, options, config);
  }
  getMultiQuotesAsyncV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiQuotesAsync(symbols, options, config);
  }
  getBarsV2(symbol, options, config = this.configuration) {
    return dataV2.getBars(symbol, options, config);
  }
  getMultiBarsV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiBars(symbols, options, config);
  }
  getMultiBarsAsyncV2(symbols, options, config = this.configuration) {
    return dataV2.getMultiBarsAsync(symbols, options, config);
  }
  getLatestTrade(symbol, config = this.configuration) {
    return dataV2.getLatestTrade(symbol, config);
  }
  getLatestTrades(symbols, config = this.configuration) {
    return dataV2.getLatestTrades(symbols, config);
  }
  getLatestQuote(symbol, config = this.configuration) {
    return dataV2.getLatestQuote(symbol, config);
  }
  getLatestQuotes(symbols, config = this.configuration) {
    return dataV2.getLatestQuotes(symbols, config);
  }
  getLatestBar(symbol, config = this.configuration) {
    return dataV2.getLatestBar(symbol, config);
  }
  getLatestBars(symbols, config = this.configuration) {
    return dataV2.getLatestBars(symbols, config);
  }
  getSnapshot(symbol, config = this.configuration) {
    return dataV2.getSnapshot(symbol, config);
  }
  getSnapshots(symbols, config = this.configuration) {
    return dataV2.getSnapshots(symbols, config);
  }
  getCryptoTrades(symbol, options, config = this.configuration) {
    return dataV2.getCryptoTrades(symbol, options, config);
  }
  getCryptoQuotes(symbol, options, config = this.configuration) {
    return dataV2.getCryptoQuotes(symbol, options, config);
  }
  getCryptoBars(symbol, options, config = this.configuration) {
    return dataV2.getCryptoBars(symbol, options, config);
  }
  getLatestCryptoTrades(symbols, config = this.configuration) {
    return dataV2.getLatestCryptoTrades(symbols, config);
  }
  getLatestCryptoQuotes(symbols, config = this.configuration) {
    return dataV2.getLatestCryptoQuotes(symbols, config);
  }
  getLatestCryptoBars(symbols, config = this.configuration) {
    return dataV2.getLatestCryptoBars(symbols, config);
  }
  getLatestCryptoXBBO(symbol, options, config = this.configuration) {
    return dataV2.getLatestCryptoXBBO(symbol, options, config);
  }
  getLatestCryptoXBBOs(symbols, options, config = this.configuration) {
    return dataV2.getLatestCryptoXBBOs(symbols, options, config);
  }
  getCryptoSnapshots(symbols, config = this.configuration) {
    return dataV2.getCryptoSnapshots(symbols, config);
  }
  getLatestCryptoOrderbooks(symbols, config = this.configuration) {
    return dataV2.getLatestCryptoOrderbooks(symbols, config);
  }
  getNews(options, config = this.configuration) {
    return dataV2.getNews(options, config);
  }
  newTimeframe(amount, unit) {
    return entityV2.NewTimeframe(amount, unit);
  }

  // Watchlists
  getWatchlists = watchlist.getAll;
  getWatchlist = watchlist.getOne;
  addWatchlist = watchlist.addWatchlist;
  addToWatchlist = watchlist.addToWatchlist;
  updateWatchlist = watchlist.updateWatchlist;
  deleteWatchlist = watchlist.deleteWatchlist;
  deleteFromWatchlist = watchlist.deleteFromWatchlist;
}

module.exports = Alpaca;
