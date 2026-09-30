import {
    Alpaca,
    type AlpacaClientOptions,
    type Auction,
    type DailyAuctions,
    type SseSubscription,
    type trading,
} from "@alpacahq/alpaca-trade-api";

const options: AlpacaClientOptions = {
    keyId: "key",
    secret: "secret",
    credentials: "same-origin",
    redirect: "manual",
};
const transport: trading.ConfigurationParameters = {
    credentials: "include",
    redirect: "error",
};
const travelRuleInfo: trading.TravelRuleInfo = {
    beneficiaryIsSelfHosted: true,
    beneficiaryGivenName: "Ada",
    beneficiaryFamilyName: "Lovelace",
};
// @ts-expect-error Travel Rule requests require destination and identity fields.
const invalidTravelRuleInfo: trading.TravelRuleInfo = {};
const client = new Alpaca(options);
const values: [Auction?, DailyAuctions?] = [];
const activities: Promise<SseSubscription<trading.ActivityEventV2>> =
    client.trading.subscribeActivities({}, { reconnect: false });
const closeAllPositions: () => Promise<
    trading.PositionClosedResponse[]
> = () => client.trading.closeAllPositions();

void client;
void activities;
void closeAllPositions;
void invalidTravelRuleInfo;
void transport;
void travelRuleInfo;
void values;
