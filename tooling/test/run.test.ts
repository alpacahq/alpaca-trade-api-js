import { describe, expect, it } from "vitest";
import {
  assertBreakingSpecRemovalsAllowed,
  HAND_WRITTEN_RISK_SURFACES,
  projectOrphanRisks,
  type GenerateOptions,
} from "../src/run.js";
import type { SpecDiffSummary } from "../src/specDiff.js";

const options = (overrides: Partial<GenerateOptions> = {}): GenerateOptions => ({
  offline: false,
  yes: true,
  dryRun: false,
  allowBreakingSpecRemovals: false,
  ...overrides,
});

const summary = (overrides: Partial<SpecDiffSummary> = {}): SpecDiffSummary => ({
  schemasAdded: [],
  schemasRemoved: [],
  schemasModified: [],
  operationsAdded: [],
  operationsRemoved: [],
  operationsMoved: [],
  operationsRenamed: [],
  ...overrides,
});

describe("breaking spec removal gate", () => {
  it("allows non-interactive additive adoption", () => {
    expect(() =>
      assertBreakingSpecRemovalsAllowed(
        summary({ schemasAdded: ["NewModel"], operationsAdded: ["GET /v2/new"] }),
        options(),
      ),
    ).not.toThrow();
  });

  it("blocks non-interactive adoption containing removals", () => {
    expect(() =>
      assertBreakingSpecRemovalsAllowed(
        [
          summary({ schemasAdded: ["SafeFirstTarget"] }),
          summary({
            schemasRemoved: ["OldModel"],
            operationsRemoved: ["DELETE /v2/old"],
          }),
        ],
        options(),
      ),
    ).toThrowError(
      /--allow-breaking-spec-removals.*OldModel.*DELETE \/v2\/old/s,
    );
  });

  it("allows non-interactive breaking adoption with the explicit override", () => {
    expect(() =>
      assertBreakingSpecRemovalsAllowed(
        summary({ schemasRemoved: ["OldModel"] }),
        options({ allowBreakingSpecRemovals: true }),
      ),
    ).not.toThrow();
  });

  it("allows write-free dry-run previews without the override", () => {
    expect(() =>
      assertBreakingSpecRemovalsAllowed(
        summary({ operationsRemoved: ["GET /v2/old"] }),
        options({ dryRun: true }),
      ),
    ).not.toThrow();
  });
});

describe("orphan risk reporting", () => {
  it("projects dry-run risks from removed schemas and operations", () => {
    expect(
      projectOrphanRisks(
        "trading",
        summary({
          schemasRemoved: ["OldModel"],
          operationsRemoved: ["DELETE /v2/old"],
        }),
      ),
    ).toEqual([
      "projected-schema:trading#OldModel",
      "projected-operation:trading#DELETE /v2/old",
    ]);
  });

  it("names every hand-written risk surface", () => {
    expect(HAND_WRITTEN_RISK_SURFACES).toEqual([
      "src/client.ts",
      "src/orders.ts",
      "src/marketDataShapes.ts",
      "src/capabilities.ts",
      "src/streaming/",
      "src/index.ts",
      "src/rest.ts",
      "scripts/api-reference/examples.ts",
    ]);
  });
});
