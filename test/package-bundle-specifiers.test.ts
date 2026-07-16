import { describe, expect, it } from "vitest";
import {
    externalModuleSpecifiers,
    forbiddenExternalSpecifiers,
    parseNpmPackJson,
} from "../scripts/bundle-specifiers.mjs";

describe("packed bundle dependency scanning", () => {
    it("finds static imports, requires, exports, and dynamic imports", () => {
        const source = `
            import { EventEmitter } from "node:events";
            import "side-effect";
            const WebSocket = require("ws");
            export * from "lossless-json";
            const msgpack = import("@msgpack/msgpack");
        `;

        expect(externalModuleSpecifiers(source)).toEqual([
            "@msgpack/msgpack",
            "lossless-json",
            "node:events",
            "side-effect",
            "ws",
        ]);
        expect(
            forbiddenExternalSpecifiers(source, [
                "node:events",
                "ws",
                "@msgpack/msgpack",
            ]),
        ).toEqual(["@msgpack/msgpack", "node:events", "ws"]);
    });

    it("parses npm pack JSON after lifecycle output", () => {
        const output = `CLI Building entry: src/index.ts
ESM Build success
[
  {
    "filename": "alpacahq-alpaca-trade-api-4.0.0.tgz",
    "version": "4.0.0",
    "files": []
  }
]
`;

        expect(parseNpmPackJson(output)).toEqual([
            {
                filename: "alpacahq-alpaca-trade-api-4.0.0.tgz",
                version: "4.0.0",
                files: [],
            },
        ]);
    });
});
