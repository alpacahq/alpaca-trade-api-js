import { ERROR, EVENT } from "./websocket";
import { AlpacaNews, RawAlpacaNews } from "./entityv2";
import { AlpacaWebsocket as Websocket, WebsocketOptions } from "./websocket";

interface NewsWebsocketSession {
  news: Array<string>;
}

export class AlpacaNewsCLient extends Websocket {
  constructor(options: WebsocketOptions) {
    const url =
      "wss" + options.url.substr(options.url.indexOf(":")) + "/v1beta1/news";
    options.url = url;
    options.subscriptions = {
      news: [],
    } as NewsWebsocketSession;
    super(options);
  }

  subscribeForNews(news: Array<string>): void {
    this.session.subscriptions.news.push(...news);
    this.subscribe(news);
  }

  subscribe(news: Array<string>): void {
    const subMsg = {
      action: "subscribe",
      news,
    };
    console.log("subscribing", subMsg);
    this.conn.send(this.msgpack.encode(subMsg).toString("base64"));
  }

  subscribeAll(): void {
    if (this.session.subscriptions.news.length > 0) {
      this.subscribe(this.session.subscriptions.news);
    }
  }

  unsubscribeFromNews(news: Array<string>): void {
    this.session.subscriptions.news = this.session.subscriptions.news.filter(
      (n: string) => !news.includes(n)
    );
    this.unsubscribe(news);
  }

  unsubscribe(news: Array<string>): void {
    const unsubMsg = {
      action: "unsubscribe",
      news,
    };
    this.conn.send(this.msgpack.encode(unsubMsg).toString("base64"));
  }

  updateSubscriptions(msg: { news: Array<string> }): void {
    this.log(
      `listening to streams:
        news: ${msg.news}`
    );
    this.session.subscriptions = {
      news: msg.news,
    };
  }

  onNews(fn: (n: AlpacaNews) => void): void {
    this.on(EVENT.NEWS, (n: AlpacaNews) => fn(n));
  }

  dataHandler(data: Array<RawAlpacaNews>): void {
    data.forEach((element: RawAlpacaNews) => {
      if ("T" in element) {
        switch (element.T) {
          case "n":
            this.emit(EVENT.NEWS, AlpacaNews(element));
            break;
          default:
            this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
        }
      } else {
        this.emit(EVENT.CLIENT_ERROR, ERROR.UNEXPECTED_MESSAGE);
      }
    });
  }
}
