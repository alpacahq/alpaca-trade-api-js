import {
    Alpaca,
    type Auction,
    type DailyAuctions,
    type IndexValue,
} from "@alpacahq/alpaca-trade-api";

const client = new Alpaca({ keyId: "key", secret: "secret" });
const values: [IndexValue?, Auction?, DailyAuctions?] = [];

void client;
void values;
