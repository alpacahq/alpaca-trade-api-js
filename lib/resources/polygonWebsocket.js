'use strict'
Object.defineProperty(exports, "__esModule", { value: true })
const WebSocket = require("ws")
const events = require("events")
const websockets = require('./websockets')

class PolygonWebsocket extends events.EventEmitter {
    constructor(apiKey, session) {
        super()

        this._apiKey = apiKey
        this.session = session
    }
    connect(initialChannels) {
        this.reconnectDisabled = false
        this.emit(websockets.STATE.CONNECTING)
        this.conn = new WebSocket('wss://alpaca.socket.polygon.io/stocks')
        this.conn.once("open", () => {
            this.authenticate()
        })
        this.conn.on("message", (data) => this.handleMessage(data))
        this.conn.once("error", err => {
            this.emit(websockets.ERROR.CONNECTION_REFUSED)
        })
        this.conn.once("close", () => {
            this.emit(websockets.STATE.DISCONNECTED)
            if (this.session.reconnect && !this.reconnectDisabled) {
                this.reconnect()
            }
        })
    }

    handleMessage(data) {
        // Heartbeat
        const bytes = new Uint8Array(data)
        if (bytes.length === 1 && bytes[0] === 1) {
            return
        }
        console.log(data)
        let messageArray = JSON.parse(data)
        messageArray.forEach(message => {
            switch (message.ev) {
                case "status":
                    switch (message.status) {
                        case "auth_success":
                            this.emit(websockets.STATE.CONNECTED)
                            break
                        case "auth_failed":
                            this.emit(websockets.ERROR.BAD_KEY_OR_SECRET)
                            this.close()
                            break
                    }
                    break
                case "Q":
                    this.emit(EVENT.STOCK_QUOTES, subject, data)
                    break
                case "T":
                    this.emit(EVENT.STOCK_TRADES, subject, data)
                    break
                case "A":
                    this.emit(EVENT.STOCK_AGG_SEC, subject, data)
                    break
                case "AM":
                    this.emit(EVENT.STOCK_AGG_MIN, subject, data)
                    break
                default:
                    this.emit(ERROR.PROTOBUF)
            }
        })
    }
    send(data) {
        this.conn.send(data)
    }
    authenticate() {
        this.emit(websockets.STATE.AUTHENTICATING)

        const authMsg = {
            action: 'auth',
            params: this._apiKey
        }
        this.send(JSON.stringify(authMsg))
    }
    subscribe(topics) {
        const subMsg = {
            action: 'subscribe',
            params: topics
        }
        this.send(JSON.stringify(subMsg))
    }
    unsubscribe(topics) {
        const subMsg = {
            action: 'unsubscribe',
            params: topics
        }
        this.send(JSON.stringify(subMsg))
    }
    close() {
        this.reconnectDisabled = true
        if (this.conn) {
            this.conn.close()
        }
    }
    reconnect() {
        setTimeout(() => {
            if (this.session.backoff) {
                this.session.reconnectTimeout += backoffIncrement
                if (this.session.reconnectTimeout > this.session.maxReconnectTimeout) {
                    this.session.reconnectTimeout = this.session.maxReconnectTimeout
                }
            }
            this.connect()
        }, this.session.reconnectTimeout * 1000)
        this.emit(STATE.WAITING_TO_RECONNECT, this.session.reconnectTimeout)
    }
}

exports.PolygonWebsocket = PolygonWebsocket
