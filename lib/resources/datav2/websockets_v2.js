"use strict";

const events = require("events");
const WebSocket = require("ws");
const entityv2 = require("./entityv2");

// Listeners
// A client can listen on any of the following events, states, or errors

// Connection states. Each of these will also emit EVENT.STATE_CHANGE
const STATE = {
  AUTHENTICATING: "authenticating",
  AUTHENTICATED: "authenticated",
  CONNECTED: "connected",
  CONNECTING: "connecting",
  DISCONNECTED: "disconnected",
  WAITING_TO_CONNECT: "waiting to connect",
  WAITING_TO_RECONNECT: "waiting to reconnect",
};

// CLient events
const EVENT = {
  CLIENT_ERROR: "client error",
  STATE_CHANGE: "state change",
  AUTHORIZED: "authorized",
  UNAUTHORIZED: "unauthorized",
  STOCK_TRADES: "stock_trades",
  STOCK_QUOTES: "stock_quotes",
  STOCK_BARS: "stock_bars",
  STOCK_DAILY_BARS: "stock_daily_bars",
};

// Connection errors
const CONN_ERROR = {
  400: "invalid syntax",
  401: "not authenticated",
  402: "auth failed",
  403: "already authenticated",
  404: "auth timeout",
  405: "symbol limit exceeded",
  406: "connection limit exceeded",
  407: "slow client",
  408: "v2 not enabled",
  409: "insufficient subscription",
  500: "internal error",
  MISSING_SECERT_KEY: "missing secret key",
  MISSING_API_KEY: "missing api key",
  UNEXPECTED_MESSAGE: "unexpected message",
};

class AlpacaStreamV2Client extends events.EventEmitter {
  constructor(options = {}) {
    super();
    this.session = {
      apiKey: options.apiKey,
      secretKey: options.secretKey,
      subscriptions: {
        trades: [],
        quotes: [],
        bars: [],
        dailyBars: [],
      },
      reconnect: true,
      // If true, client outputs detailed log messages
      verbose: options.verbose,
      // Reconnection backoff: if true, then the reconnection time will be initially
      // reconnectTimeout, then will double with each unsuccessful connection attempt.
      // It will not exceed maxReconnectTimeout
      backoff: true,
      // Initial reconnect timeout (seconds) a minimum of 1 will be used if backoff=false
      reconnectTimeout: 0,
      // The maximum amount of time between reconnect tries (applies to backoff)
      maxReconnectTimeout: 30,
      // The amount of time to increment the delay between each reconnect attempt
      backoffIncrement: 0.5,
      url:
        "wss" +
        options.url.substr(options.url.indexOf(":")) +
        "/v2/" +
        options.feed,
      currentState: STATE.WAITING_TO_CONNECT,
    };

    if (this.session.apiKey.length === 0) {
      throw new Error(CONN_ERROR.MISSING_API_KEY);
    }
    if (this.session.secretKey.length === 0) {
      throw new Error(CONN_ERROR.MISSING_SECERT_KEY);
    }

    // Register internal event handlers
    // Log and emit every state change
    Object.keys(STATE).forEach((s) => {
      this.on(STATE[s], () => {
        this.session.currentState = STATE[s];
        this.emit(EVENT.STATE_CHANGE, STATE[s]);
      });
    });
  }

  onConnect(fn) {
    this.on(STATE.AUTHENTICATED, () => {
      fn();
      //if reconnected the user should subcribe to its symbols again
      this.subscribeAll();
    });
  }

  connect() {
    this.emit(STATE.CONNECTING);
    this.session.currentState = STATE.CONNECTING;
    this.conn = new WebSocket(this.session.url, {
      perMessageDeflate: {
        serverNoContextTakeover: false,
        clientNoContextTakeover: false,
      },
    });
    this.conn.once("open", () => this.authenticate());
    this.conn.on("message", (data) => {
      this.handleMessage(data);
    });
    this.conn.once("close", () => {
      this.emit(STATE.DISCONNECTED);
      this.session.currentState = STATE.DISCONNECTED;
      if (this.session.reconnect) {
        this.reconnecting();
      } else {
        this.disconnect();
      }
    });
  }

  reconnecting() {
    setTimeout(() => {
      if (this.session.backoff) {
        this.session.reconnectTimeout += this.session.backoffIncrement;
        if (this.session.reconnectTimeout > this.session.maxReconnectTimeout) {
          this.session.reconnectTimeout = this.session.maxReconnectTimeout;
        }
      }
      this.connect();
    }, this.session.reconnectTimeout * 1000);
    this.emit(STATE.WAITING_TO_RECONNECT, this.session.reconnectTimeout);
  }

  subscribeForTrades(trades) {
    this.session.subscriptions.trades.push(...trades);
    this.subscribe(trades, [], [], []);
  }

  subscribeForQuotes(quotes) {
    this.session.subscriptions.quotes.push(...quotes);
    this.subscribe([], quotes, [], []);
  }

  subscribeForBars(bars) {
    this.session.subscriptions.bars.push(...bars);
    this.subscribe([], [], bars, []);
  }

  subscribeForDailyBars(dailyBars) {
    this.session.subscriptions.dailyBars.push(...dailyBars);
    this.subscribe([], [], [], dailyBars);
  }

  subscribe(trades, quotes, bars, dailyBars) {
    const subMsg = {
      action: "subscribe",
      trades: trades,
      quotes: quotes,
      bars: bars,
      dailyBars: dailyBars,
    };
    this.conn.send(JSON.stringify(subMsg));
  }

