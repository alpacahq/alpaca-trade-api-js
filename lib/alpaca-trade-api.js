"use strict";

require("dotenv").config();

const api = require("./api");
const account = require("./resources/account");
const position = require("./resources/position");
const calendar = require("./resources/calendar");
const clock = require("./resources/clock");
const asset = require("./resources/asset");
const order = require("./resources/order");
const data = require("./resources/data");
const watchlist = require("./resources/watchlist");
const polygon = require("./resources/polygon");

const websockets = require("./resources/websockets");

function Alpaca(config = {}) {
    this.configuration = {
        baseUrl:
            config.baseUrl ||
            process.env.APCA_API_BASE_URL ||
            (config.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets"),
        dataBaseUrl:
            config.dataBaseUrl ||
            process.env.APCA_DATA_BASE_URL ||
            process.env.DATA_PROXY_WS ||
            "https://data.alpaca.markets",
        polygonBaseUrl:
            config.polygonBaseUrl || process.env.POLYGON_API_BASE_URL || "https://api.polygon.io",
        keyId: config.keyId || process.env.APCA_API_KEY_ID || "",
        secretKey: config.secretKey || process.env.APCA_API_SECRET_KEY || "",
        apiVersion: config.apiVersion || process.env.APCA_API_VERSION || "v2",
        oauth: config.oauth || process.env.APCA_API_OAUTH || "",
        usePolygon: config.usePolygon ? true : false, // should we use polygon
        // data or alpaca data
    };
    this.data_ws = new websockets.AlpacaStreamClient({
        url: this.configuration.usePolygon
            ? this.configuration.baseUrl
            : this.configuration.dataBaseUrl,
        apiKey: this.configuration.keyId,
        secretKey: this.configuration.secretKey,
        oauth: this.configuration.oauth,
        usePolygon: this.configuration.usePolygon,
    });
    this.data_ws.STATE = websockets.STATE;
    this.data_ws.EVENT = websockets.EVENT;
    this.data_ws.ERROR = websockets.ERROR;

    this.trade_ws = new websockets.AlpacaStreamClient({
        url: this.configuration.baseUrl,
        apiKey: this.configuration.keyId,
        secretKey: this.configuration.secretKey,
        oauth: this.configuration.oauth,
        usePolygon: this.configuration.usePolygon,
    });
    this.trade_ws.STATE = websockets.STATE;
    this.trade_ws.EVENT = websockets.EVENT;
    this.trade_ws.ERROR = websockets.ERROR;

    // Helper methods
    this.httpRequest = api.httpRequest;
    this.dataHttpRequest = api.dataHttpRequest;
    this.polygonHttpRequest = api.polygonHttpRequest;

    // Account
    this.getAccount = account.get;
    this.updateAccountConfigurations = account.updateConfigs;
    this.getAccountConfigurations = account.getConfigs;
    this.getAccountActivities = account.getActivities;
    this.getPortfolioHistory = account.getPortfolioHistory;

    // Positions
    this.getPositions = position.getAll;
    this.getPosition = position.getOne;
    this.closeAllPositions = position.closeAll;
    this.closePosition = position.closeOne;

    // Calendar
    this.getCalendar = calendar.get;

    // Clock
    this.getClock = clock.get;

    // Asset
    this.getAssets = asset.getAll;
    this.getAsset = asset.getOne;

    // Order
    this.getOrders = order.getAll;
    this.getOrder = order.getOne;
    this.getOrderByClientId = order.getByClientOrderId;
    this.createOrder = order.post;
    this.replaceOrder = order.patchOrder;
    this.cancelOrder = order.cancel;
    this.cancelAllOrders = order.cancelAll;

    // Data
    this.getAggregates = data.getAggregates;
    this.getBars = data.getBars;
    this.lastTrade = data.getLastTrade; // getLastTrade is already preserved for polygon
    this.lastQuote = data.getLastQuote; // getLastQuote is already preserved for polygon

    // Watchlists
    this.getWatchlists = watchlist.getAll;
    this.getWatchlist = watchlist.getOne;
    this.addWatchlist = watchlist.addWatchlist;
    this.addToWatchlist = watchlist.addToWatchlist;
    this.updateWatchlist = watchlist.updateWatchlist;
    this.deleteWatchlist = watchlist.deleteWatchlist;
    this.deleteFromWatchlist = watchlist.deleteFromWatchlist;

    // Polygon
    this.getExchanges = polygon.exchanges;
    this.getSymbolTypeMap = polygon.symbolTypeMap;
    this.getHistoricTradesV2 = polygon.historicTradesV2;
    this.getHistoricQuotesV2 = polygon.historicQuotesV2;
    this.getHistoricAggregatesV2 = polygon.historicAggregatesV2;
    this.getLastTrade = polygon.lastTrade;
    this.getLastQuote = polygon.lastQuote;
    this.getConditionMap = polygon.conditionMap;
    this.getCompany = polygon.company;
    this.getAnalysts = polygon.analysts;
    this.getDividends = polygon.dividends;
    this.getEarnings = polygon.earnings;
    this.getFinancials = polygon.financials;
    this.getSplits = polygon.splits;
    this.getNews = polygon.news;
    this.getSymbol = polygon.getSymbol;

    return this;
}

module.exports = Alpaca;
