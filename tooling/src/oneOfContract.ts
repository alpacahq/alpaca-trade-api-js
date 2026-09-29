const EXTENSION = "x-ts-one-of-merge-models";
const REQUIRED_TRADING_GROUPS = new Map([
  [
    "ActivityV2DetailNTA",
    ["CDIVActivityV2", "CGDActivityV2", "DIVSPDActivityV2"],
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

/**
 * Fail closed when an explicitly lossless structural-oneOf merge group drifts.
 * Unmarked oneOf schemas retain one selected variant.
 */
export function assertOneOfMergeContracts(
  document: unknown,
  trading: boolean,
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
  }
}
