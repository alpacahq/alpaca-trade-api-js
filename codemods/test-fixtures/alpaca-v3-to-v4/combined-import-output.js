// Keep this comment with the migrated SDK import.
import { Alpaca as LegacyAlpaca } from "@alpacahq/alpaca-trade-api" with { type: "javascript" };
import * as AlpacaNamespace from "@alpacahq/alpaca-trade-api" with { type: "javascript" };

const combinedClient = new LegacyAlpaca({
    keyId: "key",
    secret: "secret",
});
combinedClient.trading.account.getAccount();
void AlpacaNamespace;
