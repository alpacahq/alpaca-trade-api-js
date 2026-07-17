import { describe, expect, it } from "vitest";
import { applyOverlay, OverlayDriftError } from "../src/overlay.js";

describe("applyOverlay", () => {
  it("applies add patches without mutating the input", () => {
    const input = { components: { schemas: { A: {} } } };
    const out = applyOverlay(input, [
      { op: "add", path: "/components/schemas/A/x-ts-passthrough", value: true },
    ]) as typeof input & { components: { schemas: { A: { "x-ts-passthrough"?: boolean } } } };
    expect(out.components.schemas.A["x-ts-passthrough"]).toBe(true);
    expect((input.components.schemas.A as Record<string, unknown>)["x-ts-passthrough"]).toBeUndefined();
  });

  it("throws OverlayDriftError when a target path is missing", () => {
    expect(() =>
      applyOverlay({}, [
        { op: "replace", path: "/paths/~1z/get/parameters/0/schema", value: {} },
      ]),
    ).toThrow(OverlayDriftError);
  });

  it("drift error names the offending op + path", () => {
    try {
      applyOverlay({}, [{ op: "replace", path: "/nope", value: 1 }]);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OverlayDriftError);
      expect((err as OverlayDriftError).message).toMatch(/overlay drift/);
      expect((err as OverlayDriftError).message).toContain("/nope");
    }
  });
});
