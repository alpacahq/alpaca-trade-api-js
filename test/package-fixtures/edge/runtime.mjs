import * as sdk from "@alpacahq/alpaca-trade-api";
import packageMetadata from "@alpacahq/alpaca-trade-api/package.json" with { type: "json" };

if (typeof sdk.Alpaca !== "function" || "streaming" in sdk) {
    throw new Error("edge-light did not resolve the REST-only root bundle");
}

const expectedUserAgent = `APCA-NODE/${packageMetadata.version} Node/${process.versions.node}`;
if (sdk.trading.USER_AGENT !== expectedUserAgent) {
    throw new Error(
        `edge-light USER_AGENT mismatch: expected ${expectedUserAgent}, received ${sdk.trading.USER_AGENT}`,
    );
}
