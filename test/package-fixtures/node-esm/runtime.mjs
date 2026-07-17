import { Alpaca, streaming, trading } from "@alpacahq/alpaca-trade-api";
import packageMetadata from "@alpacahq/alpaca-trade-api/package.json" with { type: "json" };

if (typeof Alpaca !== "function" || typeof streaming.StockDataStream !== "function") {
    throw new Error("Node ESM did not resolve the full root bundle");
}

const expectedUserAgent = `APCA-NODE/${packageMetadata.version} Node/${process.versions.node}`;
if (trading.USER_AGENT !== expectedUserAgent) {
    throw new Error(
        `Node ESM USER_AGENT mismatch: expected ${expectedUserAgent}, received ${trading.USER_AGENT}`,
    );
}
