import {
    Alpaca,
    marketData,
    trading,
} from "@alpacahq/alpaca-trade-api";
import * as sdk from "@alpacahq/alpaca-trade-api/rest";

const alpaca = new Alpaca({
    keyId: "key",
    secret: "secret",
});
declare const asset: { easyToBorrow: boolean };
declare const announcement: {
    corporateActionsId: string;
    expirationDate: string;
};

const orderBody: trading.CreateOrderRequest =
    trading.CreateOrderRequestFromJSON({});
const orderRequest: trading.PostOrderRequest = {
    createOrderRequest: orderBody,
};
await alpaca.trading.orders.postOrder({ createOrderRequest: orderBody });
await alpaca.trading.orders.postOrderRaw(orderRequest);

const optionContracts =
    {} as trading.OptionContractsResponse;
const announcementList =
    {} as trading.CorporateAnnouncement;
const announcementById =
    {} as trading.CorporateAnnouncement;
const issuer: sdk.trading.TokenizationIssuer = "Alpaca";

await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({
    caTypes: ["Dividend"],
    since: "2026-01-01",
    until: "2026-01-31",
});

// TODO(alpaca-codemod): the index-values operation was removed upstream
await alpaca.marketData.indices.getIndexValues({});
console.log(asset.easyToBorrow);
console.log(announcement.corporateActionsId, announcement.expirationDate);

const details = {} as trading.CDIVActivityV2;
// TODO(alpaca-codemod): Trading dividend flags are the strings "true"/"false"; compare explicitly instead of using truthiness
if (details.foreign) {
    console.log("foreign dividend");
}

// TODO(alpaca-codemod): activity SSE now returns an async subscription; migrate array-style consumption and close the stream explicitly
const events =
    await alpaca.trading.events.subscribeToActivitiesSSE({});
for await (const event of events) {
    // TODO(alpaca-codemod): Trading dividend flags are the strings "true"/"false"; compare explicitly instead of using truthiness
    if (event.details.special) {
        console.log(event);
    }
}

const marketDividend = {} as marketData.CashDividend;
if (marketDividend.foreign) {
    console.log("market-data foreign dividend");
}

const historicalActivityType = "REORG";
console.log(
    optionContracts,
    announcementList,
    announcementById,
    issuer,
    historicalActivityType,
);
