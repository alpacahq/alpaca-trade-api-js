import { describe, expect, it } from "vitest";
import { diffExports, parseExports } from "../src/exportsSnapshot.js";

describe("exports snapshot", () => {
  it("normalizes star and named re-exports from a generator barrel", () => {
    const src = [
      "export * from './models/Account';",
      "export { Order, OrderSide as Side } from './models/Order';",
      "export type { Position, Position as OpenPosition } from './models/Position';",
      "export { type Asset, Exchange } from './models/Asset';",
    ].join("\n");

    expect(parseExports(src)).toEqual([
      "module:./models/Account",
      "symbol:./models/Asset#Exchange",
      "symbol:./models/Order#Order",
      "symbol:./models/Order#OrderSide->Side",
      "type-symbol:./models/Asset#Asset",
      "type-symbol:./models/Position#Position",
      "type-symbol:./models/Position#Position->OpenPosition",
    ]);
  });

  it("ignores local exports while retaining multiline named re-exports", () => {
    const src = [
      "import x from './y';",
      "export { local };",
      "export {",
      "  Foo,",
      "  Bar as PublicBar,",
      "} from './models/A';",
    ].join("\n");

    expect(parseExports(src)).toEqual([
      "symbol:./models/A#Bar->PublicBar",
      "symbol:./models/A#Foo",
    ]);
  });

  it("reports removed module and symbol identities", () => {
    const d = diffExports(
      ["module:./models/A", "symbol:./models/B#Old", "type-symbol:./models/C#Type"],
      ["module:./models/A", "symbol:./models/B#New"],
    );
    expect(d.removed).toEqual([
      "symbol:./models/B#Old",
      "type-symbol:./models/C#Type",
    ]);
    expect(d.added).toEqual(["symbol:./models/B#New"]);
  });
});
