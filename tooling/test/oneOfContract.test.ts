import { describe, expect, it } from "vitest";
import {
  assertOneOfMergeContracts,
  OneOfMergeContractError,
} from "../src/oneOfContract.js";

const variants = [
  "CDIVActivityV2",
  "CGDActivityV2",
  "DIVSPDActivityV2",
].map(($ref) => ({ $ref: `#/components/schemas/${$ref}` }));

function document(
  mergeModels: unknown = [
    "CDIVActivityV2",
    "CGDActivityV2",
    "DIVSPDActivityV2",
  ],
): unknown {
  return {
    components: {
      schemas: {
        ActivityV2DetailNTA: {
          oneOf: variants,
          "x-ts-one-of-merge-models": mergeModels,
        },
      },
    },
  };
}

describe("structural oneOf merge contract", () => {
  it("accepts the explicit compatible trading activity group", () => {
    expect(() =>
      assertOneOfMergeContracts(document(), true),
    ).not.toThrow();
  });

  it("rejects stale candidate names", () => {
    expect(() =>
      assertOneOfMergeContracts(
        document([
          "CDIVActivityV2",
          "CGDActivityV2",
          "RemovedActivityV2",
        ]),
        true,
      ),
    ).toThrowError(OneOfMergeContractError);
  });

  it("rejects missing, reordered, or duplicate required candidates", () => {
    expect(() =>
      assertOneOfMergeContracts(
        document([
          "CGDActivityV2",
          "CDIVActivityV2",
          "DIVSPDActivityV2",
        ]),
        true,
      ),
    ).toThrowError(/must be/);
    expect(() =>
      assertOneOfMergeContracts(
        document([
          "CDIVActivityV2",
          "CDIVActivityV2",
          "DIVSPDActivityV2",
        ]),
        true,
      ),
    ).toThrowError(/unique/);
  });

  it("rejects merge markers outside the trading generator", () => {
    expect(() =>
      assertOneOfMergeContracts(document(), false),
    ).toThrowError(/only supported by the trading generator/);
  });

  it("accepts explicitly compatible array-item variants", () => {
    const value = document() as {
      components: { schemas: Record<string, unknown> };
    };
    value.components.schemas.ArrayUnion = {
      oneOf: [
        {
          type: "array",
          items: { $ref: "#/components/schemas/VariantA" },
        },
        {
          type: "array",
          items: { $ref: "#/components/schemas/VariantB" },
        },
      ],
      "x-ts-one-of-merge-models": ["VariantA", "VariantB"],
    };

    expect(() =>
      assertOneOfMergeContracts(value, true),
    ).not.toThrow();
  });
});
