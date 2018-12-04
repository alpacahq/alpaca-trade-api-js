'use strict'
Object.defineProperty(exports, "__esModule", { value: true })
var NATS = require('nats')
const events = require("events")

class PolygonNats extends events.EventEmitter {
  constructor (apiKey) {
    super()

    this._apiKey = apiKey
    this._ssids = []
  }
  connect() {
    const servers = [
      `nats://${this._apiKey}@nats1.polygon.io:31101`,
      `nats://${this._apiKey}@nats2.polygon.io:31102`,
      `nats://${this._apiKey}@nats3.polygon.io:31103`,
    ]
    try {
      this._nc = NATS.connect({'servers': servers})
      this._nc.on('error', function(err) {
        console.log(err)
      })
    } catch (error) {
      console.log(`Connect: ${error}`)
    }
  }
  subscribe(topics) {
    if (this._nc === undefined) {
      return
    }
    this._ssids.forEach(ssid => {
      this._nc.unsubscribe(ssid)
    })
    this._ssids = topics.map(topic => {
      return this._nc.subscribe(topic, (msg) => {
        const data = JSON.parse(msg)
        this.emit('*', topic, data)
      })
    })
  }
  close() {
    if (this._nc) {
      this._nc.close()
    }
  }
}

exports.PolygonNats = PolygonNats
