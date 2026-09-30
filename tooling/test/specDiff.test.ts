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
    expect(s.documentModified).toBe(true);
  });

  it("reports no changes for identical specs", () => {
    const s = summarizeSpecDiff(base, base);
    expect(hasChanges(s)).toBe(false);
  });

  it("formats a coherent summary line", () => {
    const s = summarizeSpecDiff(base, next);
    expect(formatSummary(s)).toContain(
      "schemas: +1 -1 ~1; operations: +1 -0 ~0; document: modified",
    );
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

  it("detects in-place operation contract changes", () => {
    const before = {
      paths: {
        "/events": {
          get: {
            tags: ["Events"],
            operationId: "events",
            security: [{ apiKey: [] }],
          },
        },
      },
    };
    const after = {
      paths: {
        "/events": {
          get: {
            tags: ["Events"],
            operationId: "events",
            security: [{ oauth2: [] }],
          },
        },
      },
    };

    const s = summarizeSpecDiff(before, after);

    expect(s.operationsModified).toEqual(["GET /events"]);
    expect(hasChanges(s)).toBe(true);
  });

  it("detects document changes outside schemas and operations", () => {
    const before = {
      components: {
        schemas: {},
        securitySchemes: {
          apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        },
      },
      paths: {},
    };
    const after = structuredClone(before);
    after.components.securitySchemes.apiKey.name = "Authorization";

    const s = summarizeSpecDiff(before, after);

    expect(s.operationsModified).toEqual([]);
    expect(s.documentModified).toBe(true);
    expect(hasChanges(s)).toBe(true);
  });
});
