import { type GenerateOptions, runGenerate, type Target } from "./run.js";

function printHelp(): void {
  console.log(`Alpaca SDK OpenAPI regeneration pipeline

Usage: npm run generate [-- <options>]

Options:
  --offline            Skip fetching live specs; regenerate from pinned specs.
  --target <name>      Limit to one target: "trading" or "market-data".
  -y, --yes            Auto-adopt fetched spec changes without prompting.
  --dry-run            Do everything except write specs / generate / delete / gate.
  -h, --help           Show this help.
`);
}

function parseArgs(argv: string[]): GenerateOptions {
  const opts: GenerateOptions = { offline: false, yes: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") opts.offline = true;
    else if (a === "-y" || a === "--yes") opts.yes = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a === "--target") {
      opts.target = argv[++i] as Target;
    } else if (a.startsWith("--target=")) {
      opts.target = a.slice("--target=".length) as Target;
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

runGenerate(parseArgs(process.argv.slice(2))).catch((err: unknown) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
