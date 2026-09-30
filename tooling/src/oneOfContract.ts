import { createHash } from "node:crypto";

const EXTENSION = "x-ts-one-of-merge-models";
const REQUIRED_TRADING_GROUPS = new Map([
  [
    "ActivityV2DetailNTA",
    ["CDIVActivityV2", "CGDActivityV2", "DIVSPDActivityV2"],
  ],
]);
const REVIEWED_TRADING_SHAPE_FINGERPRINTS = new Map([
  [
    "CDIVActivityV2",
    "0403b5bf5d863ffe9b46d16b4591f01ab7a7878e3eebe00673fe79776317ede1",
  ],
  [
    "CGDActivityV2",
    "084f9b94663fba778485e62b0db3b6a768261dbda76f8601d8a5eef41d6b304e",
  ],
  [
    "DIVSPDActivityV2",
    "98594f0bee968cdfa40d83849fe9884d219a59f9e02db27123a587f94db845aa",
  ],
]);

export class OneOfMergeContractError extends Error {
  override name = "OneOfMergeContractError";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function referencedModel(value: unknown): string | undefined {
  const schema = asRecord(value);
  const ref =
    schema?.$ref ?? asRecord(schema?.items)?.$ref;
  if (typeof ref !== "string") return undefined;
  const segment = ref.split("/").at(-1);
  return segment ? decodeURIComponent(segment) : undefined;
}

function propertyShape(value: unknown): Record<string, unknown> {
  const schema = asRecord(value) ?? {};
  const shape: Record<string, unknown> = {};
  for (const key of ["type", "format", "nullable"] as const) {
    if (schema[key] !== undefined) shape[key] = schema[key];
  }
  if (Array.isArray(schema.enum)) shape.enum = [...schema.enum];
  const ref = referencedModel(schema);
  if (ref) shape.ref = ref;
  const items = asRecord(schema.items);
  if (items) shape.items = propertyShape(items);
  return shape;
}

export function oneOfShapeFingerprint(
  schemas: Record<string, unknown>,
  modelName: string,
): string {
  const references = new Set<string>();
  const required = new Set<string>();
  const properties = new Map<string, Set<string>>();
  const visited = new Set<string>();

  const visit = (rawSchema: unknown, context: string): void => {
    const schema = asRecord(rawSchema);
    if (!schema) {
      throw new OneOfMergeContractError(
        `${modelName} shape fingerprint encountered invalid schema at ${context}`,
      );
    }
    if (typeof schema.$ref === "string") {
      const ref = referencedModel(schema);
      if (!ref || schemas[ref] === undefined) {
        throw new OneOfMergeContractError(
          `${modelName} shape fingerprint has unresolved reference ${String(schema.$ref)}`,
        );
      }
      references.add(ref);
      if (visited.has(ref)) return;
      visited.add(ref);
      visit(schemas[ref], ref);
      return;
    }
    if (Array.isArray(schema.allOf)) {
      schema.allOf.forEach((part, index) =>
        visit(part, `${context}.allOf[${index}]`),
      );
    }
    for (const name of Array.isArray(schema.required)
      ? schema.required
      : []) {
      if (typeof name === "string") required.add(name);
    }
    for (const [name, property] of Object.entries(
      asRecord(schema.properties) ?? {},
    )) {
      const serialized = JSON.stringify(propertyShape(property));
      let variants = properties.get(name);
      if (!variants) {
        variants = new Set();
        properties.set(name, variants);
      }
      variants.add(serialized);
    }
  };

  visit(schemas[modelName], modelName);
  const canonical = JSON.stringify({
    references: [...references].sort(),
    required: [...required].sort(),
    properties: Object.fromEntries(
      [...properties.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, variants]) => [
          name,
          [...variants].sort().map((value) => JSON.parse(value)),
        ]),
    ),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Fail closed when an explicitly lossless structural-oneOf merge group drifts.
 * Unmarked oneOf schemas retain one selected variant.
 */
export function assertOneOfMergeContracts(
  document: unknown,
  trading: boolean,
  reviewedFingerprints: ReadonlyMap<string, string> =
    REVIEWED_TRADING_SHAPE_FINGERPRINTS,
): void {
  const schemas = asRecord(
    asRecord(asRecord(document)?.components)?.schemas,
  );
  if (!schemas) {
    throw new OneOfMergeContractError(
      "OpenAPI document is missing components.schemas",
    );
  }

  const marked = Object.entries(schemas).filter(
    ([, schema]) => EXTENSION in (asRecord(schema) ?? {}),
  );
  if (!trading && marked.length > 0) {
    throw new OneOfMergeContractError(
      `${EXTENSION} is only supported by the trading generator`,
    );
  }

  for (const [schemaName, schemaValue] of marked) {
    const schema = asRecord(schemaValue)!;
    const configured = schema[EXTENSION];
    if (
      !Array.isArray(configured) ||
      configured.length < 2 ||
      configured.some((name) => typeof name !== "string") ||
      new Set(configured).size !== configured.length
    ) {
      throw new OneOfMergeContractError(
        `${schemaName}.${EXTENSION} must contain at least two unique model names`,
      );
    }
    const oneOf = schema.oneOf;
    if (!Array.isArray(oneOf)) {
      throw new OneOfMergeContractError(
        `${schemaName}.${EXTENSION} requires a oneOf schema`,
      );
    }
    const variants = new Set(
      oneOf
        .map(referencedModel)
        .filter((name): name is string => name !== undefined),
    );
    const missing = configured.filter((name) => !variants.has(name));
    if (missing.length > 0) {
      throw new OneOfMergeContractError(
        `${schemaName}.${EXTENSION} references non-oneOf models: ${missing.join(", ")}`,
      );
    }
  }

  if (!trading) return;
  for (const [schemaName, required] of REQUIRED_TRADING_GROUPS) {
    const schema = asRecord(schemas[schemaName]);
    const configured = schema?.[EXTENSION];
    if (
      !Array.isArray(configured) ||
      configured.length !== required.length ||
      required.some((name, index) => configured[index] !== name)
    ) {
      throw new OneOfMergeContractError(
        `${schemaName}.${EXTENSION} must be ${JSON.stringify(required)}`,
      );
    }
    for (const modelName of required) {
      const expected = reviewedFingerprints.get(modelName);
      if (!expected) {
        throw new OneOfMergeContractError(
          `${schemaName}.${EXTENSION} has no reviewed shape fingerprint for ${modelName}`,
        );
      }
      const actual = oneOfShapeFingerprint(schemas, modelName);
      if (actual !== expected) {
        throw new OneOfMergeContractError(
          `${schemaName}.${EXTENSION} candidate ${modelName} shape drifted; expected reviewed fingerprint ${expected}, received ${actual}`,
        );
      }
    }
  }
}
