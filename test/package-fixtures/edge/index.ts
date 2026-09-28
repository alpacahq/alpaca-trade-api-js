import {
    Alpaca,
    type Auction,
    type DailyAuctions,
    type SseOptions,
} from "@alpacahq/alpaca-trade-api";

const client = new Alpaca({ keyId: "key", secret: "secret" });
const values: [Auction?, DailyAuctions?] = [];
const options: SseOptions = { reconnect: { maxAttempts: 2 } };
const events = client.marketData.corporateActions.subscribeToCorporateActionsEventsSSE(
    {},
    options,
);
const ergonomicEvents = client.marketData.subscribeCorporateActions({}, options);

void client;
void events;
void ergonomicEvents;
void values;
