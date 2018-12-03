'use strict'

require('dotenv').config()

require('mocha')
require('chai').use(require('chai-as-promised'))

const mockServer = require('./support/mock-server')

before(mockServer.start)
after(mockServer.stop)
