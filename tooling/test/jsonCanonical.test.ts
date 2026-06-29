import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/jsonCanonical.js";

describe("canonicalize", () => {
  it("sorts keys recursively and uses 2-space indent + trailing newline", () => {
    const out = canonicalize({ b: 1, a: { d: 2, c: 3 } });
    expect(out).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  });

  it("does not reorder array element order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[\n  3,\n  1,\n  2\n]\n");
  });

  it("is stable across differently-ordered but equal objects", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });
});
