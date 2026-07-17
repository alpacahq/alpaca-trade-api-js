import { describe, expect, it } from "vitest";
import { formatSummary, hasChanges, summarizeSpecDiff } from "../src/specDiff.js";

const base = {
  components: { schemas: { A: {}, B: {} } },
  paths: { "/x": { get: {} } },
};
const next = {
  components: { schemas: { A: { x: 1 }, C: {} } },
  paths: { "/x": { get: {} }, "/y": { post: {} } },
};

describe("summarizeSpecDiff", () => {
  it("counts schema and operation deltas", () => {
    const s = summarizeSpecDiff(base, next);
    expect(s.schemasAdded).toEqual(["C"]);
    expect(s.schemasRemoved).toEqual(["B"]);
    expect(s.schemasModified).toEqual(["A"]);
    expect(s.operationsAdded).toEqual(["POST /y"]);
    expect(s.operationsRemoved).toEqual([]);
  });

  it("reports no changes for identical specs", () => {
    const s = summarizeSpecDiff(base, base);
    expect(hasChanges(s)).toBe(false);
  });

  it("formats a coherent summary line", () => {
    const s = summarizeSpecDiff(base, next);
    expect(formatSummary(s)).toContain("schemas: +1 -1 ~1; operations: +1 -0");
  });

  it("flags an operation whose first tag moved to a different Api (the clock retag)", () => {
    const before = { paths: { "/v3/clock": { get: { tags: ["Calendar"], operationId: "clock" } } } };
    const after = { paths: { "/v3/clock": { get: { tags: ["Clock"], operationId: "clock" } } } };
    const s = summarizeSpecDiff(before, after);
    expect(s.operationsMoved).toEqual(['GET /v3/clock: "Calendar" -> "Clock"']);
    expect(s.operationsRenamed).toEqual([]);
    expect(hasChanges(s)).toBe(true);
    expect(formatSummary(s)).toContain("operations moved");
  });

  it("flags an operationId rename (generated method name change)", () => {
    const before = { paths: { "/v2/x": { get: { tags: ["X"], operationId: "getX" } } } };
    const after = { paths: { "/v2/x": { get: { tags: ["X"], operationId: "fetchX" } } } };
    const s = summarizeSpecDiff(before, after);
    expect(s.operationsRenamed).toEqual(['GET /v2/x: "getX" -> "fetchX"']);
    expect(s.operationsMoved).toEqual([]);
  });
});
