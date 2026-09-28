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

const orderBody: trading.PostOrderRequest =
    trading.PostOrderRequestFromJSON({});
const orderRequest: trading.PostOrderOperationRequest = {
    postOrderRequest: orderBody,
};
await alpaca.trading.orders.postOrder({ postOrderRequest: orderBody });
await alpaca.trading.orders.postOrderRaw(orderRequest);

const optionContracts =
    {} as trading.GetOptionsContracts200Response;
const announcementList =
    {} as trading.GetV2CorporateActionsAnnouncements200ResponseInner;
const announcementById =
    {} as trading.GetV2CorporateActionsAnnouncementsId200Response;
const issuer: sdk.trading.GetTokenizationRequestsIssuerEnum = "Alpaca";

await alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({
    caTypes: "Dividend",
    since: "2026-01-01",
    until: "2026-01-31",
});

await alpaca.marketData.indices.getIndexValues({});
console.log(asset.easyToBorrow);
console.log(announcement.corporateActionsId, announcement.expirationDate);

const details = {} as trading.CDIVActivityV2;
if (details.foreign) {
    console.log("foreign dividend");
}

const events =
    await alpaca.trading.events.subscribeToActivitiesSSE({});
for await (const event of events) {
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
