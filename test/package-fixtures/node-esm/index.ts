import {
    Alpaca,
    type AlpacaClientOptions,
    type Auction,
    type DailyAuctions,
    type IndexValue,
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
const client = new Alpaca(options);
const values: [IndexValue?, Auction?, DailyAuctions?] = [];

void client;
void transport;
void values;
