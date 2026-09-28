import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Operation } from "fast-json-patch";
import { describe, expect, it } from "vitest";
import { applyOverlay } from "../src/overlay.js";
import { assertTravelRuleContract } from "../src/travelRuleContract.js";

function derivedTradingSpec(): any {
  const root = resolve(import.meta.dirname, "..");
  const spec = JSON.parse(
    readFileSync(resolve(root, "specs/trading-api.json"), "utf8"),
  );
  const overlay = JSON.parse(
    readFileSync(resolve(root, "overlays/trading.patch.json"), "utf8"),
  ) as Operation[];
  return applyOverlay(spec, overlay);
}

describe("assertTravelRuleContract", () => {
  it("accepts the pinned marked TravelRuleInfo schema", () => {
    expect(() =>
      assertTravelRuleContract(derivedTradingSpec(), true),
    ).not.toThrow();
  });

  it("rejects a missing marker", () => {
    const spec = derivedTradingSpec();
    delete spec.components.schemas.TravelRuleInfo["x-ts-travel-rule-info"];

    expect(() => assertTravelRuleContract(spec, true)).toThrow(
      /expected exactly one marked TravelRuleInfo/,
    );
  });

  it("rejects drift in a hardcoded alternative property", () => {
    const spec = derivedTradingSpec();
    delete spec.components.schemas.TravelRuleInfo.properties
      .beneficiary_family_name;

    expect(() => assertTravelRuleContract(spec, true)).toThrow(
      /beneficiary_family_name/,
    );
  });

  it("rejects drift in the hardcoded manual-entry fields", () => {
    const spec = derivedTradingSpec();
    spec.components.schemas.TravelRuleManualEntry.required = ["vasp_name"];

    expect(() => assertTravelRuleContract(spec, true)).toThrow(
      /TravelRuleManualEntry\.vasp_website/,
    );
  });

  it("rejects the marker outside the trading specification", () => {
    const spec = derivedTradingSpec();

    expect(() => assertTravelRuleContract(spec, false)).toThrow(
      /only supported by the trading specification/,
    );
  });
});
