const API_KEY = 'API_KEY';
const API_SECRET = 'API_SECRET';
const PAPER = true;

class MeanReversion {
  constructor(API_KEY,API_SECRET,PAPER){
    this.Alpaca = require('@alpacahq/alpaca-trade-api');
    this.alpaca = new this.Alpaca({
      keyId: API_KEY,
      secretKey: API_SECRET,
      paper: PAPER,
    });
    this.closingPrices = [];
    this.runningAverage = 0;
    this.lastOrder = null;
    this.timeToClose = null;
    this.stock = "AAPL";
  }

  async run(){
    // First, cancel any existing orders so they don't impact our buying power.
    var orders;
    await this.alpaca.getOrders({
      status:'all',
      direction:'asc',
    }).then((resp) => {
      orders = resp;
    }).catch((err) => {console.log(err);});
    orders.forEach(async (order) => {
      this.alpaca.cancelOrder(order.id).catch((err) => {console.log(err);});
    });

    // Wait for market to open
    console.log("Waiting for market to open...");
    var promMarket = this.awaitMarketOpen();
    await promMarket;
    console.log("Market opened.");


    // Get the running average of prices of the last 20 minutes, waiting until we have 20 bars from market open
    var promBars = new Promise((resolve,reject) => {
      var barChecker = setInterval(async () => {
        await this.alpaca.getCalendar(Date.now()).then(async (resp) => {
          var marketOpen = resp[0].open;
          await this.alpaca.getBars('minute',this.stock,{start: marketOpen,}).then((resp) => {
            var bars = resp[this.stock];
            if(bars.length >= 20) {
              clearInterval(barChecker);
              resolve();
            }
          }).catch((err) => {console.log(err);});
        });
      },60000);
    });
    console.log("Waiting for 20 bars...");
    await promBars;
    console.log("We have 20 bars.");
    var bars;
    await this.alpaca.getBars('minute',this.stock,{limit: 20,}).then((resp) => {
      bars = resp.AAPL;
    }).catch((err) => {console.log(err);});
    
    for(var i = 0; i < bars.length; i++){
      this.closingPrices.push(bars[i].c);
      if(this.closingPrices.length > 20) this.closingPrices.splice(0,1);
      this.runningAverage = ((this.runningAverage * (this.closingPrices.length - 1)) + bars[i].c) / this.closingPrices.length;
    }

    // Rebalance our portfolio every minute based off running average data
    var spin = setInterval(async () => {

      // Clear the last order so that we only have 1 hanging order
      if(this.lastOrder != null) await this.alpaca.cancelOrder(this.lastOrder.id).catch((err) => {console.log(err);});

      // Rebalance the portfolio
      await this.rebalance();

      // Figure out when the market will close so we can prepare to sell beforehand.
      var closingTime;
      var currTime;
      await this.alpaca.getClock().then((resp) =>{
        closingTime = new Date(resp.next_close.substring(0,resp.next_close.length-6));
        currTime = new Date(resp.timestamp.substring(0,resp.timestamp.length-6));
      }).catch((err) => {console.log(err);});
      this.timeToClose = closingTime - currTime;

      if(this.timeToClose < (60000 * 15)) {
        // Close all positions when 15 minutes til market close
        console.log("Market closing soon.  Closing positions.");
        try{
          await this.alpaca.getPosition(this.stock).then(async (resp) => {
            var positionQuantity = resp.qty;
            var promOrder = this.submitMarketOrder(positionQuantity,this.stock,"sell");
            await promOrder;
          }).catch((err) => {console.log(err);});
        } catch(err){/*console.log(err);*/}
        clearInterval(spin);
        console.log("Sleeping until market close (15 minutes).");
        setTimeout(() => {
          // Run script again after market close for next trading day
          this.run();
        },60000*15);
      }
    },60000);
  }

  // Spin until the market is open
  awaitMarketOpen(){
    var prom = new Promise((resolve,reject) => {
      var isOpen = false;
      var marketChecker = setInterval(async ()=>{
        //console.log('spinning');
        await this.alpaca.getClock().then((resp) => {
          isOpen = resp.is_open;
          isOpen = true;
          if(isOpen) {
            clearInterval(marketChecker);
            resolve();
          }
        }).catch((err) => {console.log(err);});
      },60000);
    });
    return prom;
  }

