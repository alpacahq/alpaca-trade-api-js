import { describe, expect, it } from "vitest";
import {
    externalModuleSpecifiers,
    forbiddenExternalSpecifiers,
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
});
