import { afterEach, describe, expect, it, vi } from "vitest";
import { parseArgs } from "../src/cli.js";

function expectCliError(argv: string[], message: string): void {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`exit:${code}`);
  });

  expect(() => parseArgs(argv)).toThrow("exit:2");
  expect(exit).toHaveBeenCalledWith(2);
  expect(error).toHaveBeenCalledWith(message);
}

describe("CLI arguments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults the breaking-removal override off", () => {
    expect(parseArgs([])).toMatchObject({
      offline: false,
      yes: false,
      dryRun: false,
      allowBreakingSpecRemovals: false,
    });
  });

  it("parses the explicit breaking-removal override", () => {
    expect(parseArgs(["--yes", "--allow-breaking-spec-removals"])).toMatchObject({
      yes: true,
      allowBreakingSpecRemovals: true,
    });
  });

  it("parses valid non-empty target values", () => {
    expect(parseArgs(["--target", "trading"]).target).toBe("trading");
    expect(parseArgs(["--target=market-data"]).target).toBe("market-data");
  });

  it("preserves rejection of invalid non-empty target values", () => {
    expectCliError(
      ["--target=equities"],
      'Invalid --target "equities" (expected "trading" or "market-data").',
    );
  });

  it("rejects --target when it is the last argument", () => {
    expectCliError(
      ["--target"],
      'Missing value for --target (expected "trading" or "market-data").',
    );
  });

  it("rejects an empty --target= value", () => {
    expectCliError(
      ["--target="],
      'Missing value for --target (expected "trading" or "market-data").',
    );
  });
});
