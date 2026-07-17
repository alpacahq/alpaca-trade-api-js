/**
 * Compute committed generated files that should be deleted after a regeneration
 * because the upstream spec no longer produces them (e.g. a schema was removed).
 *
 * openapi-generator does NOT delete stale outputs on its own, so without this a
 * removed model/api file would linger as an orphan and pollute the empty-diff
 * check. We only ever consider files under `apis/` or `models/`, and never
 * touch protected paths (the `.openapi-generator-ignore`d `runtime.ts`, etc.).
 */
export interface StaleCleanOptions {
  protect: string[];
}

export function filesToDelete(
  present: string[],
  manifest: string[],
  opts: StaleCleanOptions,
): string[] {
  const keep = new Set(manifest);
  const protect = new Set(opts.protect);
  return present.filter(
    (f) =>
      (f.startsWith("apis/") || f.startsWith("models/")) && !protect.has(f) && !keep.has(f),
  );
}
