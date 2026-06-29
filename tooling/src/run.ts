import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import type { Operation } from "fast-json-patch";

import { ensureJavaOnPath } from "./env.js";
import { diffExports, parseExports } from "./exportsSnapshot.js";
import { fetchSpec, SPEC_FILES } from "./fetchSpecs.js";
import { canonicalize } from "./jsonCanonical.js";
import { applyOverlay } from "./overlay.js";
import { capture, run } from "./proc.js";
import { formatSummary, hasChanges, summarizeSpecDiff } from "./specDiff.js";
import { filesToDelete } from "./staleClean.js";

export type Target = "trading" | "market-data";
const ALL_TARGETS: Target[] = ["trading", "market-data"];

/** Generator config per target — a fixed lookup so no target value is ever
 * string-interpolated into a spawned command line. */
const CONFIG_FILE: Record<Target, string> = {
  trading: "config/trading.yaml",
  "market-data": "config/market-data.yaml",
};

/** Allowlist guard: narrow an untrusted value to a known Target or throw. */
function assertTarget(target: unknown): Target {
  if (target !== "trading" && target !== "market-data") {
    throw new Error(`Invalid target: ${JSON.stringify(target)}`);
  }
  return target;
}

/** Validate a freshly fetched spec is a plausible OpenAPI document before it is
 * trusted enough to be written to the pinned-specs directory. */
function assertOpenApiDoc(doc: unknown, file: string): asserts doc is Record<string, unknown> {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error(`Fetched ${file} is not a JSON object`);
  }
  const d = doc as Record<string, unknown>;
  if (typeof d.openapi !== "string" && typeof d.swagger !== "string") {
    throw new Error(`Fetched ${file} is missing an "openapi"/"swagger" version field`);
  }
  if (!d.paths || typeof d.paths !== "object") {
    throw new Error(`Fetched ${file} is missing a "paths" object`);
  }
}

export interface GenerateOptions {
  offline: boolean;
  yes: boolean;
  dryRun: boolean;
  target?: Target;
}

// The CLI is launched from the tooling package root (npm script cwd).
const TOOLING_ROOT = process.cwd();
const REPO_ROOT = path.resolve(TOOLING_ROOT, "..");

const specPath = (target: Target) => path.join(TOOLING_ROOT, "specs", SPEC_FILES[target]);
const overlayPath = (target: Target) => path.join(TOOLING_ROOT, "overlays", `${target}.patch.json`);
const derivedPath = (target: Target) =>
  path.join(TOOLING_ROOT, ".work", "derived", SPEC_FILES[target]);
const treeDir = (target: Target) => path.join(REPO_ROOT, "src", target);

function log(msg: string): void {
  console.log(msg);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

/** Step 1: ensure the pinned generator jar + a working JDK. */
function ensureToolchain(): void {
  log("• Ensuring generator jar + JDK ...");
  run("bash", ["scripts/ensure-jar.sh"], { cwd: TOOLING_ROOT });
  ensureJavaOnPath();
}

/** Steps 2-5: fetch latest specs, diff vs pinned, prompt, adopt. */
async function refreshSpecs(targets: Target[], opts: GenerateOptions): Promise<void> {
  if (opts.offline) {
    log("• Offline: skipping spec fetch/diff; using pinned specs.");
    return;
  }
  for (const target of targets) {
    assertTarget(target);
    const file = SPEC_FILES[target];
    log(`• Fetching latest ${file} ...`);
    const live = await fetchSpec(file);
    assertOpenApiDoc(live, file);
    const pinned = readJson(specPath(target));
    const summary = summarizeSpecDiff(pinned, live);

    if (!hasChanges(summary)) {
      log(`  ${target}: no spec changes vs pinned.`);
      continue;
    }
    log(`  ${target} spec changes:\n${formatSummary(summary)}`);

    const adopt = opts.yes || (await confirm(`  Adopt the new ${file} as the pinned baseline?`));
    if (!adopt) {
      log(`  Keeping pinned ${file} (declined).`);
      continue;
    }
    if (opts.dryRun) {
      log(`  [dry-run] would overwrite ${specPath(target)}`);
    } else {
      fs.writeFileSync(specPath(target), canonicalize(live));
      log(`  Adopted new ${file}.`);
    }
  }
}

/** Step 6: pinned spec + overlay -> derived input the generator consumes. */
function deriveSpec(target: Target): void {
  const spec = readJson(specPath(target));
  const patch = readJson(overlayPath(target)) as Operation[];
  const derived = applyOverlay(spec, patch); // throws OverlayDriftError on stale path
  fs.mkdirSync(path.dirname(derivedPath(target)), { recursive: true });
  fs.writeFileSync(derivedPath(target), `${JSON.stringify(derived, null, 2)}\n`);
}

function listTreeFiles(target: Target): string[] {
  const root = treeDir(target);
  const out: string[] = [];
  for (const sub of ["apis", "models"]) {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".ts")) out.push(`${sub}/${name}`);
    }
  }
  return out;
}

