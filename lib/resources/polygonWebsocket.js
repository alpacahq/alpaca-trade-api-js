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
        this.connectCalled = false
        this.channels = []
    }
    connect(initialChannels) {
        this.channels = initialChannels
        this.reconnectDisabled = false
        this.connectCalled = true
        this.emit(websockets.STATE.CONNECTING)
        this.conn = new WebSocket('wss://socket.polygon.io/stocks')
        const connectListener = () => { this.subscribe(initialChannels) }
        this.on(websockets.STATE.CONNECTED, connectListener)
        this.conn.once("open", () => {
            this.authenticate()
        })
        this.conn.on("message", (data) => this.handleMessage(data))
        this.conn.once("error", err => {
            this.emit(websockets.ERROR.CONNECTION_REFUSED)
        })
        this.conn.once("close", () => {
            this.removeListener(websockets.STATE.CONNECTED, connectListener)
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
        let messageArray = JSON.parse(data)
        messageArray.forEach(message => {
            let subject = message.ev
            switch (subject) {
                case "status":
                    switch (message.status) {
                        case "auth_success":
                            this.emit(websockets.STATE.CONNECTED)
                            this.authenticating = false
                            break
                        case "auth_failed":
                            this.emit(websockets.ERROR.BAD_KEY_OR_SECRET)
                            this.authenticating = false
                            this.close()
                            break
                    }
                    break
                case "Q":
                    this.emit(websockets.EVENT.STOCK_QUOTES, subject, data)
                    break
                case "T":
                    this.emit(websockets.EVENT.STOCK_TRADES, subject, data)
                    break
                case "A":
                    this.emit(websockets.EVENT.STOCK_AGG_SEC, subject, data)
                    break
                case "AM":
                    this.emit(websockets.EVENT.STOCK_AGG_MIN, subject, data)
                    break
                default:
                    this.emit(websockets.ERROR.PROTOBUF)
            }
        })
    }
    send(data) {
        this.conn.send(data)
    }
    authenticate() {
        this.authenticating = true
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
            params: topics.join(',')
        }
        this.send(JSON.stringify(subMsg))
        this.channels = this.channels.concat(topics)
    }
    unsubscribe(topics) {
        const subMsg = {
            action: 'unsubscribe',
            params: topics.join(',')
        }
        console.log(JSON.stringify(subMsg))
        this.send(JSON.stringify(subMsg))
        this.channels = this.channels.filter(e => topics.indexOf(e) == -1)
    }
    close() {
        this.connectCalled = false
        this.reconnectDisabled = true
        if (this.conn) {
            this.conn.close()
        }
    }
    reconnect() {
        console.log('Attempting Polygon websocket reconnection...')
        setTimeout(() => {
            if (this.session.backoff) {
                this.session.reconnectTimeout += this.session.backoffIncrement
                if (this.session.reconnectTimeout > this.session.maxReconnectTimeout) {
                    this.session.reconnectTimeout = this.session.maxReconnectTimeout
                }
            }
            this.connect(this.channels)
        }, this.session.reconnectTimeout * 1000)
        this.emit(websockets.STATE.WAITING_TO_RECONNECT, this.session.reconnectTimeout)
    }
}

exports.PolygonWebsocket = PolygonWebsocket
