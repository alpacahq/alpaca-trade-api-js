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
