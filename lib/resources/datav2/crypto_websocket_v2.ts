import {
  AlpacaCryptoBar,
  AlpacaCryptoQuote,
  AlpacaCryptoTrade,
  AlpacaCryptoOrderbook,
  CryptoBar,
  CryptoQuote,
  CryptoTrade,
  CryptoOrderbook,
  RawCryptoTrade,
  RawCryptoQuote,
  RawCryptoBar,
  RawCryptoOrderbook,
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
  updatedBars: Array<string>;
  dailyBars: Array<string>;
  orderbooks: Array<string>;
}

export class AlpacaCryptoClient extends Websocket {
  constructor(options: CrypotoWebsocketOptions) {
    const url = options.url.replace("https", "wss") + "/v1beta1/crypto";
    const exchanges = Array.isArray(options.exchanges)
      ? options.exchanges.join(",")
      : options.exchanges;
    options.url = `${url}?exchanges=${exchanges}`;
    options.subscriptions = {
      trades: [],
      quotes: [],
      bars: [],
      updatedBars: [],
      dailyBars: [],
      orderbooks: [],
    } as CryptoSubscription;
    super(options);
  }

  subscribeForTrades(trades: Array<string>): void {
    this.session.subscriptions.trades.push(...trades);
    this.subscribe({ trades });
  }

  subscribeForQuotes(quotes: Array<string>): void {
    this.session.subscriptions.quotes.push(...quotes);
    this.subscribe({ quotes });
  }

  subscribeForBars(bars: Array<string>): void {
    this.session.subscriptions.bars.push(...bars);
    this.subscribe({ bars });
  }

  subscribeForUpdatedBars(updatedBars: Array<string>): void {
    this.session.subscriptions.updatedBars.push(...updatedBars);
    this.subscribe({ updatedBars });
  }

  subscribeForDailyBars(dailyBars: Array<string>): void {
    this.session.subscriptions.dailyBars.push(...dailyBars);
    this.subscribe({ dailyBars });
  }

  subscribeForOrderbooks(orderbooks: Array<string>): void {
    this.session.subscriptions.orderbooks.push(...orderbooks);
    this.subscribe({ orderbooks });
  }

  subscribe(symbols: {
    trades?: Array<string>;
    quotes?: Array<string>;
    bars?: Array<string>;
    updatedBars?: Array<string>;
    dailyBars?: Array<string>;
    orderbooks?: Array<string>;
  }): void {
    const subMsg = {
      action: "subscribe",
      trades: symbols.trades ?? [],
      quotes: symbols.quotes ?? [],
      bars: symbols.bars ?? [],
      updatedBars: symbols.updatedBars ?? [],
      dailyBars: symbols.dailyBars ?? [],
      orderbooks: symbols.orderbooks ?? [],
    };
    this.conn.send(this.msgpack.encode(subMsg));
  }

  subscribeAll(): void {
    const { trades, quotes, bars, updatedBars, dailyBars, orderbooks } =
      this.session.subscriptions;
    if (
      trades.length > 0 ||
      quotes.length > 0 ||
      bars.length > 0 ||
      updatedBars.length > 0 ||
      dailyBars.length > 0 ||
      orderbooks.length > 0
    ) {
      const msg = {
        action: "subscribe",
        trades,
        quotes,
        bars,
        updatedBars,
        dailyBars,
        orderbooks,
      };
      this.conn.send(this.msgpack.encode(msg));
    }
  }

  unsubscribeFromTrades(trades: Array<string>): void {
    this.session.subscriptions.trades =
      this.session.subscriptions.trades.filter(
        (trade: string) => !trades.includes(trade)
      );
    this.unsubscribe({ trades });
  }

  unsubscribeFromQuotes(quotes: Array<string>): void {
    this.session.subscriptions.quotes =
      this.session.subscriptions.quotes.filter(
        (quote: string) => !quotes.includes(quote)
      );
    this.unsubscribe({ quotes });
  }

  unsubscribeFromBars(bars: Array<string>): void {
    this.session.subscriptions.bars = this.session.subscriptions.bars.filter(
      (bar: string) => !bars.includes(bar)
    );
    this.unsubscribe({ bars });
  }

  unsubscribeFromUpdatedBars(updatedBars: Array<string>): void {
    this.session.subscriptions.updatedBars =
      this.session.subscriptions.updatedBars.filter(
        (updatedBar: string) => !updatedBars.includes(updatedBar)
      );
    this.unsubscribe({ updatedBars });
  }

