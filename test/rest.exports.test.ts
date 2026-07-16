import { describe, expect, it } from "vitest";
import * as main from "../src/index";
import * as rest from "../src/rest";

describe("REST runtime export parity", () => {
    it("matches the root entrypoint except for streaming", () => {
        const mainExports: Record<string, unknown> = main;
        const restExports: Record<string, unknown> = rest;
        const rootExports = Object.keys(mainExports)
            .filter((name) => name !== "streaming")
            .sort();
        expect(Object.keys(restExports).sort()).toEqual(rootExports);

        for (const name of rootExports) {
            expect(restExports[name], name).toBe(mainExports[name]);
        }
    });
});
