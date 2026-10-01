import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("rejects reordered trading SSE terminal parameters", () => {
    const root = resolve(import.meta.dirname, "..");
    const spec = JSON.parse(
      readFileSync(resolve(root, "specs/trading-api.json"), "utf8"),
    );
    const overlay = JSON.parse(
      readFileSync(resolve(root, "overlays/trading.patch.json"), "utf8"),
    );
    const parameters =
      spec.paths["/v2beta1/events/activities"].get.parameters;
    [parameters[1], parameters[2]] = [parameters[2], parameters[1]];

    expect(() => applyOverlay(spec, overlay)).toThrowError(
      expect.objectContaining({
        name: "OverlayDriftError",
        message: expect.stringContaining(
          "/paths/~1v2beta1~1events~1activities/get/parameters/1/name",
        ),
      }),
    );
  });

  it("keeps the corporate-action event count aligned with its mapping", () => {
    const root = resolve(import.meta.dirname, "..");
    const spec = JSON.parse(
      readFileSync(resolve(root, "specs/market-data-api.json"), "utf8"),
    );
    const overlay = JSON.parse(
      readFileSync(resolve(root, "overlays/market-data.patch.json"), "utf8"),
    );
    const output = applyOverlay(spec, overlay) as typeof spec;
    const eventSchema =
      output.components.schemas.corporate_action_event;
    const variantCount = Object.keys(eventSchema.discriminator.mapping).length;

    expect(variantCount).toBe(16);
    expect(eventSchema.description).toContain(
      `${variantCount} per-type schemas`,
    );
  });
});
