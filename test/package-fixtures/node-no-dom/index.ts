import type {
    AlpacaClientOptions,
    trading,
} from "@alpacahq/alpaca-trade-api";

const options: AlpacaClientOptions = {
    credentials: "omit",
    redirect: "follow",
};
const configuration: trading.ConfigurationParameters = {
    credentials: "same-origin",
    redirect: "manual",
};

void options;
void configuration;
