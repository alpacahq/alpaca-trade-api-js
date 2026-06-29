/**
 * Parse a generated barrel (`apis/index.ts` or `models/index.ts`) into the list
 * of re-exported module specifiers, and diff two snapshots. A removed export
 * after a spec refresh means a generated symbol disappeared — the signal that a
 * hand-written reference in client.ts/orders.ts/marketDataShapes.ts may now be
 * orphaned (the facade alone references ~82 generated symbols).
 */
const RE_EXPORT = /export\s+\*\s+from\s+['"](.+?)['"]/g;

export function parseExports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(RE_EXPORT)) out.push(m[1]);
  return out;
}

export interface ExportsDiff {
  added: string[];
  removed: string[];
}

export function diffExports(before: string[], after: string[]): ExportsDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((x) => !beforeSet.has(x)).sort(),
    removed: before.filter((x) => !afterSet.has(x)).sort(),
  };
}
