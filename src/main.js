const Alpaca = require('../lib/alpaca-trade-api');
const SECRETS = require('../secrets.js');

const ENV = 'paper';

const alpaca = new Alpaca({
  keyId: SECRETS[ENV].keyId, // paper API KEY ID
  secretKey: SECRETS[ENV].secretKey,
  paper: true,
})

alpaca.getAccount().then((account) => {
  console.log('Current Account:', account)
})


alpaca.getOrders().then((orders) => {
  console.log('Current Orders:', orders)
})

