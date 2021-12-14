import events from "events";
import WebSocket from "ws";
import { MessagePack } from "msgpack5";
import msgpack5 from "msgpack5";

// Connection states. Each of these will also emit EVENT.STATE_CHANGE
export enum STATE {
  AUTHENTICATING = "authenticating",
  AUTHENTICATED = "authenticated",
  CONNECTED = "connected",
  CONNECTING = "connecting",
  DISCONNECTED = "disconnected",
  WAITING_TO_CONNECT = "waiting to connect",
  WAITING_TO_RECONNECT = "waiting to reconnect",
}

// Stock client events
export enum EVENT {
  CLIENT_ERROR = "client_error",
  STATE_CHANGE = "state_change",
  AUTHORIZED = "authorized",
  UNAUTHORIZED = "unauthorized",
  TRADES = "stock_trades",
  QUOTES = "stock_quotes",
  BARS = "stock_bars",
  DAILY_BARS = "stock_daily_bars",
  TRADING_STATUSES = "trading_statuses",
  LULDS = "lulds",
  CANCEL_ERRORS = "cancel_errors",
  CORRECTIONS = "corrections",
}

// Connection errors by code
export const CONN_ERROR = new Map([
  [400, "invalid syntax"],
  [401, "not authenticated"],
  [402, "auth failed"],
  [403, "already authenticated"],
  [404, "auth timeout"],
  [405, "symbol limit exceeded"],
  [406, "connection limit exceeded"],
  [407, "slow client"],
  [408, "v2 not enabled"],
  [409, "insufficient subscription"],
  [500, "internal error"],
]);

// Connection errors without code
export enum ERROR {
  MISSING_SECERT_KEY = "missing secret key",
  MISSING_API_KEY = "missing api key",
  UNEXPECTED_MESSAGE = "unexpected message",
}

interface WebsocketSession {
  apiKey: string;
  secretKey: string;
  subscriptions: any;
  reconnect: boolean;

  // If true, client outputs detailed log messages
  verbose: boolean;

  // Reconnection backoff: if true, then the reconnection time will be initially
  // reconnectTimeout, then will double with each unsuccessful connection attempt.
  // It will not exceed maxReconnectTimeout
  backoff: boolean;

  // Initial reconnect timeout (seconds) a minimum of 1 will be used if backoff=false
  reconnectTimeout: number;

  // The maximum amount of time between reconnect tries (applies to backoff)
  maxReconnectTimeout: number;

  // The amount of time to increment the delay between each reconnect attempt
  backoffIncrement: number;
  url: string;
  currentState: STATE;
  pingTimeout?: NodeJS.Timeout;
  pingTimeoutThreshold: number;
  isReconnected: boolean;
}

interface AlpacaBaseWebsocket {
  session: WebsocketSession;
  connect: () => void;
  onConnect: (fn: () => void) => void;
  reconnect: () => void;
  onError: (fn: (err: Error) => void) => void;
  onStateChange: (fn: () => void) => void;
  authenticate: () => void;
  handleMessage(data: any): void;
  disconnect: () => void;
  onDisconnect: (fn: () => void) => void;
  getSubscriptions: () => void;
  log: (msg: Array<any>) => void;
}

export interface WebsocketOptions {
  apiKey: string;
  secretKey: string;
  url: string;
  verbose: boolean;
  subscriptions?: any;
}

