require('dotenv').config()

require('mocha');
require('chai').use(require('chai-as-promised'));

const mockAlpaca = require('./mock-alpaca')

before(mockAlpaca.start)
after(mockAlpaca.stop)
