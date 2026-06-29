class LongShort {
  constructor(API_KEY,API_SECRET){
    this.alpaca = new AlpacaCORS({
      keyId: API_KEY,
      secretKey: API_SECRET,
      baseUrl: 'https://paper-api.alpaca.markets'
    });

    this.allStocks = ['DOMO', 'TLRY', 'SQ', 'MRO', 'AAPL', 'GM', 'SNAP', 'SHOP', 'SPLK', 'BA', 'AMZN', 'SUI', 'SUN', 'TSLA', 'CGC', 'SPWR', 'NIO', 'CAT', 'MSFT', 'PANW', 'OKTA', 'TWTR', 'TM', 'RTN', 'ATVI', 'GS', 'BAC', 'MS', 'TWLO', 'QCOM'];
    // Format the allStocks variable for use in the class.
    var temp = [];
    this.allStocks.forEach((stockName) => {
      temp.push({name: stockName, pc: 0});
    });
    this.allStocks = temp.slice();

    this.long = [];
    this.short = [];
    this.qShort = null;
    this.qLong = null;
    this.adjustedQLong = null;
    this.adjustedQShort = null;
    this.blacklist = new Set();
    this.longAmount = 0;
    this.shortAmount = 0;
    this.timeToClose = null;
    this.marketChecker = null;
    this.spin = null;
    this.chart = null;
    this.chart_data = [];
    this.positions = [];
  }
  
  async run(){
    // First, cancel any existing orders so they don't impact our buying power.
    var orders;
    await this.alpaca.getOrders({
      status: "open",
      direction: "desc"
    }).then((resp) => {
      orders = resp;
    }).catch((err) => {writeToEventLog(err);});
    var promOrders = [];
    orders.forEach((order) => {
      promOrders.push(new Promise(async (resolve,reject) => {
        this.alpaca.cancelOrder(order.id).catch((err) => {writeToEventLog(err);});
        resolve();
      }));
    });
    await Promise.all(promOrders);

    // Wait for market to open.
    writeToEventLog("Waiting for market to open...");
    var promMarket = this.awaitMarketOpen();
    await promMarket;
    writeToEventLog("Market opened.");

    // Rebalance the portfolio every minute, making necessary trades.
    this.spin = setInterval(async () => {

      // Figure out when the market will close so we can prepare to sell beforehand.
      await this.alpaca.getClock().then((resp) =>{
        var closingTime = new Date(resp.next_close.substring(0,resp.next_close.length - 6));
        var currTime = new Date(resp.timestamp.substring(0,resp.timestamp.length - 6));
        this.timeToClose = Math.abs(closingTime - currTime);
      }).catch((err) => {writeToEventLog(err);});

      if(this.timeToClose < (60000 * 15)) {
        // Close all positions when 15 minutes til market close.
        writeToEventLog("Market closing soon.  Closing positions.");
        
        await this.alpaca.getPositions().then(async (resp) => {
          var promClose = [];
          resp.forEach((position) => {
            promClose.push(new Promise(async (resolve,reject) => {
              var orderSide;
              if(position.side == 'long') orderSide = 'sell';
              else orderSide = 'buy';
              var quantity = Math.abs(position.qty);
              await this.submitOrder(quantity,position.symbol,orderSide);
              resolve();
            }));
          });
          
          await Promise.all(promClose);
        }).catch((err) => {writeToEventLog(err);});
        clearInterval(this.spin);
        writeToEventLog("Sleeping until market close (15 minutes).");
        setTimeout(() => {
          // Run script again after market close for next trading day.
          this.run();
        }, 60000*15);
      }
      else {
        // Rebalance the portfolio.
        await this.rebalance();
        this.updateChart();
      }
    }, 60000);
  }
  // Spin until the market is open.
  awaitMarketOpen(){
    var prom = new Promise(async (resolve, reject) => {
      var isOpen = false;
      await this.alpaca.getClock().then(async (resp) => {
        if(resp.is_open) {
          resolve();
        }
        else {
          this.marketChecker = setInterval(async () => {
            this.updateChart();
            await this.alpaca.getClock().then((resp) => {
              isOpen = resp.is_open;
              if(isOpen) {
                clearInterval(this.marketChecker);
                resolve();
              } 
              else {
                var openTime = new Date(resp.next_open.substring(0, resp.next_close.length - 6));
                var currTime = new Date(resp.timestamp.substring(0, resp.timestamp.length - 6));
                this.timeToClose = Math.floor((openTime - currTime) / 1000 / 60);
                writeToEventLog(this.timeToClose + " minutes til next market open.");
              }
            }).catch((err) => {writeToEventLog(err);});
          }, 60000);
        }
      });
    });
    return prom;
  }

  // Rebalance our position after an update.
  async rebalance(){
    await this.rerank();

    // Clear existing orders again.
    var orders;
    await this.alpaca.getOrders({
      status: 'open', 
      direction: 'desc'
    }).then((resp) => {
      orders = resp;
    }).catch((err) => {writeToEventLog(err);});
    var promOrders = [];
    orders.forEach((order) => {
      promOrders.push(new Promise(async (resolve, reject) => {
        await this.alpaca.cancelOrder(order.id).catch((err) => {writeToEventLog(err);});
        resolve();
      }));
    });
    await Promise.all(promOrders);

    writeToEventLog("We are taking a long position in: " + this.long.toString());
    writeToEventLog("We are taking a short position in: " + this.short.toString());
    // Remove positions that are no longer in the short or long list, and make a list of positions that do not need to change.  Adjust position quantities if needed.
    var positions;
    await this.alpaca.getPositions().then((resp) => {
      positions = resp;
    }).catch((err) => {writeToEventLog(err);});
    var promPositions = [];
    var executed = {long:[], short:[]};
    var side;
    this.blacklist.clear();
    positions.forEach((position) => {
      promPositions.push(new Promise(async (resolve, reject) => {
        if(this.long.indexOf(position.symbol) < 0){
          // Position is not in long list.
          if(this.short.indexOf(position.symbol) < 0){
            // Position not in short list either.  Clear position.
            if(position.side == "long") side = "sell";
            else side = "buy";
            var promCO = this.submitOrder(Math.abs(position.qty), position.symbol, side);
            await promCO.then(() => {resolve();});
          }
          else{
            // Position in short list.
            if(position.side == "long") {
              // Position changed from long to short.  Clear long position and short instead
              var promCS = this.submitOrder(position.qty, position.symbol, "sell");
              await promCS.then(() => {resolve();});
            }
            else {
              if(Math.abs(position.qty) == this.qShort){
                // Position is where we want it.  Pass for now.
              }
              else{
                // Need to adjust position amount
                var diff = Number(Math.abs(position.qty)) - Number(this.qShort);
                if(diff > 0){
                  // Too many short positions.  Buy some back to rebalance.
                  side = "buy"
                }
                else{
                  // Too little short positions.  Sell some more.
                  side = "sell"
                }
                var promRebalance = this.submitOrder(Math.abs(diff), position.symbol, side);
                await promRebalance;
              }
              executed.short.push(position.symbol);
              this.blacklist.add(position.symbol);
              resolve();
            }
          }
        }
        else{
          // Position in long list.
          if(position.side == "short"){
            // Position changed from short to long.  Clear short position and long instead.
            var promCS = this.submitOrder(Math.abs(position.qty), position.symbol, "buy");
            await promCS.then(() => {resolve();});
          }
          else{
            if(position.qty == this.qLong){
              // Position is where we want it.  Pass for now.
            }
            else{
              // Need to adjust position amount.
              var diff = Number(position.qty) - Number(this.qLong);
              if(diff > 0){
                // Too many long positions.  Sell some to rebalance.
                side = "sell";
              }
              else{
                // Too little long positions.  Buy some more.
                side = "buy";
              }
              var promRebalance = this.submitOrder(Math.abs(diff), position.symbol, side);
              await promRebalance;
            }
            executed.long.push(position.symbol);
            this.blacklist.add(position.symbol);
            resolve();
          }
        }
      }));
    });
    await Promise.all(promPositions);

    // Send orders to all remaining stocks in the long and short list.
    var promLong = this.sendBatchOrder(this.qLong, this.long, 'buy');
    var promShort = this.sendBatchOrder(this.qShort, this.short, 'sell');

    var promBatches = [];
    this.adjustedQLong = -1;
    this.adjustedQShort = -1;
    
    await Promise.all([promLong, promShort]).then(async (resp) => {
      // Handle rejected/incomplete orders.
      resp.forEach(async (arrays, i) => {
        promBatches.push(new Promise(async (resolve, reject) => {
          if(i == 0) {
            arrays[1] = arrays[1].concat(executed.long);
            executed.long = arrays[1].slice();
          }
          else {
            arrays[1] = arrays[1].concat(executed.short);
            executed.short = arrays[1].slice();
          }
          // Return orders that didn't complete, and determine new quantities to purchase.
          if(arrays[0].length > 0 && arrays[1].length > 0){
            var promPrices = this.getTotalPrice(arrays[1]);
            
            await Promise.all(promPrices).then((resp) => {
              var completeTotal = resp.reduce((a, b) => a + b, 0);
              if(completeTotal != 0){
                if(i == 0){
                  this.adjustedQLong = Math.floor(this.longAmount / completeTotal);
                }
                else{
                  this.adjustedQShort = Math.floor(this.shortAmount / completeTotal);
                }
              }
            });
          }
          resolve();
        }));
      });
      await Promise.all(promBatches);
    }).then(async () => {
      // Reorder stocks that didn't throw an error so that the equity quota is reached.
      var promReorder = new Promise(async (resolve, reject) => {
        var promLong = [];
        if(this.adjustedQLong >= 0){
          this.qLong = this.adjustedQLong - this.qLong;
          executed.long.forEach(async (stock) => {
            promLong.push(new Promise(async (resolve, reject) => {
              var promLong = this.submitOrder(this.qLong, stock, 'buy');
              await promLong;
              resolve();
            })); 
          });
        }
        
        var promShort = [];
        if(this.adjustedQShort >= 0){
          this.qShort = this.adjustedQShort - this.qShort;
          executed.short.forEach(async(stock) => {
            promShort.push(new Promise(async (resolve, reject) => {
              var promShort = this.submitOrder(this.qShort, stock, 'sell');
              await promShort;
              resolve();
            }));
          });
        }
        var allProms = promLong.concat(promShort);
        if(allProms.length > 0){
          await Promise.all(allProms);
        }
        resolve();
      });
      await promReorder;
    });
  }

  // Re-rank all stocks to adjust longs and shorts.
  async rerank(){
    await this.rank();

    // Grabs the top and bottom quarter of the sorted stock list to get the long and short lists.
    var longShortAmount = Math.floor(this.allStocks.length / 4);
    this.long = [];
    this.short = [];
    for(var i = 0; i < this.allStocks.length; i++){
      if(i < longShortAmount) this.short.push(this.allStocks[i].name);
      else if(i > (this.allStocks.length - 1 - longShortAmount)) this.long.push(this.allStocks[i].name);
      else continue;
    }

    // Determine amount to long/short based on total stock price of each bucket.
    var equity;
    await this.alpaca.getAccount().then((resp) => {
      equity = resp.equity;
    }).catch((err) => {writeToEventLog(err);});
    this.shortAmount = 0.30 * equity;
    this.longAmount = Number(this.shortAmount) + Number(equity);

    var promLong = await this.getTotalPrice(this.long);
    var promShort = await this.getTotalPrice(this.short);
    var longTotal;
    var shortTotal;
    await Promise.all(promLong).then((resp) => {
      longTotal = resp.reduce((a, b) => a + b, 0);
    });
    await Promise.all(promShort).then((resp) => {
      shortTotal = resp.reduce((a, b) => a + b, 0);
    });
    
    this.qLong = Math.floor(this.longAmount / longTotal);
    this.qShort = Math.floor(this.shortAmount / shortTotal);
  }

  // Get the total price of the array of input stocks.
  getTotalPrice(stocks){
    var proms = [];
    stocks.forEach(async (stock) => {
      proms.push(new Promise(async (resolve, reject) => {
        await this.alpaca.getBars('minute', stock, {limit: 1}).then((resp) => {
          resolve(resp[stock][0].c);
        }).catch((err) => {writeToEventLog(err);});
      }));
    });
    return proms;
  }

  // Submit an order if quantity is above 0.
  async submitOrder(quantity, stock, side){
    var prom = new Promise(async (resolve, reject) => {
      if(quantity > 0){
        await this.alpaca.createOrder({
          symbol: stock,
          qty: quantity,
          side: side,
          type: 'market',
          time_in_force: 'day',
        }).then(() => {
          writeToEventLog("Market order of |" + quantity + " " + stock + " " + side + "| completed.");
          resolve(true);
        }).catch((err) => {
          writeToEventLog("Order of |" + quantity + " " + stock + " " + side + "| did not go through.");
          resolve(false);
        });
      }
      else {
        writeToEventLog("Quantity is <= 0, order of |" + quantity + " " + stock + " " + side + "| not sent.");
        resolve(true);
      }
    });
    return prom;
  }

  // Submit a batch order that returns completed and uncompleted orders.
  async sendBatchOrder(quantity, stocks, side){
    var prom = new Promise(async (resolve, reject) => {
      var incomplete = [];
      var executed = [];
      var promOrders = [];
      stocks.forEach(async (stock) => {
        promOrders.push(new Promise(async (resolve, reject) => {
          if(!this.blacklist.has(stock)){
            var promSO = this.submitOrder(quantity, stock, side);
            await promSO.then((resp) => {
              if(resp) executed.push(stock);
              else incomplete.push(stock);
              resolve();
            });
          }
          else resolve();
        }));
      });
      await Promise.all(promOrders).then(() => {
        resolve([incomplete, executed]);
      });
    });
    return prom;
  }

  // Get percent changes of the stock prices over the past 10 minutes.
  getPercentChanges(allStocks){
    var length = 10;
    var promStocks = [];
    allStocks.forEach((stock) => {
      promStocks.push(new Promise(async (resolve, reject) => {
        await this.alpaca.getBars('minute', stock.name, {limit: length}).then((resp) => {
          stock.pc  = (resp[stock.name][length - 1].c - resp[stock.name][0].o) / resp[stock.name][0].o;
        }).catch((err) => {writeToEventLog(err);});
        resolve();
      }));
    });
    return promStocks;
  }

  // Mechanism used to rank the stocks, the basis of the Long-Short Equity Strategy.
  async rank(){
    // Ranks all stocks by percent change over the past 10 minutes (higher is better).
    var promStocks = this.getPercentChanges(this.allStocks);
    await Promise.all(promStocks);

    // Sort the stocks in place by the percent change field (marked by pc).
    this.allStocks.sort((a, b) => {return a.pc - b.pc;});
  }
  
  kill() {
    clearInterval(this.marketChecker);
    clearInterval(this.spin);
    throw new error("Killed script");
  }
  
  
  async init() {
    var prom = this.getTodayOpenClose();
    await prom.then((resp) => {
      this.chart = new Chart(document.getElementById("main_chart"), {
        type: 'line',
        data: {
          datasets: [{
            label: "equity",
            data: []
          }]
        },
        options: {
          scales: {
            xAxes: [{
              type: 'time',
              time: {
                unit: 'hour',
                min: resp[0],
                max: resp[1]
              },
            }],
            yAxes: [{
              
            }],
          },
          title: {
            display: true,
            text: "Equity"
          },
        }
      });
      this.updateChart();
    });
  }

  updateChart() {
    this.alpaca.getAccount().then((resp) => {
      this.chart.data.datasets[0].data.push({
        t: new Date(),
        y: resp.equity
      });
      this.chart.update();
    });
    this.updateOrders();
    this.updatePositions();
  }

  getTodayOpenClose() {
    return new Promise(async (resolve,reject) => {
      await this.alpaca.getClock().then(async (resp) => {
        await this.alpaca.getCalendar({
          start: resp.timestamp,
          end: resp.timestamp
        }).then((resp) => {
          var openTime = resp[0].open;
          var closeTime = resp[0].close;
          var calDate = resp[0].date;
  
          openTime = openTime.split(":");
          closeTime = closeTime.split(":");
          calDate = calDate.split("-");
  
          var offset = new Date(new Date().toLocaleString('en-US',{timeZone: 'America/New_York'})).getHours() - new Date().getHours();
  
          openTime = new Date(calDate[0],calDate[1]-1,calDate[2],openTime[0]-offset,openTime[1]);
          closeTime = new Date(calDate[0],calDate[1]-1,calDate[2],closeTime[0]-offset,closeTime[1]);
          resolve([openTime,closeTime]);
        });
      });
    });
  }

  updatePositions() {
    $("#positions-log").empty();
    this.alpaca.getPositions().then((resp) => {
      resp.forEach((position) => {
        $("#positions-log").prepend(
          `<div class="position-inst">
            <p class="position-fragment">${position.symbol}</p>
            <p class="position-fragment">${position.qty}</p>
            <p class="position-fragment">${position.side}</p>
            <p class="position-fragment">${position.unrealized_pl}</p>
          </div>`
        );
      })
    })
  }

  updateOrders() {
    $("#orders-log").empty();
    this.alpaca.getOrders({
      status: "open"
    }).then((resp) => {
      resp.forEach((order) => {
        $("#orders-log").prepend(
          `<div class="order-inst">
            <p class="order-fragment">${order.symbol}</p>
            <p class="order-fragment">${order.qty}</p>
            <p class="order-fragment">${order.side}</p>
            <p class="order-fragment">${order.type}</p>
          </div>`
        );
      })
    })
  }
}

function runScript(){
  var API_KEY = $("#api-key").val();
  var API_SECRET = $("#api-secret").val();
  var ls = new LongShort(API_KEY,API_SECRET);
  ls.init();
  ls.run();
}
function killScript(){
  $("#event-log").html("Killing script.");
  ls.kill();
}
function writeToEventLog(text) {
  $("#event-log").prepend(`<p class="event-fragment">${text}</p>`)
}