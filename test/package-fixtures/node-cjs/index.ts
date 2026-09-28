import {
    Alpaca,
    type Auction,
    type DailyAuctions,
} from "@alpacahq/alpaca-trade-api";

const client = new Alpaca({ keyId: "key", secret: "secret" });
const values: [Auction?, DailyAuctions?] = [];

void client;
void values;
