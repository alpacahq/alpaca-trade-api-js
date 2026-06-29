import { describe, expect, it } from "vitest";
import { diffExports, parseExports } from "../src/exportsSnapshot.js";

describe("exports snapshot", () => {
  it("parses re-exported module specifiers from a barrel", () => {
    const src = "export * from './models/Account';\nexport * from './models/Order';\n";
    expect(parseExports(src)).toEqual(["./models/Account", "./models/Order"]);
  });

  it("ignores non re-export lines", () => {
    const src = "import x from './y';\nexport { foo } from './z';\nexport * from './models/A';\n";
    expect(parseExports(src)).toEqual(["./models/A"]);
  });

  it("reports removed and added exports", () => {
    const d = diffExports(["a", "b"], ["a", "c"]);
    expect(d.removed).toEqual(["b"]);
    expect(d.added).toEqual(["c"]);
  });
});
