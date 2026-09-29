const { Alpaca, streaming, trading } = require("@alpacahq/alpaca-trade-api");
const rest = require("@alpacahq/alpaca-trade-api/rest");
const packageMetadata = require("@alpacahq/alpaca-trade-api/package.json");
const { verifySseRuntime } = require("../sse-runtime.cjs");

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

const sseWatchdog = setTimeout(() => {
    console.error("CJS SSE package smoke did not settle");
    process.exitCode = 1;
}, 5_000);

void Promise.all([
    verifySseRuntime(
        require("@alpacahq/alpaca-trade-api"),
        "Node CJS",
    ),
    verifySseRuntime(rest, "REST CJS"),
]).then(
    () => clearTimeout(sseWatchdog),
    (error) => {
        clearTimeout(sseWatchdog);
        console.error(error);
        process.exitCode = 1;
    },
);
