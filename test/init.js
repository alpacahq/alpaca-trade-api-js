require('dotenv').config()

require('mocha')
require('chai').use(require('chai-as-promised'))

const mockAlpaca = require('./mock-alpaca')
const mockPolygon = require('./mock-polygon')

before(() => {
  return Promise.all([
    mockAlpaca.start(),
    mockPolygon.start(),
  ])
})

after(() => {
  return Promise.all([
    mockAlpaca.stop(),
    mockPolygon.stop(),
  ])
})