function readManifest(target: Target): string[] {
  const file = path.join(treeDir(target), ".openapi-generator", "FILES");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function readBarrelExports(target: Target, sub: "apis" | "models"): string[] {
  const file = path.join(treeDir(target), sub, "index.ts");
  if (!fs.existsSync(file)) return [];
  return parseExports(fs.readFileSync(file, "utf8"));
}

/** Steps 6-8: derive, generate, clean stale files; returns the orphan report. */
function generateTarget(target: Target, opts: GenerateOptions): { removedExports: string[] } {
  assertTarget(target);
  log(`• Generating ${target} ...`);
  const before = {
    apis: readBarrelExports(target, "apis"),
    models: readBarrelExports(target, "models"),
  };

  deriveSpec(target);

  if (opts.dryRun) {
    log(`  [dry-run] would run openapi-generator for ${target}`);
    return { removedExports: [] };
  }

  run("npx", ["openapi-generator-cli", "generate", "-c", CONFIG_FILE[target]], {
    cwd: TOOLING_ROOT,
  });

  // Stale-file cleanup: delete apis/models files no longer in the new manifest.
  const stale = filesToDelete(listTreeFiles(target), readManifest(target), {
    protect: ["runtime.ts"],
  });
  for (const rel of stale) {
    fs.rmSync(path.join(treeDir(target), rel));
    log(`  removed stale ${target}/${rel}`);
  }

  const after = {
    apis: readBarrelExports(target, "apis"),
    models: readBarrelExports(target, "models"),
  };
  const removedExports = [
    ...diffExports(before.apis, after.apis).removed,
    ...diffExports(before.models, after.models).removed,
  ];
  return { removedExports };
}

/** Step 9: typecheck + lint + test + docs + orphan report. */
function safetyGate(removedExports: string[], opts: GenerateOptions): void {
  log("• Safety gate ...");
  if (opts.dryRun) {
    log("  [dry-run] skipping typecheck/lint/test/docs.");
  } else {
    run("npm", ["--prefix", REPO_ROOT, "run", "typecheck"]);
    run("npm", ["--prefix", REPO_ROOT, "run", "lint"]);
    run("npm", ["--prefix", REPO_ROOT, "test"]);
    run("npm", ["--prefix", REPO_ROOT, "run", "docs:api"]);
    run("npm", ["--prefix", TOOLING_ROOT, "run", "typecheck"]);
    run("npm", ["--prefix", TOOLING_ROOT, "test"]);
  }

  if (removedExports.length > 0) {
    log("\n⚠️  ORPHAN RISK — generated exports removed by this regeneration:");
    for (const e of removedExports) log(`    - ${e}`);
    log("  Check hand-written references (client.ts, orders.ts, marketDataShapes.ts).");
  } else {
    log("  No generated exports were removed.");
  }
}

function printTreeStatus(targets: Target[]): void {
  const rel = targets.map((t) => `src/${t}`);
  const out = capture("git", ["status", "--porcelain", ...rel], { cwd: REPO_ROOT });
  log("\n• Generated-tree changes (git status):");
  log(out && out.length > 0 ? out : "  (none)");
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  const targets = opts.target ? [assertTarget(opts.target)] : ALL_TARGETS;
  log(
    `Alpaca SDK regeneration — targets: ${targets.join(", ")}` +
      `${opts.offline ? " [offline]" : ""}${opts.dryRun ? " [dry-run]" : ""}`,
  );

  ensureToolchain();
  await refreshSpecs(targets, opts);

  const removedExports: string[] = [];
  for (const target of targets) {
    removedExports.push(...generateTarget(target, opts).removedExports);
  }

  safetyGate(removedExports, opts);
  printTreeStatus(targets);
  log("\nDone.");
}