export abstract class AlpacaWebsocket
  extends events.EventEmitter
  implements AlpacaBaseWebsocket
{
  session: WebsocketSession;
  msgpack: MessagePack;
  conn!: any;

  constructor(options: WebsocketOptions) {
    super();
    this.msgpack = msgpack5();
    this.session = {
      apiKey: options.apiKey,
      secretKey: options.secretKey,
      subscriptions: options.subscriptions,
      reconnect: true,
      verbose: options.verbose,
      backoff: true,
      reconnectTimeout: 0,
      maxReconnectTimeout: 30,
      backoffIncrement: 0.5,
      url: options.url,
      currentState: STATE.WAITING_TO_CONNECT,
      pingTimeoutThreshold: 1000,
      isReconnected: false,
    };

    if (this.session.apiKey.length === 0) {
      throw new Error(ERROR.MISSING_API_KEY);
    }
    if (this.session.secretKey.length === 0) {
      throw new Error(ERROR.MISSING_SECERT_KEY);
    }

    // Register internal event handlers
    // Log and emit every state change
    Object.values(STATE).forEach((s) => {
      this.on(s, () => {
        this.emit(EVENT.STATE_CHANGE, s);
      });
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
    this.conn.on("message", (data: any) => {
      this.handleMessage(this.msgpack.decode(data));
    });
    this.conn.on("error", (err: Error) => {
      this.emit(EVENT.CLIENT_ERROR, err.message);
      this.disconnect();
    });
    this.conn.on("close", (code: any, msg: any) => {
      this.log(`connection closed with code: ${code} and message: ${msg}`);
      if (this.session.reconnect) {
        this.reconnect();
      }
    });
    this.conn.on("ping", () => {
      if (this.session.pingTimeout) {
        clearTimeout(this.session.pingTimeout);
      }
      this.session.pingTimeout = setTimeout(() => {
        this.log("connection may closed, terminating...");
        this.conn.terminate();
      }, 9000 + this.session.pingTimeoutThreshold); // Server pings in every 9 sec
    });
  }

  onConnect(fn: () => void): void {
    this.on(STATE.AUTHENTICATED, () => {
      if (this.session.isReconnected) {
        //if reconnected the user should subscribe to its symbols again
        this.subscribeAll();
      } else {
        fn();
      }
    });
  }

  reconnect(): void {
    this.log("Reconnecting...");
    this.session.isReconnected = true;
    const { backoff, backoffIncrement, maxReconnectTimeout } = this.session;
    let reconnectTimeout = this.session.reconnectTimeout;
    if (backoff) {
      setTimeout(() => {
        reconnectTimeout += backoffIncrement;
        if (reconnectTimeout > maxReconnectTimeout) {
          reconnectTimeout = maxReconnectTimeout;
        }
        this.connect();
      }, reconnectTimeout * 1000);
      this.emit(STATE.WAITING_TO_RECONNECT, reconnectTimeout);
    }
  }

  authenticate(): void {
    const authMsg = {
      action: "auth",
      key: this.session.apiKey,
      secret: this.session.secretKey,
    };
    this.conn.send(this.msgpack.encode(authMsg));
    this.emit(STATE.AUTHENTICATING);
    this.session.currentState = STATE.AUTHENTICATING;
  }

  disconnect(): void {
    this.emit(STATE.DISCONNECTED);
    this.session.currentState = STATE.DISCONNECTED;
    this.conn.close();
    this.session.reconnect = false;
  }

  onDisconnect(fn: () => void): void {
    this.on(STATE.DISCONNECTED, () => fn());
  }

  onError(fn: (err: Error) => void): void {
    this.on(EVENT.CLIENT_ERROR, (err: any) => fn(err));
  }

  onStateChange(fn: (newState: STATE) => void): void {
    this.on(EVENT.STATE_CHANGE, (newState: any) => fn(newState));
  }

  handleMessage(data: any): void {
    const msgType = data?.length ? data[0].T : "";

    switch (msgType) {
      case "success":
        if (data[0].msg === "connected") {
          this.emit(STATE.CONNECTED);
          this.session.currentState = STATE.CONNECTED;
        } else if (data[0].msg === "authenticated") {
          this.emit(STATE.AUTHENTICATED);
          this.session.currentState = STATE.AUTHENTICATED;
        }
        break;
      case "subscription":
        this.updateSubscriptions(data[0]);
        break;
      case "error":
        this.emit(EVENT.CLIENT_ERROR, CONN_ERROR.get(data[0].code));
        break;
      default:
        this.dataHandler(data);
    }
  }

  log(msg: unknown): void {
    if (this.session.verbose) {
      // eslint-disable-next-line no-console
      console.log(msg);
    }
  }

  getSubscriptions(): void {
    return this.session.subscriptions;
  }

  abstract dataHandler(data: unknown): void;
  abstract updateSubscriptions(data: unknown): void;
  abstract subscribeAll(): void;
}
