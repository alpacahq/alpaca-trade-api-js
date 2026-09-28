import {
    Alpaca,
    type Auction,
    type DailyAuctions,
} from "@alpacahq/alpaca-trade-api";

const client = new Alpaca({ keyId: "key", secret: "secret" });
const values: [Auction?, DailyAuctions?] = [];
const actions = client.marketData.subscribeCorporateActions(
    {},
    { reconnect: false },
);

void actions;
void client;
void values;
