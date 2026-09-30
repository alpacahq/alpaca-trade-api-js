import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import jscodeshift from "jscodeshift";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const transformer = require("./alpaca-v4-to-v5.js");
const fixtureDir = fileURLToPath(
    new URL("./test-fixtures/alpaca-v4-to-v5/", import.meta.url),
);

function fixture(name: string): string {
    return readFileSync(`${fixtureDir}${name}`, "utf8").trimEnd();
}

function transform(
    source: string,
    parser: "babel" | "tsx" = "tsx",
    options: Record<string, unknown> = {},
): {
    source: string | undefined;
    reports: string[];
} {
    const reports: string[] = [];
    const j = jscodeshift.withParser(parser);
    const result = transformer(
        { path: `fixture.${parser === "tsx" ? "ts" : "js"}`, source },
        {
            jscodeshift: j,
            j,
            report: (message: string) => reports.push(message),
            stats: () => {},
        },
        options,
    );
    return { source: result?.trimEnd(), reports };
}

const removedGeneratedMarketDataMethods = [
    ["IndexApi", "indexLatestValues"],
    ["IndexApi", "indexLatestValuesRaw"],
    ["IndexApi", "indexValues"],
    ["IndexApi", "indexValuesRaw"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestBars"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestBarsRaw"],
    [
        "CryptoPerpetualFuturesApi",
        "cryptoPerpLatestFuturesPricing",
    ],
    [
        "CryptoPerpetualFuturesApi",
        "cryptoPerpLatestFuturesPricingRaw",
    ],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestOrderbooks"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestOrderbooksRaw"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestQuotes"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestQuotesRaw"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestTrades"],
    ["CryptoPerpetualFuturesApi", "cryptoPerpLatestTradesRaw"],
] as const;