  subscribeAll() {
    if (
      this.session.subscriptions.trades.length > 0 ||
      this.session.subscriptions.quotes.length > 0 ||
      this.session.subscriptions.bars.length > 0
    ) {
      const msg = {
        action: "subscribe",
        trades: this.session.subscriptions.trades,
        quotes: this.session.subscriptions.quotes,
        bars: this.session.subscriptions.bars,
      };
      this.conn.send(JSON.stringify(msg));
    }
  }

  unsubscribeFromTrades(trades) {
    this.session.subscriptions.trades =
      this.session.subscriptions.trades.filter(
        (trade) => !trades.includes(trade)
      );
    this.unsubscribe(trades, [], [], []);
  }

  unsubscribeFromQuotes(quotes) {
    this.session.subscriptions.quotes =
      this.session.subscriptions.quotes.filter(
        (quote) => !quotes.includes(quote)
      );
    this.unsubscribe([], quotes, [], []);
  }

  unsubscribeFromBars(bars) {
    this.session.subscriptions.bars = this.session.subscriptions.bars.filter(
      (bar) => !bars.includes(bar)
    );
    this.unsubscribe([], [], bars, []);
  }

  unsubscriceFromDailyBars(dailyBars) {
    this.session.subscriptions.dailyBars =
      this.session.subscriptions.dailyBars.filter(
        (dailyBar) => !dailyBars.includes(dailyBar)
      );
    this.unsubscribe([], [], [], dailyBars);
  }

  unsubscribe(trades, quotes, bars, dailyBars) {
    const unsubMsg = {
      action: "unsubscribe",
      trades: trades,
      quotes: quotes,
      bars: bars,
      dailyBars: dailyBars,
    };
    this.conn.send(JSON.stringify(unsubMsg));
  }

  updateSubscriptions(msg) {
    this.log(
      "info",
      `listening to streams: 
        trades: ${msg.trades},
        quotes: ${msg.quotes},
        bars: ${msg.bars},
        dailyBars: ${msg.dailyBars}`
    );
    this.session.subscriptions = {
      trades: msg.trades,
      quotes: msg.quotes,
      bars: msg.bars,
      dailyBars: msg.dailyBars,
    };
  }

  onStockTrade(fn) {
    this.on(EVENT.STOCK_TRADES, (trade) => fn(trade));
  }

  onStockQuote(fn) {
    this.on(EVENT.STOCK_QUOTES, (quote) => fn(quote));
  }

  onStockBar(fn) {
    this.on(EVENT.STOCK_BARS, (bar) => fn(bar));
  }

  onStockDailyBar(fn) {
    this.on(EVENT.STOCK_DAILY_BARS, (dailyBar) => fn(dailyBar));
  }

  onError(fn) {
    this.on(EVENT.CLIENT_ERROR, (err) => fn(err));
  }

  onStateChange(fn) {
    this.on(EVENT.STATE_CHANGE, (newState) => fn(newState));
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    const msgType = message[0] ? message[0].T : null;

    if (msgType == null) {
      this.emit(ERROR.UNEXPECTED_MESSAGE);
      return;
    }

    switch (msgType) {
      case "success":
        if (message[0].msg === "connected") {
          this.emit(STATE.CONNECTED);
          this.session.currentState = STATE.CONNECTED;
        } else if (message[0].msg === "authenticated") {
          this.session.authenticated = true;
          this.emit(STATE.AUTHENTICATED);
          this.session.currentState = STATE.AUTHENTICATED;
        }
        break;
      case "subscription":
        this.updateSubscriptions(message[0]);
        break;
      case "error":
        this.emit(EVENT.CLIENT_ERROR, CONN_ERROR[message[0].code]);
        break;
      default:
        this.dataHandler(message);
    }
  }

  dataHandler(data) {
    data.forEach((element) => {
      if ("T" in element) {
        switch (element.T) {
          case "t":
            this.emit(EVENT.STOCK_TRADES, entityv2.AlpacaTradeV2(element));
            break;
          case "q":
            this.emit(EVENT.STOCK_QUOTES, entityv2.AlpacaQuoteV2(element));
            break;
          case "b":
            this.emit(EVENT.STOCK_BARS, entityv2.AlpacaBarV2(element));
            break;
          case "d":
            this.emit(EVENT.STOCK_DAILY_BARS, entityv2.AlpacaBarV2(element));
            break;
          default:
            this.emit(EVENT.CLIENT_ERROR, CONN_ERROR.UNEXPECTED_MESSAGE);
        }
      }
    });
  }

  authenticate() {
    const authMsg = {
      action: "auth",
      key: this.session.apiKey,
      secret: this.session.secretKey,
    };
    this.conn.send(JSON.stringify(authMsg));
    this.emit(STATE.AUTHENTICATING);
    this.session.currentState = STATE.AUTHENTICATING;
  }

  onDisconnect(fn) {
    this.on(EVENT.DISCONNECTED, () => fn());
  }

  disconnect() {
    this.emit(EVENT.DISCONNECTED);
    this.session.currentState = STATE.DISCONNECTED;
    this.conn.close();
    this.session.reconnect = false;
  }

  log(level, ...msg) {
    if (this.session.verbose) {
      console[level](...msg);
    }
  }

  getSubscriptions() {
    return this.session.subscriptions;
  }
}

module.exports = {
  AlpacaStreamV2Client: AlpacaStreamV2Client,
};
