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
        {},
    );
    return { source: result?.trimEnd(), reports };
}

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
            'api.getV2CorporateActionsAnnouncements({ caTypes: ["dividend"] });',
        );
        expect(result.reports).toEqual([]);
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
  getIndexValues() { return [1]; }
};
const events = await unrelated.subscribeToActivitiesSSE();
for await (const event of events) {
  if (event.details.foreign) console.log(event);
}
console.log(unrelated.getIndexValues());`;

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
