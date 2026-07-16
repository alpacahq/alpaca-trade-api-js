import AlpacaSdk from "@alpacahq/alpaca-trade-api";

const AlpacaCjs = require("@alpacahq/alpaca-trade-api");
const { default: LegacyAlpaca } = require("@alpacahq/alpaca-trade-api");
const { Alpaca: NamedAlpaca } = require("@alpacahq/alpaca-trade-api");

const primary = new AlpacaSdk({ keyId: "key", secretKey: "secret" });
const secondary = new AlpacaCjs({ keyId: "key", secretKey: "secret" });
const tertiary = new LegacyAlpaca({ keyId: "key", secretKey: "secret" });
const fourth = new NamedAlpaca({ keyId: "key", secretKey: "secret" });
const clientAlias = primary;
const unbound = new Alpaca({ keyId: "key", secretKey: "leave" });

primary.getAccount();
secondary.createOrder({ symbol: "AAPL", qty: 1, side: "buy", type: "market" });
tertiary.getClock();
fourth.getPositions();
clientAlias.getAccount();
unbound.getAccount();

function shadowConstructor(AlpacaSdk) {
    const fake = new AlpacaSdk({ keyId: "key", secretKey: "leave" });
    fake.getAccount();
}

function shadowConstructorClass() {
    class AlpacaSdk {}
    const classClient = new AlpacaSdk({ secretKey: "leave" });
    classClient.getAccount();
}

function shadowRequire(require) {
    const LocalAlpaca = require("@alpacahq/alpaca-trade-api");
    const requiredClient = new LocalAlpaca({ secretKey: "leave" });
    requiredClient.getAccount();
}

function shadowClient(primary) {
    primary.getAccount();
    const localUpdates = primary.trade_ws;
    localUpdates.onOrderUpdate(handleOrder);
}

function shadowAlias(clientAlias) {
    clientAlias.getClock();
}

function shadowLocals() {
    const primary = getClient();
    const clientAlias = primary;
    const updates = makeStream();
    primary.getAccount();
    clientAlias.getClock();
    updates.onOrderUpdate(handleOrder);
}

const stocks = primary.data_stream_v2;
const updates = clientAlias.trade_ws;
const existing = primary.marketData.stockStream();
const stocksAlias = stocks;
const updatesAlias = updates;

stocks.onStockTrade(handleTrade);
stocksAlias.onStockQuote(handleQuote);
existing.onStockBar(handleBar);
updates.onOrderUpdate(handleOrder);
updates.subscribe(["trade_updates"]);
updatesAlias.subscribe(["trade_updates"]);
updates.subscribe(["trade_updates", "account_updates"]);
updates.subscribe();
updates.subscribe(channels);
updates.subscribe(...subscriptionArgs);
updates.subscribe(["orders"]);
stocks.subscribe(["trade_updates"]);

function nestedOuterReferences() {
    primary.getAccount();
    const nestedUpdates = updates;
    nestedUpdates.onOrderUpdate(handleOrder);
    nestedUpdates.subscribe(["trade_updates"]);
}

function shadowStreams(updates, stocks) {
    updates.onOrderUpdate(handleOrder);
    updates.subscribe(["trade_updates"]);
    stocks.onStockTrade(handleTrade);
}

function migrateLoose(alpaca) {
    const looseStocks = alpaca.data_stream_v2;
    alpaca.onStockTrade(handleTrade);
    looseStocks.onStockTrade(handleTrade);
}

unrelated.onStockTrade(handleTrade);
unrelated.subscribe(["trade_updates"]);
makeStream().onStockTrade(handleTrade);
const ambiguous = makeStream();
ambiguous.onStockTrade(handleTrade);
ambiguous.subscribe(["trade_updates"]);
