import {
    Alpaca,
    type AlpacaClientOptions,
    type Auction,
    type DailyAuctions,
    type IndexValue,
} from "@alpacahq/alpaca-trade-api/rest";

const options: AlpacaClientOptions = {
    keyId: "key",
    secret: "secret",
    credentials: "include",
    redirect: "error",
};
const client = new Alpaca(options);
const values: [IndexValue?, Auction?, DailyAuctions?] = [];

void client;
void values;
