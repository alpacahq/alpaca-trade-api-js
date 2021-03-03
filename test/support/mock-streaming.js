"use strict";

const WebSocket = require("ws");
const https = require("https");
const Fs = require("fs");

const client = {
  key: "key1",
  secret: "secret1",
};

const trade_apple = {
  T: "t",
  i: 1532,
  S: "AAPL",
  x: "Q",
  p: 144.6,
  s: 25,
  t: "2021-01-27T10:35:34.82840127Z",
  c: ["@", "F", "T", "I"],
  z: "C",
};

const quote_apple = {
  T: "q",
  S: "AAPL",
  bx: "Z",
  bp: 139.74,
  bs: 3,
  ax: "Q",
  ap: 139.77,
  as: 1,
  t: "2021-01-28T15:20:41.384564Z",
  c: "R",
  z: "C",
};

class StreamingWsMock {
  constructor(port) {
    this.httpsServer = https.createServer({
      key: Fs.readFileSync("test/support/key.pem"),
      cert: Fs.readFileSync("test/support//cert.pem"),
    });
    this.conn = new WebSocket.Server({
      server: this.httpsServer,
      path: "/v2/sip",
      perMessageDeflate: {
        serverNoContextTakeover: false,
        clientNoContextTakeover: false,
      },
    });
    this.conn.on("connection", (socket) => {
      socket.send(JSON.stringify([{ T: "success", msg: "connected" }]));
      this.conn.emit("open");
      socket.on("message", (msg) => {
        this.messageHandler(msg, socket);
      });
      socket.on("error", (err) => console.log(err));
    });

    this.httpsServer.listen(port);

    this.subscriptions = {
      trades: [],
      quotes: [],
      bars: [],
    };
  }

  messageHandler(msg, socket) {
    const message = JSON.parse(msg);
    const action = message.action ?? null;

    if (!action) {
      socket.send(
        JSON.stringify([
          {
            T: "error",
            code: 400,
            msg: "invalid syntax",
          },
        ])
      );
    }

    switch (action) {
      case "auth":
        this.authenticate(message, socket);
        break;
      case "subscribe":
        this.handleSubscription(message, socket);
        break;
      case "unsubscribe":
        this.handleUnsubscription(message, socket);
    }
  }

  handleSubscription(msg, socket) {
    if (!this.checkSubMsgSyntax(msg)) {
      return;
    }
    this.subscriptions.trades = [...this.subscriptions.trades, ...msg.trades];
    this.subscriptions.quotes = [...this.subscriptions.quotes, ...msg.quotes];
    this.subscriptions.bars = [...this.subscriptions.bars, ...msg.bars];
    socket.send(JSON.stringify(this.createSubMsg()));
    this.streamData(socket);
  }

  handleUnsubscription(msg, socket) {
    if (!this.checkSubMsgSyntax(msg)) {
      return;
    }
    this.subscriptions.trades = this.subscriptions.trades.filter(
      (val) => msg.trades.indexOf(val) === -1
    );
    this.subscriptions.quotes = this.subscriptions.quotes.filter(
      (val) => msg.quotes.indexOf(val) === -1
    );
    this.subscriptions.bars = this.subscriptions.bars.filter(
      (val) => msg.bars.indexOf(val) === -1
    );
    socket.send(JSON.stringify(this.createSubMsg()));
  }

  checkSubMsgSyntax(msg) {
    if (!msg.trades || !msg.quotes || !msg.bars) {
      socket.send(
        JSON.stringify([
          {
            T: "error",
            code: 400,
            msg: "invalid syntax",
          },
        ])
      );
      return false;
    }
    return true;
  }

  createSubMsg() {
    return [
      {
        T: "subscription",
        trades: this.subscriptions.trades,
        quotes: this.subscriptions.quotes,
        bars: this.subscriptions.bars,
      },
    ];
  }

  streamData(socket) {
    if (this.subscriptions.trades.length > 0) {
      socket.send(JSON.stringify([trade_apple]));
    }
    if (this.subscriptions.quotes.length > 0) {
      socket.send(JSON.stringify([quote_apple]));
    }
  }

  authenticate(message, socket) {
    if (message.key === client.key && message.secret === client.secret) {
      socket.send(
        JSON.stringify([
          {
            T: "success",
            msg: "authenticated",
          },
        ])
      );
    } else {
      socket.send(
        JSON.stringify([
          {
            T: "error",
            code: 402,
            msg: "auth failed",
          },
        ])
      );
    }
  }

  close() {
    this.httpsServer.close(() => {
      this.conn.close();
    });
  }
}

module.exports = {
  StreamingWsMock: StreamingWsMock,
};
