const API_KEY = 'YOUR_API_KEY_HERE';
const API_SECRET = 'YOUR_API_SECRET_HERE';
const PAPER = true;

class MeanReversion {
  constructor(API_KEY, API_SECRET, PAPER){
    this.Alpaca = require('@alpacahq/alpaca-trade-api');
    this.alpaca = new this.Alpaca({
      keyId: API_KEY, 
      secretKey: API_SECRET, 
      paper: PAPER
    });
    this.runningAverage = 0;
    this.lastOrder = null;
    this.timeToClose = null;
    // Stock that the algo will trade.
    this.stock = "AAPL";
  }

  async run(){
    // First, cancel any existing orders so they don't impact our buying power.
    var orders;
    await this.alpaca.getOrders({
      status:'all', 
      direction:'asc'
    }).then((resp) => {
      orders = resp;
    }).catch((err) => {console.log(err.error);});
    orders.forEach(async (order) => {
      this.alpaca.cancelOrder(order.id).catch((err) => {console.log(err.error);});
    });

    // Wait for market to open.
    console.log("Waiting for market to open...");
    var promMarket = this.awaitMarketOpen();
    await promMarket;
    console.log("Market opened.");


    // Get the running average of prices of the last 20 minutes, waiting until we have 20 bars from market open.
    var promBars = new Promise((resolve, reject) => {
      var barChecker = setInterval(async () => {
        await this.alpaca.getCalendar(Date.now()).then(async (resp) => {
          var marketOpen = resp[0].open;
          await this.alpaca.getBars('minute', this.stock, {start: marketOpen}).then((resp) => {
            var bars = resp[this.stock];
            if(bars.length >= 20) {
              clearInterval(barChecker);
              resolve();
            }
          }).catch((err) => {console.log(err.error);});
        });
      }, 60000);
    });
    console.log("Waiting for 20 bars...");
    await promBars;
    console.log("We have 20 bars.");
    // Rebalance our portfolio every minute based off running average data.
    var spin = setInterval(async () => {

      // Clear the last order so that we only have 1 hanging order.
      if(this.lastOrder != null) await this.alpaca.cancelOrder(this.lastOrder.id).catch((err) => {console.log(err.error);});

      // Figure out when the market will close so we can prepare to sell beforehand.
      var closingTime;
      var currTime;
      await this.alpaca.getClock().then((resp) =>{
        closingTime = new Date(resp.next_close.substring(0, resp.next_close.length - 6));
        currTime = new Date(resp.timestamp.substring(0, resp.timestamp.length - 6));
      }).catch((err) => {console.log(err.error);});
      this.timeToClose = closingTime - currTime;

      if(this.timeToClose < (60000 * 15)) {
        // Close all positions when 15 minutes til market close.
        console.log("Market closing soon.  Closing positions.");
        try{
          await this.alpaca.getPosition(this.stock).then(async (resp) => {
            var positionQuantity = resp.qty;
            var promOrder = this.submitMarketOrder(positionQuantity, this.stock, "sell");
            await promOrder;
          }).catch((err) => {console.log(err.error);});
        } catch(err){/*console.log(err.error);*/}
        clearInterval(spin);
        console.log("Sleeping until market close (15 minutes).");
        setTimeout(() => {
          // Run script again after market close for next trading day.
          this.run();
        }, 60000*15);
      }
      else {
        // Rebalance the portfolio.
        await this.rebalance();
      }
    }, 60000);
  }

  // Spin until the market is open
  awaitMarketOpen(){
    var prom = new Promise((resolve, reject) => {
      var isOpen = false;
      var marketChecker = setInterval(async ()=>{
        await this.alpaca.getClock().then(async (resp) => {
          isOpen = resp.is_open;
          if(isOpen) {
            clearInterval(marketChecker);
            resolve();
          } else {
            var openTime, currTime;
            await this.alpaca.getClock().then((resp) =>{
              openTime = new Date(resp.next_open.substring(0, resp.next_close.length - 6));
              currTime = new Date(resp.timestamp.substring(0, resp.timestamp.length - 6));
            }).then(() => {
              this.timeToClose = Math.floor((openTime - currTime) / 1000 / 60);
            }).catch((err) => {console.log(err.error);});
            console.log(this.timeToClose + " minutes til next market open.")
          }
        }).catch((err) => {console.log(err.error);});
      }, 60000);
    });
    return prom;
  }

