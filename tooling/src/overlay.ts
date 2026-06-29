import fastJsonPatch, { type Operation } from "fast-json-patch";

const { applyOperation } = fastJsonPatch;

/**
 * Raised when an overlay operation cannot be applied because its target path no
 * longer exists in the (possibly refreshed) upstream spec. This is the
 * "overlay drift" failure mode: a customization we relocated out of hand-edited
 * generated files into a declarative JSON Patch has gone stale and must be
 * updated before regeneration can proceed.
 */
export class OverlayDriftError extends Error {
  readonly op: Operation;
  constructor(message: string, op: Operation) {
    super(message);
    this.name = "OverlayDriftError";
    this.op = op;
  }
}

/**
 * Apply a JSON Patch overlay to a parsed OpenAPI spec, returning a new document
 * (the input is not mutated). Each operation is validated; a failure is
 * rethrown as an {@link OverlayDriftError} naming the offending op + path.
 */
export function applyOverlay(spec: unknown, patch: Operation[]): unknown {
  let doc = structuredClone(spec);
  for (const op of patch) {
    try {
      doc = applyOperation(doc, op, true).newDocument;
    } catch (err) {
      const path = "path" in op ? op.path : "(no path)";
      throw new OverlayDriftError(
        `overlay drift: failed to apply "${op.op} ${path}": ${(err as Error).message}`,
        op,
      );
    }
  }
  return doc;
}
