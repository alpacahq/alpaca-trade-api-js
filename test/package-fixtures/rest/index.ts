import {
    Alpaca,
    type AlpacaClientOptions,
    type Auction,
    type DailyAuctions,
    type SseOptions,
    type SseSubscription,
    type trading,
} from "@alpacahq/alpaca-trade-api/rest";

const options: AlpacaClientOptions = {
    keyId: "key",
    secret: "secret",
    credentials: "include",
    redirect: "error",
};
const client = new Alpaca(options);
const values: [Auction?, DailyAuctions?] = [];
const sseOptions: SseOptions = { reconnect: false };
const events: Promise<SseSubscription<trading.ActivityEventV2>> =
    client.trading.events.subscribeToActivitiesSSE({}, sseOptions);
const ergonomicEvents: Promise<SseSubscription<trading.ActivityEventV2>> =
    client.trading.subscribeActivities({}, sseOptions);

void client;
void events;
void ergonomicEvents;
void values;
