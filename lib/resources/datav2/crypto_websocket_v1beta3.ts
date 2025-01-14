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

interface CryptoSubscription {
  trades: Array<string>;
  quotes: Array<string>;
  bars: Array<string>;
  updatedBars: Array<string>;
  dailyBars: Array<string>;
  orderbooks: Array<string>;
}

type RawCryptoData = RawCryptoTrade | RawCryptoQuote | RawCryptoBar | RawCryptoOrderbook;

type EventTypeMapValue = {
  event: string;
  parse: (data: RawCryptoData) => any;
};

const eventTypeMap = new Map<string, EventTypeMapValue>([
  ["t", { event: EVENT.TRADES, parse: AlpacaCryptoTrade } as EventTypeMapValue],
  ["q", { event: EVENT.QUOTES, parse: AlpacaCryptoQuote } as EventTypeMapValue],
  ["b", { event: EVENT.BARS, parse: AlpacaCryptoBar } as EventTypeMapValue],
  ["u", { event: EVENT.UPDATED_BARS, parse: AlpacaCryptoBar } as EventTypeMapValue],
  ["d", { event: EVENT.DAILY_BARS, parse: AlpacaCryptoBar } as EventTypeMapValue],
  ["o", { event: EVENT.ORDERBOOKS, parse: AlpacaCryptoOrderbook } as EventTypeMapValue],
]);

export class AlpacaCryptoClient extends Websocket {
  constructor(options: WebsocketOptions) {
    options.url = options.url.replace("https", "wss") + "/v1beta3/crypto/us";
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
    this.subscribe(this.session.subscriptions);
  }

  unsubscribeFromTrades(trades: Array<string>): void {
    this.session.subscriptions.trades = this.session.subscriptions.trades.filter(
      (trade: string) => !trades.includes(trade)
    );
    this.unsubscribe({ trades });
  }

  unsubscribeFromQuotes(quotes: Array<string>): void {
    this.session.subscriptions.quotes = this.session.subscriptions.quotes.filter(
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
    this.session.subscriptions.dailyBars = this.session.subscriptions.dailyBars.filter(
      (dailyBar: string) => !dailyBars.includes(dailyBar)
    );
    this.unsubscribe({ dailyBars });
  }

  unsubscribeFromOrderbooks(orderbooks: Array<string>): void {
    this.session.subscriptions.orderbooks = this.session.subscriptions.orderbooks.filter(
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

  dataHandler(data: Array<RawCryptoData>): void {
    data.forEach((element: RawCryptoData) => {
      if ("T" in element) {
        const eventType = eventTypeMap.get(element.T);
        if (eventType) {
          this.emit(eventType.event, eventType.parse(element));
        } else {
          this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
        }
      }
    });
  }
}
