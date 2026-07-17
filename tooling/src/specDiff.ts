import { canonicalize } from "./jsonCanonical.js";

export interface SpecDiffSummary {
  schemasAdded: string[];
  schemasRemoved: string[];
  schemasModified: string[];
  operationsAdded: string[];
  operationsRemoved: string[];
  /**
   * Operations present in both specs whose first tag changed. typescript-fetch
   * groups operations into `<Tag>Api` classes by first tag, so a tag change
   * relocates the generated method to a different Api — and the hand-written
   * facade accessor that wrapped the old Api silently loses it (this is what the
   * clock retag did: `Calendar` -> `Clock`). Format: `METHOD path: "old" -> "new"`.
   */
  operationsMoved: string[];
  /**
   * Operations present in both specs whose `operationId` changed. The generated
   * method name derives from `operationId`, so this renames the facade method.
   * Format: `METHOD path: "oldId" -> "newId"`.
   */
  operationsRenamed: string[];
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

type AnySpec = {
  components?: { schemas?: Record<string, unknown> };
  paths?: Record<string, Record<string, unknown>>;
};

interface OperationInfo {
  tag?: string;
  operationId?: string;
}

function schemas(spec: AnySpec): Record<string, unknown> {
  return spec.components?.schemas ?? {};
}

function operations(spec: AnySpec): Set<string> {
  const ops = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      if (method in item) ops.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return ops;
}

/** Map each `METHOD path` to its first tag + operationId (the generator inputs
 * that determine the generated Api class and method name). */
function operationDetails(spec: AnySpec): Map<string, OperationInfo> {
  const out = new Map<string, OperationInfo>();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = (item as Record<string, unknown>)[method];
      if (!op || typeof op !== "object") continue;
      const o = op as { tags?: unknown; operationId?: unknown };
      const tag =
        Array.isArray(o.tags) && typeof o.tags[0] === "string" ? o.tags[0] : undefined;
      const operationId = typeof o.operationId === "string" ? o.operationId : undefined;
      out.set(`${method.toUpperCase()} ${path}`, { tag, operationId });
    }
  }
  return out;
}

/** Compute added/removed/modified schemas + added/removed operations. */
export function summarizeSpecDiff(base: unknown, next: unknown): SpecDiffSummary {
  const baseSchemas = schemas(base as AnySpec);
  const nextSchemas = schemas(next as AnySpec);
  const baseKeys = new Set(Object.keys(baseSchemas));
  const nextKeys = new Set(Object.keys(nextSchemas));

  const schemasAdded = [...nextKeys].filter((k) => !baseKeys.has(k)).sort();
  const schemasRemoved = [...baseKeys].filter((k) => !nextKeys.has(k)).sort();
  const schemasModified = [...nextKeys]
    .filter((k) => baseKeys.has(k))
    .filter((k) => canonicalize(baseSchemas[k]) !== canonicalize(nextSchemas[k]))
    .sort();

  const baseOps = operations(base as AnySpec);
  const nextOps = operations(next as AnySpec);
  const operationsAdded = [...nextOps].filter((o) => !baseOps.has(o)).sort();
  const operationsRemoved = [...baseOps].filter((o) => !nextOps.has(o)).sort();

  const baseDetails = operationDetails(base as AnySpec);
  const nextDetails = operationDetails(next as AnySpec);
  const operationsMoved: string[] = [];
  const operationsRenamed: string[] = [];
  for (const [key, nextInfo] of nextDetails) {
    const baseInfo = baseDetails.get(key);
    if (!baseInfo) continue; // newly added operation, not a move/rename
    if ((baseInfo.tag ?? "") !== (nextInfo.tag ?? "")) {
      operationsMoved.push(
        `${key}: "${baseInfo.tag ?? "(none)"}" -> "${nextInfo.tag ?? "(none)"}"`,
      );
    }
    if ((baseInfo.operationId ?? "") !== (nextInfo.operationId ?? "")) {
      operationsRenamed.push(
        `${key}: "${baseInfo.operationId ?? "(none)"}" -> "${nextInfo.operationId ?? "(none)"}"`,
      );
    }
  }
  operationsMoved.sort();
  operationsRenamed.sort();

  return {
    schemasAdded,
    schemasRemoved,
    schemasModified,
    operationsAdded,
    operationsRemoved,
    operationsMoved,
    operationsRenamed,
  };
}

/** Human-readable one-paragraph summary for the console gate. */
export function formatSummary(s: SpecDiffSummary): string {
  const counts =
    `schemas: +${s.schemasAdded.length} -${s.schemasRemoved.length} ~${s.schemasModified.length}; ` +
    `operations: +${s.operationsAdded.length} -${s.operationsRemoved.length}`;
  const lines = [counts];
  const detail = (label: string, items: string[]) => {
    if (items.length) lines.push(`  ${label}: ${items.join(", ")}`);
  };
  detail("schemas added", s.schemasAdded);
  detail("schemas removed", s.schemasRemoved);
  detail("schemas modified", s.schemasModified);
  detail("operations added", s.operationsAdded);
  detail("operations removed", s.operationsRemoved);
  detail("operations moved (Api change — facade rewiring likely)", s.operationsMoved);
  detail("operations renamed (method name change — facade rewiring likely)", s.operationsRenamed);
  return lines.join("\n");
}

export function hasChanges(s: SpecDiffSummary): boolean {
  return (
    s.schemasAdded.length > 0 ||
    s.schemasRemoved.length > 0 ||
    s.schemasModified.length > 0 ||
    s.operationsAdded.length > 0 ||
    s.operationsRemoved.length > 0 ||
    s.operationsMoved.length > 0 ||
    s.operationsRenamed.length > 0
  );
}
