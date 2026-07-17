// Keep this comment with the migrated SDK import.
import LegacyAlpaca, * as AlpacaNamespace from "@alpacahq/alpaca-trade-api" with { type: "javascript" };

const combinedClient = new LegacyAlpaca({
    keyId: "key",
    secretKey: "secret",
});
combinedClient.getAccount();
void AlpacaNamespace;
