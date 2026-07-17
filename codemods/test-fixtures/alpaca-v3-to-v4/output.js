import { Alpaca as AlpacaSdk } from "@alpacahq/alpaca-trade-api";

const {
    Alpaca: AlpacaCjs
} = require("@alpacahq/alpaca-trade-api");
const { Alpaca: LegacyAlpaca } = require("@alpacahq/alpaca-trade-api");
const { Alpaca: NamedAlpaca } = require("@alpacahq/alpaca-trade-api");

const primary = new AlpacaSdk({ keyId: "key", secret: "secret" });
const secondary = new AlpacaCjs({ keyId: "key", secret: "secret" });
const tertiary = new LegacyAlpaca({ keyId: "key", secret: "secret" });
const fourth = new NamedAlpaca({ keyId: "key", secret: "secret" });
const clientAlias = primary;
const unbound = new Alpaca({ keyId: "key", secretKey: "leave" });

primary.trading.account.getAccount();
secondary.trading.orders.market({
    symbol: "AAPL",
    qty: 1,
    side: "buy"
});
tertiary.trading.clock.legacyClock();
fourth.trading.positions.getAllOpenPositions();
clientAlias.trading.account.getAccount();
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

// TODO(alpaca-codemod): pass a feed, e.g. stockStream({ feed: 'iex' })
const stocks = primary.marketData.stockStream();
const updates = clientAlias.trading.stream();
const existing = primary.marketData.stockStream();
const stocksAlias = stocks;
const updatesAlias = updates;

stocks.onTrade(handleTrade);
stocksAlias.onQuote(handleQuote);
existing.onBar(handleBar);
updates.onTradeUpdate(handleOrder);
updates.subscribeTradeUpdates();
updatesAlias.subscribeTradeUpdates();
updates.subscribe(["trade_updates", "account_updates"]);
updates.subscribe();
updates.subscribe(channels);
updates.subscribe(...subscriptionArgs);
updates.subscribe(["orders"]);
stocks.subscribe(["trade_updates"]);

function nestedOuterReferences() {
    primary.trading.account.getAccount();
    const nestedUpdates = updates;
    nestedUpdates.onTradeUpdate(handleOrder);
    nestedUpdates.subscribeTradeUpdates();
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
