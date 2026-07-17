const { Alpaca, streaming, trading } = require("@alpacahq/alpaca-trade-api");
const rest = require("@alpacahq/alpaca-trade-api/rest");
const packageMetadata = require("@alpacahq/alpaca-trade-api/package.json");

if (typeof Alpaca !== "function" || typeof streaming.StockDataStream !== "function") {
    throw new Error("Node CJS did not resolve the full root bundle");
}

const expectedUserAgent = `APCA-NODE/${packageMetadata.version} Node/${process.versions.node}`;
if (trading.USER_AGENT !== expectedUserAgent) {
    throw new Error(
        `Node CJS USER_AGENT mismatch: expected ${expectedUserAgent}, received ${trading.USER_AGENT}`,
    );
}
if (rest.trading.USER_AGENT !== expectedUserAgent) {
    throw new Error(
        `REST CJS USER_AGENT mismatch: expected ${expectedUserAgent}, received ${rest.trading.USER_AGENT}`,
    );
}