  unsubscriceFromDailyBars(dailyBars: Array<string>): void {
    this.session.subscriptions.dailyBars =
      this.session.subscriptions.dailyBars.filter(
        (dailyBar: string) => !dailyBars.includes(dailyBar)
      );
    this.unsubscribe({ dailyBars });
  }

  unsubscribeFromOrderbooks(orderbooks: Array<string>): void {
    this.session.subscriptions.orderbooks =
      this.session.subscriptions.orderbooks.filter(
        (orderbook: string) => !orderbooks.includes(orderbook)
      );
    this.unsubscribe({ orderbooks });
  }

  unsubscribe(symbols: {
    trades?: Array<string>;
    quotes?: Array<string>;
    bars?: Array<string>;
    updatedBars?: Array<string>;
    dailyBars?: Array<string>;
    orderbooks?: Array<string>;
  }): void {
    const unsubMsg = {
      action: "unsubscribe",
      trades: symbols.trades ?? [],
      quotes: symbols.quotes ?? [],
      bars: symbols.bars ?? [],
      updatedBars: symbols.updatedBars ?? [],
      dailyBars: symbols.dailyBars ?? [],
      orderbooks: symbols.orderbooks ?? [],
    };
    this.conn.send(this.msgpack.encode(unsubMsg));
  }

  updateSubscriptions(msg: {
    trades: Array<string>;
    quotes: Array<string>;
    bars: Array<string>;
    updatedBars: Array<string>;
    dailyBars: Array<string>;
    orderbooks: Array<string>;
  }): void {
    this.session.subscriptions = {
      trades: msg.trades,
      quotes: msg.quotes,
      bars: msg.bars,
      updatedBars: msg.updatedBars,
      dailyBars: msg.dailyBars,
      orderbooks: msg.orderbooks,
    };
    this.log(
      `listening to streams:
        ${JSON.stringify(this.session.subscriptions)}`
    );
  }

  onCryptoTrade(fn: (trade: CryptoTrade) => void): void {
    this.on(EVENT.TRADES, (trade: CryptoTrade) => fn(trade));
  }

  onCryptoQuote(fn: (quote: CryptoQuote) => void): void {
    this.on(EVENT.QUOTES, (quote: CryptoQuote) => fn(quote));
  }

  onCryptoBar(fn: (bar: CryptoBar) => void): void {
    this.on(EVENT.BARS, (bar: CryptoBar) => fn(bar));
  }

  onCryptoUpdatedBar(fn: (updatedBar: CryptoBar) => void): void {
    this.on(EVENT.UPDATED_BARS, (updatedBar: CryptoBar) => fn(updatedBar));
  }

  onCryptoDailyBar(fn: (dailyBar: CryptoBar) => void): void {
    this.on(EVENT.DAILY_BARS, (dailyBar: CryptoBar) => fn(dailyBar));
  }

  onCryptoOrderbook(fn: (orderbook: CryptoOrderbook) => void): void {
    this.on(EVENT.ORDERBOOKS, (orderbook: CryptoOrderbook) => fn(orderbook));
  }

  dataHandler(
    data: Array<RawCryptoTrade | RawCryptoQuote | RawCryptoBar | RawCryptoOrderbook>
  ): void {
    data.forEach((element: RawCryptoTrade | RawCryptoQuote | RawCryptoBar | RawCryptoOrderbook) => {
      if ("T" in element) {
        switch (element.T) {
          case "t":
            this.emit(
              EVENT.TRADES,
              AlpacaCryptoTrade(element as RawCryptoTrade)
            );
            break;
          case "q":
            this.emit(
              EVENT.QUOTES,
              AlpacaCryptoQuote(element as RawCryptoQuote)
            );
            break;
          case "b":
            this.emit(EVENT.BARS, AlpacaCryptoBar(element as RawCryptoBar));
            break;
          case "u":
            this.emit(
              EVENT.UPDATED_BARS,
              AlpacaCryptoBar(element as RawCryptoBar)
            );
            break;
          case "d":
            this.emit(
              EVENT.DAILY_BARS,
              AlpacaCryptoBar(element as RawCryptoBar)
            );
            break;
          case "o":
            this.emit(
              EVENT.ORDERBOOKS,
              AlpacaCryptoOrderbook(element as RawCryptoOrderbook)
            );
            break;
          default:
            this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
        }
      }
    });
  }
}
