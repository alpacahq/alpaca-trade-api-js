import {
    Alpaca,
    type Auction,
    type DailyAuctions,
    type trading,
} from "@alpacahq/alpaca-trade-api";

const client = new Alpaca({ keyId: "key", secret: "secret" });
const values: [Auction?, DailyAuctions?] = [];
const closeAllPositions: () => Promise<
    trading.PositionClosedResponse[]
> = () => client.trading.closeAllPositions();
const actions = client.marketData.subscribeCorporateActions(
    {},
    { reconnect: false },
);

void actions;
void closeAllPositions;
void client;
void values;
