import {
  AlpacaCryptoBar,
  AlpacaCryptoQuote,
  AlpacaCryptoTrade,
  CryptoBar,
  CryptoQuote,
  CryptoTrade,
} from "./entityv2";
import {
  AlpacaWebsocket as Websocket,
  EVENT,
  ERROR,
  WebsocketOptions,
} from "./websocket";

interface CrypotoWebsocketOptions extends WebsocketOptions {
  exchanges?: string | Array<string>;
}

interface CryptoSubscription {
  trades: Array<string>;
  quotes: Array<string>;
  bars: Array<string>;
  dailyBars: Array<string>;
}

export class AlpacaCryptoClient extends Websocket {
  constructor(options: CrypotoWebsocketOptions) {
    let url: string =
      "wss" +
      options.url.substr(options.url.indexOf(":")) +
      "/v1beta1/crypto?exchanges=";
    url += Array.isArray(options.exchanges)
      ? options.exchanges.join(",")
      : options.exchanges;
    console.log("url " + url);
    options.url = url;
    options.subscriptions = {
      trades: [],
      quotes: [],
      bars: [],
      dailyBars: [],
    } as CryptoSubscription;
    super(options);
  }

  subscribeForTrades(trades: Array<string>) {
    this.session.subscriptions.trades.push(...trades);
    this.subscribe(trades, [], [], []);
  }

  subscribeForQuotes(quotes: Array<string>) {
    this.session.subscriptions.quotes.push(...quotes);
    this.subscribe([], quotes, [], []);
  }

  subscribeForBars(bars: Array<string>) {
    this.session.subscriptions.bars.push(...bars);
    this.subscribe([], [], bars, []);
  }

  subscribeForDailyBars(dailyBars: Array<string>) {
    this.session.subscriptions.dailyBars.push(...dailyBars);
    this.subscribe([], [], [], dailyBars);
  }

  subscribe(
    trades: Array<string>,
    quotes: Array<string>,
    bars: Array<string>,
    dailyBars: Array<string>
  ) {
    const subMsg = {
      action: "subscribe",
      trades: trades,
      quotes: quotes,
      bars: bars,
      dailyBars: dailyBars,
    };
    this.conn.send(this.msgpack.encode(subMsg));
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
      this.conn.send(this.msgpack.encode(msg));
    }
  }

  unsubscribeFromTrades(trades: Array<string>) {
    this.session.subscriptions.trades =
      this.session.subscriptions.trades.filter(
        (trade: string) => !trades.includes(trade)
      );
    this.unsubscribe(trades, [], [], []);
  }

  unsubscribeFromQuotes(quotes: Array<string>) {
    this.session.subscriptions.quotes =
      this.session.subscriptions.quotes.filter(
        (quote: string) => !quotes.includes(quote)
      );
    this.unsubscribe([], quotes, [], []);
  }

  unsubscribeFromBars(bars: Array<string>) {
    this.session.subscriptions.bars = this.session.subscriptions.bars.filter(
      (bar: string) => !bars.includes(bar)
    );
    this.unsubscribe([], [], bars, []);
  }

  unsubscriceFromDailyBars(dailyBars: Array<string>) {
    this.session.subscriptions.dailyBars =
      this.session.subscriptions.dailyBars.filter(
        (dailyBar: string) => !dailyBars.includes(dailyBar)
      );
    this.unsubscribe([], [], [], dailyBars);
  }

  unsubscribe(
    trades: Array<string>,
    quotes: Array<string>,
    bars: Array<string>,
    dailyBars: Array<string>
  ) {
    const unsubMsg = {
      action: "unsubscribe",
      trades: trades,
      quotes: quotes,
      bars: bars,
      dailyBars: dailyBars,
    };
    this.conn.send(this.msgpack.encode(unsubMsg));
  }

  updateSubscriptions(msg: any) {
    console.log("called");
    this.log(
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

  onCryptoTrade(fn: (trade: CryptoTrade) => void) {
    this.on(EVENT.TRADES, (trade: CryptoTrade) => fn(trade));
  }

  onCryptoQuote(fn: (quote: CryptoQuote) => void) {
    this.on(EVENT.QUOTES, (quote: CryptoQuote) => fn(quote));
  }

  onCryptoBar(fn: (bar: CryptoBar) => void) {
    this.on(EVENT.BARS, (bar: CryptoBar) => fn(bar));
  }

  onCryptoDailyBar(fn: (dailyBar: CryptoBar) => void) {
    this.on(EVENT.DAILY_BARS, (dailyBar: CryptoBar) => fn(dailyBar));
  }

  dataHandler(data: any) {
    data.forEach((element: any) => {
      if ("T" in element) {
        switch (element.T) {
          case "t":
            this.emit(EVENT.TRADES, AlpacaCryptoTrade(element));
            break;
          case "q":
            this.emit(EVENT.QUOTES, AlpacaCryptoQuote(element));
            break;
          case "b":
            this.emit(EVENT.BARS, AlpacaCryptoBar(element));
            break;
          case "d":
            this.emit(EVENT.DAILY_BARS, AlpacaCryptoBar(element));
            break;
          default:
            this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
        }
      }
    });
  }
}
