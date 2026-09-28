type JsonObject = Record<string, unknown>;

const MARKER = "x-ts-travel-rule-info";

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function fail(message: string): never {
  throw new Error(`Travel Rule contract: ${message}`);
}

function requireProperty(
  properties: JsonObject,
  name: string,
): JsonObject {
  return object(properties[name]) ?? fail(`missing object property ${name}`);
}

/**
 * Fail closed around the narrow template customization whose generated type
 * hardcodes TravelRuleInfo's destination and identity alternatives.
 */
export function assertTravelRuleContract(
  root: unknown,
  required: boolean,
): void {
  const schemas =
    object(object(object(root)?.components)?.schemas) ?? {};
  const marked = Object.entries(schemas).filter(
    ([, value]) => object(value)?.[MARKER] !== undefined,
  );

  if (!required) {
    if (marked.length > 0) {
      fail(`${MARKER} is only supported by the trading specification`);
    }
    return;
  }
  if (marked.length !== 1 || marked[0]?.[0] !== "TravelRuleInfo") {
    fail(`expected exactly one marked TravelRuleInfo schema`);
  }

  const schema = object(marked[0][1])!;
  if (schema[MARKER] !== true || schema.type !== "object") {
    fail(`TravelRuleInfo must be an object with ${MARKER}: true`);
  }
  const properties =
    object(schema.properties) ?? fail("TravelRuleInfo properties are missing");

  for (const name of [
    "beneficiary_vasp_id",
    "beneficiary_entity_name",
    "beneficiary_given_name",
    "beneficiary_family_name",
  ]) {
    if (requireProperty(properties, name).type !== "string") {
      fail(`${name} must remain a string`);
    }
  }
  if (
    requireProperty(properties, "beneficiary_is_self_hosted").type !==
    "boolean"
  ) {
    fail("beneficiary_is_self_hosted must remain a boolean");
  }
  if (
    requireProperty(properties, "beneficiary_manual_entry").$ref !==
    "#/components/schemas/TravelRuleManualEntry"
  ) {
    fail("beneficiary_manual_entry must reference TravelRuleManualEntry");
  }

  const manualEntry =
    object(schemas.TravelRuleManualEntry) ??
    fail("TravelRuleManualEntry schema is missing");
  if (manualEntry.type !== "object") {
    fail("TravelRuleManualEntry must remain an object");
  }
  const manualProperties =
    object(manualEntry.properties) ??
    fail("TravelRuleManualEntry properties are missing");
  const manualRequired = Array.isArray(manualEntry.required)
    ? manualEntry.required
    : [];
  for (const name of ["vasp_name", "vasp_website"]) {
    if (
      requireProperty(manualProperties, name).type !== "string" ||
      !manualRequired.includes(name)
    ) {
      fail(`TravelRuleManualEntry.${name} must remain a required string`);
    }
  }
}
