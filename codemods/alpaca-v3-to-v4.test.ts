import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import jscodeshift from "jscodeshift";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const transformer = require("./alpaca-v3-to-v4.js");
const fixtureDir = fileURLToPath(
    new URL("./test-fixtures/alpaca-v3-to-v4/", import.meta.url),
);

function fixture(name: string): string {
    return readFileSync(`${fixtureDir}${name}`, "utf8").trimEnd();
}

function transform(
    source: string,
    options: Record<string, unknown> = {},
): {
    source: string | undefined;
    reports: string[];
} {
    const reports: string[] = [];
    const result = transformer(
        { path: "fixture.js", source },
        {
            jscodeshift: jscodeshift.withParser("babel"),
            j: jscodeshift.withParser("babel"),
            report: (message: string) => reports.push(message),
            stats: () => {},
        },
        options,
    );
    return { source: result?.trimEnd(), reports };
}

describe("alpaca-v3-to-v4 codemod", () => {
    it("matches the migration golden fixture", () => {
        expect(transform(fixture("input.js")).source).toBe(fixture("output.js"));
    });

    it("splits default plus namespace imports into valid declarations", () => {
        expect(transform(fixture("combined-import-input.js")).source).toBe(
            fixture("combined-import-output.js"),
        );
    });

    it("keeps reassigned and assignment-proven bindings unchanged", () => {
        const result = transform(fixture("flow-input.js"));
        expect(result.source).toBe(fixture("flow-output.js"));
        expect(result.reports).toEqual(
            expect.arrayContaining([
                expect.stringContaining("ambiguous constructor binding MutableCtor"),
                expect.stringContaining("assignment-based constructor binding LateCtor"),
                expect.stringContaining("ambiguous client binding unrelatedClient"),
                expect.stringContaining("ambiguous client binding provenReassignedClient"),
                expect.stringContaining("assignment-based client binding lateClient"),
                expect.stringContaining("ambiguous client binding destructuredClient"),
                expect.stringContaining("ambiguous stream binding unrelatedStream"),
                expect.stringContaining("ambiguous stream binding provenReassignedStream"),
                expect.stringContaining("assignment-based stream binding lateStream"),
                expect.stringContaining("ambiguous stream binding destructuredStream"),
            ]),
        );
    });

    it("is idempotent on migrated source", () => {
        expect(transform(fixture("output.js")).source).toBeUndefined();
        expect(
            transform(fixture("combined-import-output.js")).source,
        ).toBeUndefined();
        expect(transform(fixture("flow-output.js")).source).toBeUndefined();
    });

    it("reports ambiguous and lossy streaming migrations for manual review", () => {
        const { reports } = transform(fixture("input.js"));
        expect(reports).toEqual(
            expect.arrayContaining([
                expect.stringContaining("ambiguous stream accessor on alpaca"),
                expect.stringContaining("unproven stream receiver alpaca"),
                expect.stringContaining("multiple subscription channels"),
                expect.stringContaining("market-data stream stocks"),
            ]),
        );
        expect(
            reports.filter((message) =>
                message.includes(
                    "unsupported trading stream subscribe on updates",
                ),
            ),
        ).toHaveLength(5);
    });

    it("scopes explicit instanceName bindings lexically", () => {
        const result = transform(
            `const custom = getClient();
custom.getAccount();
function nested() {
    custom.getClock();
}
function shadow(custom) {
    custom.getAccount();
}`,
            { instanceName: "custom" },
        );
        expect(result.source).toContain(
            "custom.trading.account.getAccount();",
        );
        expect(result.source).toContain(
            "custom.trading.clock.legacyClock();",
        );
        expect(result.source).toContain(
            "function shadow(custom) {\n    custom.getAccount();\n}",
        );
        expect(
            transform("custom.getAccount();", {
                instanceName: "custom",
            }).source,
        ).toBeUndefined();
    });
});
