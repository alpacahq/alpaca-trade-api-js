import {
  RawOptionTrade,
  RawOptionQuote,
  AlpacaOptionTradeV1Beta1,
  AlpacaOptionQuoteV1Beta1,
  AlpacaOptionTrade,
  AlpacaOptionQuote,
} from "./entityv2";
import {
  AlpacaWebsocket as Websocket,
  EVENT,
  ERROR,
  WebsocketOptions,
} from "./websocket";

interface OptionWebsocketOptions extends WebsocketOptions {
  feed?: string;
}
interface OptionWebSocketSession {
  trades: Array<string>;
  quotes: Array<string>;
}
export class AlpacaOptionClient extends Websocket {
  constructor(options: OptionWebsocketOptions) {
    const url: string =
      "wss" + options.url.substr(options.url.indexOf(":")) + "/v1beta1/" + options.feed;
    options.url = url;
    options.subscriptions = {
      trades: [],
      quotes: [],
    } as OptionWebSocketSession;
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

  subscribe(symbols: { trades?: Array<string>; quotes?: Array<string> }): void {
    const subMsg = {
      action: "subscribe",
      trades: symbols.trades ?? [],
      quotes: symbols.quotes ?? [],
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

  unsubscribe(symbols: { trades?: Array<string>; quotes?: Array<string> }): void {
    const unsubMsg = {
      action: "unsubscribe",
      trades: symbols.trades ?? [],
      quotes: symbols.quotes ?? [],
    };
    this.conn.send(this.msgpack.encode(unsubMsg));
  }

  updateSubscriptions(msg: { trades: Array<string>; quotes: Array<string> }): void {
    this.log(
      `listening to streams:
          trades: ${msg.trades},
          quotes: ${msg.quotes}`
    );
    this.session.subscriptions = {
      trades: msg.trades,
      quotes: msg.quotes,
    };
  }

  onOptionTrade(fn: (tarde: AlpacaOptionTrade) => void): void {
    this.on(EVENT.TRADES, (trade: AlpacaOptionTrade) => fn(trade));
  }

  onOptionQuote(fn: (quote: AlpacaOptionQuote) => void): void {
    this.on(EVENT.QUOTES, (quote: AlpacaOptionQuote) => fn(quote));
  }

  dataHandler(data: Array<RawOptionTrade | RawOptionQuote>): void {
    data.forEach((element: RawOptionTrade | RawOptionQuote) => {
      if ("T" in element) {
        switch (element.T) {
          case "t":
            this.emit(EVENT.TRADES, AlpacaOptionTradeV1Beta1(element as RawOptionTrade));
            break;
          case "q":
            this.emit(EVENT.QUOTES, AlpacaOptionQuoteV1Beta1(element as RawOptionQuote));
            break;
          default:
            this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
        }
      }
    });
  }
}
