import { describe, expect, it } from "vitest";
import { filesToDelete } from "../src/staleClean.js";

describe("filesToDelete", () => {
  it("returns committed generated files absent from the new FILES manifest", () => {
    const present = ["models/Account.ts", "models/Old.ts", "apis/OrdersApi.ts", "runtime.ts"];
    const manifest = ["models/Account.ts", "apis/OrdersApi.ts"];
    expect(filesToDelete(present, manifest, { protect: ["runtime.ts"] })).toEqual([
      "models/Old.ts",
    ]);
  });

  it("never deletes protected or non-apis/models files", () => {
    const present = [".openapi-generator-ignore", "runtime.ts", "index.ts", "models/Keep.ts"];
    expect(filesToDelete(present, ["models/Keep.ts"], { protect: ["runtime.ts"] })).toEqual([]);
  });

  it("deletes a removed api file", () => {
    expect(
      filesToDelete(["apis/GoneApi.ts", "apis/StayApi.ts"], ["apis/StayApi.ts"], { protect: [] }),
    ).toEqual(["apis/GoneApi.ts"]);
  });
});