describe("alpaca-v4-to-v5 codemod", () => {
    it("matches the TypeScript migration fixture", () => {
        expect(transform(fixture("input.ts")).source).toBe(
            fixture("output.ts"),
        );
    });

    it("is idempotent after applying rewrites and review comments", () => {
        expect(transform(fixture("output.ts")).source).toBeUndefined();
    });

    it("reports semantic and removed API changes without rewriting them", () => {
        const result = transform(fixture("input.ts"));

        expect(result.reports).toEqual(
            expect.arrayContaining([
                expect.stringContaining(
                    "activity SSE now returns an async subscription",
                ),
                expect.stringContaining(
                    "index-values operation was removed",
                ),
                expect.stringContaining("`easyToBorrow` was removed"),
                expect.stringContaining(
                    "CorporateAnnouncement.corporateActionsId changed",
                ),
                expect.stringContaining(
                    "CorporateAnnouncement.expirationDate changed",
                ),
                expect.stringContaining(
                    'do not mechanically rewrite historical "REORG"',
                ),
                expect.stringContaining(
                    'Trading dividend flags are the strings "true"/"false"',
                ),
            ]),
        );
        expect(result.source).toContain(
            'const historicalActivityType = "REORG";',
        );
        expect(result.source).toContain("if (marketDividend.foreign)");
        expect(
            result.reports.filter((message) =>
                message.includes(
                    'Trading dividend flags are the strings "true"/"false"',
                ),
            ),
        ).toHaveLength(1);
    });

    it("supports CommonJS trading namespace bindings", () => {
        const result = transform(
            `const { trading: generated } = require("@alpacahq/alpaca-trade-api");
const sdk = require("@alpacahq/alpaca-trade-api/rest");
console.log(generated.PostOrderRequest, sdk.trading.PostOrderOperationRequest);`,
            "babel",
        );

        expect(result.source).toContain(
            "generated.PostOrderRequest, sdk.trading.PostOrderRequest",
        );
    });

    it("renames position-close response types and helpers across ESM and CommonJS", () => {
        const esm = transform(
            `import { trading } from "@alpacahq/alpaca-trade-api";
type Closed = trading.PositionClosedReponse;
const { PositionClosedReponseFromJSON: parse } = trading;
console.log(parse, trading.instanceOfPositionClosedReponse);`,
        );

        expect(esm.source).toContain(
            "type Closed = trading.PositionClosedResponse;",
        );
        expect(esm.source).toContain(
            "PositionClosedResponseFromJSON: parse",
        );
        expect(esm.source).toContain(
            "trading.instanceOfPositionClosedResponse",
        );
        expect(esm.source).not.toContain("PositionClosedReponse");

        const commonJs = transform(
            `const sdk = require("@alpacahq/alpaca-trade-api/rest");
const { trading: { PositionClosedReponseToJSON: serialize } } = sdk;
console.log(sdk.trading.PositionClosedReponseFromJSONTyped, serialize);`,
            "babel",
        );

        expect(commonJs.source).toContain(
            "PositionClosedResponseToJSON: serialize",
        );
        expect(commonJs.source).toContain(
            "sdk.trading.PositionClosedResponseFromJSONTyped",
        );
        expect(commonJs.source).not.toContain("PositionClosedReponse");
    });

    it("leaves dynamic computed destructuring keys unchanged", () => {
        const source = `const { trading } = require("@alpacahq/alpaca-trade-api");
const sdk = require("@alpacahq/alpaca-trade-api/rest");
const PositionClosedReponseFromJSON = getKey();
const tradingKey = getTradingKey();
const { [PositionClosedReponseFromJSON]: parse } = trading;
const { [tradingKey]: { PositionClosedReponseToJSON: serialize } } = sdk;
console.log(parse, serialize);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it("renames generated helpers in proven destructuring assignments", () => {
        const source = `const sdk = require("@alpacahq/alpaca-trade-api/rest");
let parse;
let serialize;
({ ["PositionClosedReponseFromJSON"]: parse } = sdk.trading);
({ trading: { PositionClosedReponseToJSON: serialize } } = sdk);
console.log(parse, serialize);`;
        const result = transform(source, "babel");

        expect(result.source).toContain(
            '["PositionClosedResponseFromJSON"]: parse',
        );
        expect(result.source).toContain(
            "PositionClosedResponseToJSON: serialize",
        );
        expect(result.source).not.toContain("PositionClosedReponse");
        expect(
            transform(result.source ?? source, "babel").source,
        ).toBeUndefined();
    });

    it("leaves reassigned CommonJS SDK bindings unchanged", () => {
        const source = `let { trading } = require("@alpacahq/alpaca-trade-api");
trading = custom;
trading.PostOrderRequestFromJSON(body);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it("reports standalone PostOrderRequest types instead of guessing their meaning", () => {
        const source = `import { trading } from "@alpacahq/alpaca-trade-api";
type Request = trading.PostOrderRequest;`;
        const result = transform(source);

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual([
            expect.stringContaining(
                "`trading.PostOrderRequest` is ambiguous",
            ),
        ]);
    });

    it("does not infer an order body from unrelated object property names", () => {
        const source = `import { trading } from "@alpacahq/alpaca-trade-api";
const request: trading.PostOrderRequest = getRequest();
const audit = { postOrderRequest: request };
console.log(audit);`;
        const result = transform(source);

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual([
            expect.stringContaining(
                "`trading.PostOrderRequest` is ambiguous",
            ),
        ]);
    });

    it("leaves unproven trading orders receivers unchanged", () => {
        const source = `const unrelated = {
  trading: { orders: { postOrder(request) { return request; } } }
};
unrelated.trading.orders.postOrder({ postOrderRequest: body });`;
        const result = transform(source, "babel");

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual([
            expect.stringContaining(
                "an unproven `.trading.orders` receiver was left unchanged",
            ),
        ]);
    });

    it("marks variable-backed generated order requests for review", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const request = getRequest();
alpaca.trading.orders.postOrder(request);`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): a variable-backed `postOrder` request was left unchanged because it may be shared",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "a variable-backed `postOrder` request was left unchanged because it may be shared",
            ),
        ]);
    });

    it("leaves shared variable-backed generated order requests unchanged", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const request = { postOrderRequest: body };
consume(request);
const alias = request;
alpaca.trading.orders.postOrder(alias);`;
        const result = transform(source);

        expect(result.source).toContain(
            "const request = { postOrderRequest: body };",
        );
        expect(result.source).toContain("consume(request);");
        expect(result.source).toContain(
            "TODO(alpaca-codemod): a variable-backed `postOrder` request was left unchanged because it may be shared",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "a variable-backed `postOrder` request was left unchanged because it may be shared",
            ),
        ]);
        expect(transform(result.source ?? source).source).toBeUndefined();
    });

    it("does not partially rewrite a typed variable-backed order request with property writes", () => {
        const source = `import { Alpaca, trading } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const request: trading.PostOrderOperationRequest = { postOrderRequest: first };
request.postOrderRequest = second;
alpaca.trading.orders.postOrder(request);`;
        const result = transform(source);

        expect(result.source).toContain(
            "const request: trading.PostOrderRequest = { postOrderRequest: first };",
        );
        expect(result.source).toContain(
            "request.postOrderRequest = second;",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): a variable-backed `postOrder` request was left unchanged because it may be shared",
        );
    });

    it("marks expression-backed generated order requests for review", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
alpaca.trading.orders.postOrder(getRequest());`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): an expression-backed `postOrder` request could not be migrated safely",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "an expression-backed `postOrder` request could not be migrated safely",
            ),
        ]);
    });

    it("rewrites proven generated corporate-action receivers", () => {
        const source = `import { trading } from "@alpacahq/alpaca-trade-api";
const api = new trading.CorporateActionsApi();
api.getV2CorporateActionsAnnouncements({ caTypes: "dividend" });`;
        const result = transform(source);

        expect(result.source).toContain(
            'api.getV2CorporateActionsAnnouncements({ caTypes: ["Dividend"] });',
        );
        expect(result.reports).toEqual([]);
    });

    it("tracks destructured generated Trading API constructors", () => {
        const source = `import { trading } from "@alpacahq/alpaca-trade-api/rest";
const { OrdersApi, CorporateActionsApi, EventsApi } = trading;
const orders = new OrdersApi();
const corporateActions = new CorporateActionsApi();
const events = new EventsApi();
orders.postOrder({ postOrderRequest: body });
corporateActions.getV2CorporateActionsAnnouncements({ caTypes: "dividend" });
events.subscribeToActivitiesSSE({});`;
        const result = transform(source);

        expect(result.source).toContain(
            "orders.postOrder({ createOrderRequest: body });",
        );
        expect(result.source).toContain(
            'corporateActions.getV2CorporateActionsAnnouncements({ caTypes: ["Dividend"] });',
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): activity SSE now returns an async subscription",
        );
    });

    it("tracks stable aliases of SDK namespaces", () => {
        const source = `import * as sdk from "@alpacahq/alpaca-trade-api/rest";
const trade = sdk.trading;
const md = sdk.marketData;
trade.PositionClosedReponseFromJSON(payload);
const indices = new md.IndexApi();
indices.indexValues({});`;
        const result = transform(source);

        expect(result.source).toContain(
            "trade.PositionClosedResponseFromJSON(payload);",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the generated index-values API was removed upstream",
        );
    });

    it("splits and canonicalizes literal corporate-action CSV values", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({
  caTypes: " dividend, Merger,DIVIDEND "
});`;
        const result = transform(source);

        expect(result.source).toContain(
            'caTypes: ["Dividend", "Merger", "Dividend"]',
        );
        expect(result.reports).toEqual([]);
        expect(transform(result.source ?? source).source).toBeUndefined();
    });

    it("leaves unknown literal corporate-action values for review", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements({
  caTypes: "Dividend,Unknown"
});`;
        const result = transform(source);

        expect(result.source).toContain(
            'caTypes: "Dividend,Unknown"',
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the `caTypes` value could not be proven to be a v5 array",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "the `caTypes` value could not be proven to be a v5 array",
            ),
        ]);
    });

    it("leaves shared variable-backed corporate-action requests unchanged", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const request = { caTypes: "dividend" };
consume(request);
alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements(request);`;
        const result = transform(source);

        expect(result.source).toContain(
            'const request = { caTypes: "dividend" };',
        );
        expect(result.source).toContain("consume(request);");
        expect(result.source).toContain(
            "TODO(alpaca-codemod): a variable-backed corporate-actions request was left unchanged because it may be shared",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "a variable-backed corporate-actions request was left unchanged because it may be shared",
            ),
        ]);
    });

    it("marks unresolved corporate-action request expressions for review", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
alpaca.trading.corporateActions.getV2CorporateActionsAnnouncements(getRequest());`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): an expression-backed corporate-actions request could not be migrated safely",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "an expression-backed corporate-actions request could not be migrated safely",
            ),
        ]);
    });

    it("leaves unrelated corporate-action lookalikes unchanged", () => {
        const source = `const unrelated = {
  getV2CorporateActionsAnnouncements(request) { return request; }
};
unrelated.getV2CorporateActionsAnnouncements({ caTypes: ["dividend"] });`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it("leaves unproven facade-shaped corporate-action receivers unchanged", () => {
        const source = `const unrelated = {
  trading: {
    corporateActions: {
      getV2CorporateActionsAnnouncements(request) { return request; }
    }
  }
};
unrelated.trading.corporateActions.getV2CorporateActionsAnnouncements({
  caTypes: ["dividend"]
});`;
        const result = transform(source, "babel");

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual([
            expect.stringContaining(
                "an unproven `.trading.corporateActions` receiver was left unchanged",
            ),
        ]);
    });

    it("leaves unrelated SSE and removed-method lookalikes unchanged", () => {
        const source = `const unrelated = {
  subscribeToActivitiesSSE() { return []; },
  getIndexValues() { return [1]; },
  indexValues() { return [2]; },
  cryptoPerpLatestBars() { return [3]; }
};
const events = await unrelated.subscribeToActivitiesSSE();
for await (const event of events) {
  if (event.details.foreign) console.log(event);
}
console.log(
  unrelated.getIndexValues(),
  unrelated.indexValues(),
  unrelated.cryptoPerpLatestBars()
);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it.each([
        `import { trading as trade } from "@alpacahq/alpaca-trade-api";
if (activity.activityType === trade.ActivityType.Reorg) handle(activity);`,
        `import * as sdk from "@alpacahq/alpaca-trade-api";
const activityTypes = sdk.trading.ActivityType;
const stableAlias = activityTypes;
if (activity.activityType === stableAlias["Reorg"]) handle(activity);`,
        `const sdk = require("@alpacahq/alpaca-trade-api");
const { ActivityType: Types } = sdk.trading;
if (activity.activityType === Types.Reorg) handle(activity);`,
        `const { ActivityType } = require("@alpacahq/alpaca-trade-api").trading;
if (activity.activityType === ActivityType.Reorg) handle(activity);`,
        `import { trading } from "@alpacahq/alpaca-trade-api";
const { Reorg } = trading.ActivityType;
if (activity.activityType === Reorg) handle(activity);`,
        `const {
  trading: { ActivityType: { Reorg: LegacyReorg } }
} = require("@alpacahq/alpaca-trade-api");
if (activity.activityType === LegacyReorg) handle(activity);`,
        `const {
  trading: { ActivityType }
} = require("@alpacahq/alpaca-trade-api");
const { Reorg } = ActivityType;
if (activity.activityType === Reorg) handle(activity);`,
    ])(
        "reports proven ActivityType.Reorg without rewriting it",
        (source) => {
            const result = transform(
                source,
                source.startsWith("const") ? "babel" : "tsx",
            );

            expect(result.source).toBeUndefined();
            expect(result.reports).toEqual([
                expect.stringContaining(
                    'do not mechanically rewrite historical "REORG"',
                ),
            ]);
        },
    );

    it("does not report unrelated Reorg members", () => {
        const source = `const unrelated = {
  ActivityType: { Reorg: "application-value" }
};
console.log(unrelated.ActivityType.Reorg);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it("flags removed market-data APIs only on proven SDK receivers", () => {
        const source = `import {
  Alpaca,
  marketData,
  marketDataShapes
} from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const indexApi = new marketData.IndexApi();
indexApi.getIndexValues({});
alpaca.marketData.iterateIndexValues({});
marketDataShapes.toIndexValue({});`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): the index-values operation was removed upstream",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the ergonomic index iterator was removed",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the index-value shape helper was removed",
        );
    });

    it("flags removed facade APIs through the public data alias", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
alpaca.data.indices.getIndexValues({});
alpaca.data.iterateIndexValues({});
alpaca.data.cryptoPerpetualFutures.cryptoPerpLatestTrades({});`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): the index-values operation was removed upstream",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the ergonomic index iterator was removed",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the crypto perpetual-futures trades operation was removed upstream",
        );
        expect(result.reports).toHaveLength(3);
    });

    it("flags removed generated Market Data models and runtime helpers", () => {
        const source = `import { marketData as md } from "@alpacahq/alpaca-trade-api";
import * as sdk from "@alpacahq/alpaca-trade-api";
type Pricing = md.CryptoPerpFuturesPricing;
type Values = sdk.marketData.IndexValuesResp;
const parsePricing = md.CryptoPerpLatestFuturesPricingRespFromJSON;
const { CryptoPerpLoc, instanceOfIndexLatestValuesResp } = md;
console.log(parsePricing, CryptoPerpLoc, instanceOfIndexLatestValuesResp);`;
        const result = transform(source);

        for (const removedName of [
            "CryptoPerpFuturesPricing",
            "IndexValuesResp",
            "CryptoPerpLatestFuturesPricingRespFromJSON",
            "CryptoPerpLoc",
            "instanceOfIndexLatestValuesResp",
        ]) {
            expect(result.source).toContain(
                `TODO(alpaca-codemod): the generated Market Data export \`${removedName}\` was removed upstream`,
            );
            expect(result.reports).toContainEqual(
                expect.stringContaining(
                    `the generated Market Data export \`${removedName}\` was removed upstream`,
                ),
            );
        }
    });

    it.each(removedGeneratedMarketDataMethods)(
        "flags removed generated %s.%s calls",
        (apiName, methodName) => {
            const source = `import { marketData } from "@alpacahq/alpaca-trade-api";
const api = new marketData.${apiName}();
api.${methodName}({});`;
            const result = transform(source);

            expect(result.source).toContain(
                "TODO(alpaca-codemod): the generated",
            );
            expect(result.source).toMatch(
                new RegExp(
                    `TODO\\(alpaca-codemod\\): the .*${apiName === "IndexApi" ? "index-values" : "crypto perpetual-futures"}.* operation was removed upstream`,
                ),
            );
            expect(result.reports).toHaveLength(2);
            expect(transform(result.source ?? source).source).toBeUndefined();
        },
    );

    it.each([
        `import { marketData as md } from "@alpacahq/alpaca-trade-api";
const { IndexApi: RemovedIndex } = md;
const Constructor = RemovedIndex;
const api = new Constructor();
api.indexValues({});`,
        `const { marketData: md } = require("@alpacahq/alpaca-trade-api");
const { CryptoPerpetualFuturesApi } = md;
const api = new CryptoPerpetualFuturesApi();
api.cryptoPerpLatestBars({});`,
        `const { IndexApi } = require("@alpacahq/alpaca-trade-api").marketData;
const api = new IndexApi();
api.indexLatestValues({});`,
        `const {
  marketData: { IndexApi: RemovedIndex }
} = require("@alpacahq/alpaca-trade-api");
const api = new RemovedIndex();
api.indexValues({});`,
    ])(
        "flags destructured generated Market Data constructors",
        (source) => {
            const result = transform(
                source,
                source.startsWith("const") ? "babel" : "tsx",
            );

            expect(result.source).toContain(
                "TODO(alpaca-codemod): the generated",
            );
            expect(result.reports).toHaveLength(2);
            expect(transform(
                result.source ?? source,
                source.startsWith("const") ? "babel" : "tsx",
            ).source).toBeUndefined();
        },
    );

    it("uses explicit instance names for dependency-injected facade clients", () => {
        const source = `function migrate(client) {
  const stable = client;
  return stable.marketData.indices.getIndexValues({});
}`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });

        const result = transform(source, "babel", {
            instanceName: "client",
        });
        expect(result.source).toContain(
            "TODO(alpaca-codemod): the index-values operation was removed upstream",
        );
        expect(result.reports).toEqual([
            expect.stringContaining(
                "the index-values operation was removed upstream",
            ),
        ]);
        expect(
            transform(result.source ?? source, "babel", {
                instanceName: "client",
            }).source,
        ).toBeUndefined();
    });

    it("ignores an explicitly named client when the file has shadowed bindings", () => {
        const source = `function migrate(client) {
  return client.trading.corporateActions.getV2CorporateActionsAnnouncements({
    caTypes: "Dividend"
  });
}
function unrelated(client) {
  return client.trading.corporateActions.getV2CorporateActionsAnnouncements({
    caTypes: "Dividend"
  });
}`;
        const result = transform(source, "babel", {
            instanceName: "client",
        });

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual(
            expect.arrayContaining([
                expect.stringContaining(
                    "--instanceName=client matched multiple lexical bindings and was ignored",
                ),
                expect.stringContaining(
                    "an unproven `.trading.corporateActions` receiver was left unchanged",
                ),
            ]),
        );
    });

    it("ignores an explicitly named client when its binding is redeclared", () => {
        const source = `var client = getAlpaca();
var client = getUnrelatedClient();
client.trading.orders.postOrder({ postOrderRequest: body });`;
        const result = transform(source, "babel", {
            instanceName: "client",
        });

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual(
            expect.arrayContaining([
                expect.stringContaining(
                    "--instanceName=client was ignored for a redeclared binding",
                ),
                expect.stringContaining(
                    "an unproven `.trading.orders` receiver was left unchanged",
                ),
            ]),
        );
    });

    it("ignores an explicitly named facade binding when it is reassigned", () => {
        const source = `function migrate(client) {
  client = getReplacement();
  return client.marketData.indices.getIndexValues({});
}`;
        const result = transform(source, "babel", {
            instanceName: "client",
        });

        expect(result.source).toBeUndefined();
        expect(result.reports).toEqual([
            expect.stringContaining(
                "--instanceName=client was ignored for a reassigned binding",
            ),
        ]);
    });

    it("flags truthy dividend flags on typed function parameters", () => {
        const source = `import { trading } from "@alpacahq/alpaca-trade-api/rest";
function handle(details: trading.CDIVActivityV2) {
  if (details.foreign) act();
}
const handleArrow = (details: trading.CommonCDIVActivityV2) =>
  details.special && act();
class Handler {
  handle(details: trading.DIVSPDActivityV2) {
    return Boolean(details.foreign);
  }
}`;
        const result = transform(source);
        const marker =
            'TODO(alpaca-codemod): Trading dividend flags are the strings "true"/"false"';

        expect(result.source?.split(marker)).toHaveLength(4);
        expect(result.reports).toEqual([
            expect.stringContaining(
                'Trading dividend flags are the strings "true"/"false"',
            ),
        ]);
    });

    it("leaves unrelated changed-field lookalikes unchanged", () => {
        const source = `const unrelated = {
  easyToBorrow: true,
  corporateActionsId: "id",
  expirationDate: "2026-01-01"
};
console.log(
  unrelated.easyToBorrow,
  unrelated.corporateActionsId,
  unrelated.expirationDate
);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });

    it("adds a distinct review TODO when another codemod TODO exists", () => {
        const source = `import { Alpaca } from "@alpacahq/alpaca-trade-api";
const alpaca = new Alpaca();
const request = getRequest();
// TODO(alpaca-codemod): keep this separate
alpaca.trading.orders.postOrder(request);`;
        const result = transform(source);

        expect(result.source).toContain(
            "TODO(alpaca-codemod): keep this separate",
        );
        expect(result.source).toContain(
            "TODO(alpaca-codemod): a variable-backed `postOrder` request was left unchanged because it may be shared",
        );
    });

    it("leaves unrelated lookalikes unchanged", () => {
        const source = `const unrelated = {
  indices: { value: 1 },
  foreign: "false",
  postOrder(request) { return request; }
};
if (unrelated.foreign) unrelated.postOrder({ postOrderRequest: body });
console.log(unrelated.indices.value);`;

        expect(transform(source, "babel")).toEqual({
            source: undefined,
            reports: [],
        });
    });
});
