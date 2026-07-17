import { describe, expect, it } from "vitest";
import {
    detectRuntimeIdentity,
    formatUserAgent,
} from "../src/core/runtimeIdentity";
import { USER_AGENT } from "../src/core/runtime";

describe("runtime identity", () => {
    it("applies the identity to the exported source User-Agent", () => {
        expect(USER_AGENT).toBe(
            `APCA-NODE/0.0.0-dev Node/${process.versions.node}`,
        );
    });

    it("detects Node", () => {
        expect(
            detectRuntimeIdentity({
                process: { versions: { node: "22.4.0" } },
            }),
        ).toBe("Node/22.4.0");
    });

    it("detects Bun before its Node compatibility process", () => {
        expect(
            detectRuntimeIdentity({
                Bun: { version: "1.2.3" },
                process: { versions: { node: "22.4.0" } },
            }),
        ).toBe("Bun/1.2.3");
    });

    it("detects Deno before its Node compatibility process", () => {
        expect(
            detectRuntimeIdentity({
                Deno: { version: { deno: "2.1.4" } },
                process: { versions: { node: "22.4.0" } },
            }),
        ).toBe("Deno/2.1.4");
    });

    it("uses unknown when no supported runtime is present", () => {
        expect(detectRuntimeIdentity({})).toBe("Unknown/unknown");
    });

    it.each([
        ["Bun", { Bun: {} }, "Bun/unknown"],
        ["Deno", { Deno: { version: {} } }, "Deno/unknown"],
        [
            "Node",
            { process: { versions: { node: "22.4.0\r\nInjected: yes" } } },
            "Node/unknown",
        ],
    ])(
        "keeps the %s runtime identity when its version is missing or malformed",
        (_runtime, globals, expected) => {
            expect(detectRuntimeIdentity(globals)).toBe(expected);
        },
    );

    it("does not evaluate hostile structural getters", () => {
        const globals = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(globals, "Bun", {
            get() {
                throw new Error("blocked");
            },
        });

        expect(detectRuntimeIdentity(globals)).toBe("Unknown/unknown");
    });

    it("formats the exact header-safe SDK and runtime identity", () => {
        expect(
            formatUserAgent("4.0.0", {
                process: { versions: { node: "22.4.0" } },
            }),
        ).toBe("APCA-NODE/4.0.0 Node/22.4.0");
        expect(
            formatUserAgent("4.0.0\r\nInjected: yes", {
                process: { versions: { node: "22.4.0" } },
            }),
        ).toBe("APCA-NODE/unknown Node/22.4.0");
    });
});