  // Rebalance our position after an update
  async rebalance(){
    var positionQuantity = 0;
    var positionValue = 0;

    // Get our position, if any
    try{
      await this.alpaca.getPosition(this.stock).then((resp) => {
        positionQuantity = resp.qty;
        positionValue = resp.market_value;
      });
    } catch (err){/*console.log(err);*/}

    // Get the new updated price and running average
    var bars;
    await this.alpaca.getBars('minute',this.stock).then((resp) => {
      bars = resp[this.stock];
    }).catch((err) => {console.log(err);});
    var currPrice = bars[bars.length-1].c;
    this.closingPrices.push(currPrice);
    if(this.closingPrices.length > 20) this.closingPrices.splice(0,1);
    this.runningAverage = ((this.runningAverage * (this.closingPrices.length - 1)) + currPrice) / this.closingPrices.length;
  
    if(currPrice > this.runningAverage){
      // Sell our position if the price is above the running average, if any
      if(positionQuantity > 0){
        console.log("Setting position to zero.");
        await this.submitLimitOrder(positionQuantity,this.stock,currPrice,'sell');
      }
      else console.log("No position in the stock.  No action required.");
    }
    else if(currPrice < this.runningAverage){
      // Determine optimal amount of shares based on portfolio and market data
      var portfolioValue;
      var buyingPower;
      await this.alpaca.getAccount().then((resp) => {
        portfolioValue = resp.portfolio_value;
        buyingPower = resp.buying_power;
      }).catch((err) => {console.log(err);});
      var portfolioShare = (this.runningAverage - currPrice) / currPrice * 200;
      var targetPositionValue = portfolioValue * portfolioShare;
      var amountToAdd = targetPositionValue - positionValue;

      // Add to our position, constrained by our buying power; or, sell down to optimal amount of shares
      if(amountToAdd > 0){
        if(amountToAdd > buyingPower) amountToAdd = buyingPower; 
        var qtyToBuy = Math.floor(amountToAdd / currPrice);
        await this.submitLimitOrder(qtyToBuy,this.stock,currPrice,'buy');
      }
      else{
        amountToAdd *= -1;
        var qtyToSell = Math.floor(amountToAdd / currPrice);
        if(qtyToSell > positionQuantity) qtyToSell = positionQuantity;
        await this.submitLimitOrder(qtyToSell,this.stock,currPrice,'sell');
      }
    }
  }

  // Submit a limit order if quantity is above 0
  async submitLimitOrder(quantity,stock,price,side){
    if(quantity > 0){
      await this.alpaca.createOrder({
        symbol: stock,
        qty: quantity,
        side: side,
        type: 'limit',
        time_in_force: 'day',
        limit_price: price,
      }).then((resp) => {
        this.lastOrder = resp;
        console.log("Limit order of " + '|' + quantity + " " + stock + " " + side + '|' + " completed.");
      }).catch((err) => {console.log("Order of " + '|' + quantity + " " + stock + " " + side + '|' + " did not go through.");});
    }
    else {
      console.log("Quantity is <=0, order of " + '|' + quantity + " " + stock + " " + side + '|' + " not completed.");
    }
  }

  // Submit a market order if quantity is above 0
  async submitMarketOrder(quantity,stock,side){
    if(quantity > 0){
      await this.alpaca.createOrder({
        symbol: stock,
        qty: quantity,
        side: side,
        type: 'market',
        time_in_force: 'day',
      }).then((resp) => {
        this.lastOrder = resp;
        console.log("Market order of " + '|' + quantity + " " + stock + " " + side + '|' + " completed.");
      }).catch((err) => {console.log("Order of " + '|' + quantity + " " + stock + " " + side + '|' + " did not go through.");});
    }
    else {
      console.log("Quantity is <=0, order of " + '|' + quantity + " " + stock + " " + side + '|' + " not completed.");
    }
  }
}

// Run the mean reversion class
var MR = new MeanReversion(API_KEY,API_SECRET,PAPER);
MR.run();