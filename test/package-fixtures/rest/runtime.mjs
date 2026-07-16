import * as sdk from "@alpacahq/alpaca-trade-api/rest";
import packageMetadata from "@alpacahq/alpaca-trade-api/package.json" with { type: "json" };

if (typeof sdk.Alpaca !== "function" || "streaming" in sdk) {
    throw new Error("explicit /rest did not resolve the REST-only bundle");
}

const expectedUserAgent = `APCA-NODE/${packageMetadata.version} Node/${process.versions.node}`;
if (sdk.trading.USER_AGENT !== expectedUserAgent) {
    throw new Error(
        `explicit /rest USER_AGENT mismatch: expected ${expectedUserAgent}, received ${sdk.trading.USER_AGENT}`,
    );
}
