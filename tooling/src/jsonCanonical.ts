/**
 * Deterministic JSON serialization for OpenAPI specs: keys sorted recursively,
 * 2-space indent, trailing newline. Array element order is preserved (order is
 * semantically meaningful in OpenAPI, e.g. parameter lists). Canonicalizing
 * both the pinned and freshly fetched specs makes the spec diff reflect real
 * surface changes instead of upstream key-ordering / formatting churn.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
