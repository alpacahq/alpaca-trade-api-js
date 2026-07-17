import { pathToFileURL } from "node:url";

import { type GenerateOptions, runGenerate, type Target } from "./run.js";

function printHelp(): void {
  console.log(`Alpaca SDK OpenAPI regeneration pipeline

Usage: npm run generate [-- <options>]

Options:
  --offline            Skip fetching live specs; regenerate from pinned specs.
  --target <name>      Limit to one target: "trading" or "market-data".
  -y, --yes            Auto-adopt fetched spec changes without prompting.
  --allow-breaking-spec-removals
                       Allow --yes to adopt removed schemas/operations.
  --dry-run            Do everything except write specs / generate / delete / gate.
  -h, --help           Show this help.
`);
}

export function parseArgs(argv: string[]): GenerateOptions {
  const opts: GenerateOptions = {
    offline: false,
    yes: false,
    dryRun: false,
    allowBreakingSpecRemovals: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") opts.offline = true;
    else if (a === "-y" || a === "--yes") opts.yes = true;
    else if (a === "--allow-breaking-spec-removals") {
      opts.allowBreakingSpecRemovals = true;
    } else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a === "--target") {
      const value = argv[++i];
      if (!value) {
        console.error('Missing value for --target (expected "trading" or "market-data").');
        printHelp();
        process.exit(2);
      }
      opts.target = value as Target;
    } else if (a.startsWith("--target=")) {
      const value = a.slice("--target=".length);
      if (!value) {
        console.error('Missing value for --target (expected "trading" or "market-data").');
        printHelp();
        process.exit(2);
      }
      opts.target = value as Target;
    } else {
      console.error(`Unknown argument: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  if (opts.target && opts.target !== "trading" && opts.target !== "market-data") {
    console.error(`Invalid --target "${opts.target}" (expected "trading" or "market-data").`);
    process.exit(2);
  }
  return opts;
}

async function main(): Promise<void> {
  try {
    await runGenerate(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
