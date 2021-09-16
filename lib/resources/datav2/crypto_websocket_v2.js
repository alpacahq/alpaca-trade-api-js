"use strict";

const events = require("events");
const WebSocket = require("ws");
const msgpack = require("msgpack5")();
const entityv2 = require("./entityv2");
const { CRYPTO_EVENT, CONN_ERROR, STATE } = require("./websocket");

class AlpacaCryptoClient extends events.EventEmitter {
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
      url: this.getUrl(options.url, options.exchanges),
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
        this.emit(CRYPTO_EVENT.STATE_CHANGE, STATE[s]);
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
      headers: {
        "Content-Type": "application/msgpack",
      },
    });
    this.conn.binaryType = "nodebuffer";
    this.conn.once("open", () => this.authenticate());
    this.conn.on("message", (data) => {
      this.handleMessage(msgpack.decode(data));
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
        const { reconnectTimeout, backoffIncrement, maxReconnectTimeout } =
          this.session;
        this.session.reconnectTimeout = Math.min(
          backoffIncrement + reconnectTimeout,
          maxReconnectTimeout
        );
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
    this.conn.send(msgpack.encode(subMsg));
  }

  subscribeAll() {
    const { trades, quotes, bars, dailyBars } = this.session.subscriptions;
    if (
      trades.length > 0 ||
      quotes.length > 0 ||
      bars.length > 0 ||
      dailyBars.length > 0
    ) {
      const msg = {
        action: "subscribe",
        trades,
        quotes,
        bars,
        dailyBars,
      };
      this.conn.send(msgpack.encode(msg));
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
    this.conn.send(msgpack.encode(unsubMsg));
  }

  updateSubscriptions(msg) {
    this.log(
      "info",
      `listening to streams:
        trades: ${msg.trades},
        quotes: ${msg.quotes},
        bars: ${msg.bars},
        dailyBars: ${msg.dailyBars},`
    );
    this.session.subscriptions = {
      trades: msg.trades,
      quotes: msg.quotes,
      bars: msg.bars,
      dailyBars: msg.dailyBars,
    };
  }

  onCryptoTrade(fn) {
    this.on(CRYPTO_EVENT.TRADES, (trade) => fn(trade));
  }

  onCryptoQuote(fn) {
    this.on(CRYPTO_EVENT.QUOTES, (quote) => fn(quote));
  }

  onCryptoBar(fn) {
    this.on(CRYPTO_EVENT.BARS, (bar) => fn(bar));
  }

  onCryptoDailyBar(fn) {
    this.on(CRYPTO_EVENT.DAILY_BARS, (dailyBar) => fn(dailyBar));
  }

  onError(fn) {
    this.on(CRYPTO_EVENT.CLIENT_ERROR, (err) => fn(err));
  }

  onStateChange(fn) {
    this.on(CRYPTO_EVENT.STATE_CHANGE, (newState) => fn(newState));
  }

  handleMessage(data) {
    const msgType = !!data?.length ? data[0].T : null;

    if (msgType == null) {
      this.emit(CONN_ERROR.UNEXPECTED_MESSAGE);
      return;
    }

    switch (msgType) {
      case "success":
        if (data[0].msg === "connected") {
          this.emit(STATE.CONNECTED);
          this.session.currentState = STATE.CONNECTED;
        } else if (data[0].msg === "authenticated") {
          this.session.authenticated = true;
          this.emit(STATE.AUTHENTICATED);
          this.session.currentState = STATE.AUTHENTICATED;
        }
        break;
      case "subscription":
        this.updateSubscriptions(data[0]);
        break;
      case "error":
        this.emit(CRYPTO_EVENT.CLIENT_ERROR, CONN_ERROR[data[0].code]);
        break;
      default:
        this.dataHandler(data);
    }
  }

  dataHandler(data) {
    data.forEach((element) => {
      if ("T" in element) {
        switch (element.T) {
          case "t":
            this.emit(CRYPTO_EVENT.TRADES, entityv2.AlpacaCryptoTrade(element));
            break;
          case "q":
            this.emit(CRYPTO_EVENT.QUOTES, entityv2.AlpacaCryptoQuote(element));
            break;
          case "b":
            this.emit(CRYPTO_EVENT.BARS, entityv2.AlpacaCryptoBar(element));
            break;
          case "d":
            this.emit(
              CRYPTO_EVENT.DAILY_BARS,
              entityv2.AlpacaCryptoBar(element)
            );
            break;
          default:
            this.emit(CRYPTO_EVENT.CLIENT_ERROR, CONN_ERROR.UNEXPECTED_MESSAGE);
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
    this.conn.send(msgpack.encode(authMsg));
    this.emit(STATE.AUTHENTICATING);
    this.session.currentState = STATE.AUTHENTICATING;
  }

  onDisconnect(fn) {
    this.on(STATE.DISCONNECTED, () => fn());
  }

  disconnect() {
    this.emit(STATE.DISCONNECTED);
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

  getUrl(baseUrl, exchanges) {
    let parameter;
    if (typeof exchanges === "string") {
      parameter = exchanges;
    } else if (Array.isArray(exchanges)) {
      parameter = exchanges.join(",");
    } else {
      throw new Error("exchanges should be a string or list of strings");
    }
    return (
      "wss" +
      baseUrl.substr(baseUrl.indexOf(":")) +
      "/v1beta1/crypto?exchanges=" +
      parameter
    );
  }
}

module.exports = {
  AlpacaCryptoClient,
};