  // Rebalance our position after an update.
  async rebalance(){
    var positionQuantity = 0;
    var positionValue = 0;

    // Get our position, if any.
    try{
      await this.alpaca.getPosition(this.stock).then((resp) => {
        positionQuantity = resp.qty;
        positionValue = resp.market_value;
      });
    } catch (err){/*console.log(err.error);*/}

    // Get the new updated price and running average.
    var bars;
    await this.alpaca.getBars('minute', this.stock,{limit: 20}).then((resp) => {
      bars = resp[this.stock];
    }).catch((err) => {console.log(err.error);});
    var currPrice = bars[bars.length - 1].closePrice;
    this.runningAverage = 0;
    bars.forEach((bar) => {
      this.runningAverage += bar.closePrice;
    })
    this.runningAverage /= 20;
  
    if(currPrice > this.runningAverage){
      // Sell our position if the price is above the running average, if any.
      if(positionQuantity > 0){
        console.log("Setting position to zero.");
        await this.submitLimitOrder(positionQuantity, this.stock, currPrice, 'sell');
      }
      else console.log("No position in the stock.  No action required.");
    }
    else if(currPrice < this.runningAverage){
      // Determine optimal amount of shares based on portfolio and market data.
      var portfolioValue;
      var buyingPower;
      await this.alpaca.getAccount().then((resp) => {
        portfolioValue = resp.portfolio_value;
        buyingPower = resp.buying_power;
      }).catch((err) => {console.log(err.error);});
      var portfolioShare = (this.runningAverage - currPrice) / currPrice * 200;
      var targetPositionValue = portfolioValue * portfolioShare;
      var amountToAdd = targetPositionValue - positionValue;

      // Add to our position, constrained by our buying power; or, sell down to optimal amount of shares.
      if(amountToAdd > 0){
        if(amountToAdd > buyingPower) amountToAdd = buyingPower; 
        var qtyToBuy = Math.floor(amountToAdd / currPrice);
        await this.submitLimitOrder(qtyToBuy, this.stock, currPrice, 'buy');
      }
      else{
        amountToAdd *= -1;
        var qtyToSell = Math.floor(amountToAdd / currPrice);
        if(qtyToSell > positionQuantity) qtyToSell = positionQuantity;
        await this.submitLimitOrder(qtyToSell, this.stock, currPrice, 'sell');
      }
    }
  }

  // Submit a limit order if quantity is above 0.
  async submitLimitOrder(quantity, stock, price, side){
    if(quantity > 0){
      await this.alpaca.createOrder({
        symbol: stock, 
        qty: quantity, 
        side: side, 
        type: 'limit', 
        time_in_force: 'day', 
        limit_price: price
      }).then((resp) => {
        this.lastOrder = resp;
        console.log("Limit order of |" + quantity + " " + stock + " " + side + "| sent.");
      }).catch((err) => {
        console.log("Order of |" + quantity + " " + stock + " " + side + "| did not go through.");
      });
    }
    else {
      console.log("Quantity is <=0, order of |" + quantity + " " + stock + " " + side + "| not sent.");
    }
  }

  // Submit a market order if quantity is above 0.
  async submitMarketOrder(quantity, stock, side){
    if(quantity > 0){
      await this.alpaca.createOrder({
        symbol: stock, 
        qty: quantity, 
        side: side, 
        type: 'market', 
        time_in_force: 'day'
      }).then((resp) => {
        this.lastOrder = resp;
        console.log("Market order of |" + quantity + " " + stock + " " + side + "| completed.");
      }).catch((err) => {
        console.log("Order of |" + quantity + " " + stock + " " + side + "| did not go through.");
      });
    }
    else {
      console.log("Quantity is <=0, order of |" + quantity + " " + stock + " " + side + "| not sent.");
    }
  }
}

// Run the mean reversion class.
var MR = new MeanReversion(API_KEY, API_SECRET, PAPER);
MR.run();
