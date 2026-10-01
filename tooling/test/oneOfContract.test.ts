import { describe, expect, it } from "vitest";
import {
  assertOneOfMergeContracts,
  oneOfShapeFingerprint,
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
        CommonActivity: {
          type: "object",
          properties: {
            system_date: { type: "string", format: "date" },
          },
          required: ["system_date"],
        },
        CDIVActivityV2: {
          allOf: [
            { $ref: "#/components/schemas/CommonActivity" },
            {
              type: "object",
              properties: { cash_payout: { type: "string" } },
              required: ["cash_payout"],
            },
          ],
        },
        CGDActivityV2: {
          allOf: [
            { $ref: "#/components/schemas/CommonActivity" },
            {
              type: "object",
              properties: { rate: { type: "string" } },
              required: ["rate"],
            },
          ],
        },
        DIVSPDActivityV2: {
          allOf: [
            { $ref: "#/components/schemas/CommonActivity" },
            {
              type: "object",
              properties: {
                foreign: {
                  type: "string",
                  enum: ["true", "false"],
                },
              },
              required: ["foreign"],
            },
          ],
        },
        ActivityV2DetailNTA: {
          oneOf: variants,
          "x-ts-one-of-merge-models": mergeModels,
        },
      },
    },
  };
}

const baseline = document() as {
  components: { schemas: Record<string, unknown> };
};
const reviewedFingerprints = new Map(
  ["CDIVActivityV2", "CGDActivityV2", "DIVSPDActivityV2"].map(
    (name) => [
      name,
      oneOfShapeFingerprint(baseline.components.schemas, name),
    ],
  ),
);
const assertContract = (
  value: unknown,
  trading: boolean,
): void =>
  assertOneOfMergeContracts(value, trading, reviewedFingerprints);

describe("structural oneOf merge contract", () => {
  it("accepts the explicit compatible trading activity group", () => {
    expect(() =>
      assertContract(document(), true),
    ).not.toThrow();
  });

  it("rejects stale candidate names", () => {
    expect(() =>
      assertContract(
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
      assertContract(
        document([
          "CGDActivityV2",
          "CDIVActivityV2",
          "DIVSPDActivityV2",
        ]),
        true,
      ),
    ).toThrowError(/must be/);
    expect(() =>
      assertContract(
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
      assertContract(document(), false),
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
      assertContract(value, true),
    ).not.toThrow();
  });

  it.each([
    [
      "property",
      (schemas: Record<string, any>) => {
        schemas.CDIVActivityV2.allOf[1].properties.extra = {
          type: "string",
        };
      },
    ],
    [
      "property type",
      (schemas: Record<string, any>) => {
        schemas.CDIVActivityV2.allOf[1].properties.cash_payout.type =
          "number";
      },
    ],
    [
      "required set",
      (schemas: Record<string, any>) => {
        schemas.CDIVActivityV2.allOf[1].required = [];
      },
    ],
    [
      "transitive reference",
      (schemas: Record<string, any>) => {
        schemas.OtherCommonActivity = structuredClone(
          schemas.CommonActivity,
        );
        schemas.CDIVActivityV2.allOf[0].$ref =
          "#/components/schemas/OtherCommonActivity";
      },
    ],
  ])("rejects reviewed candidate %s drift", (_label, mutate) => {
    const value = structuredClone(document()) as {
      components: { schemas: Record<string, any> };
    };
    mutate(value.components.schemas);

    expect(() => assertContract(value, true)).toThrowError(
      /candidate CDIVActivityV2 shape drifted/,
    );
  });
});
