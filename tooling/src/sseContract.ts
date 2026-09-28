const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

const SSE_MARKER = "x-typescript-fetch-sse";
const SSE_RECONNECT = "x-typescript-fetch-sse-reconnect";
const SSE_TERMINAL_PARAM = "x-typescript-fetch-sse-terminal";
const SSE_LAST_EVENT_ID_PARAM = "x-typescript-fetch-sse-last-event-id";
const SSE_SANDBOX_SERVER_INDEX =
  "x-typescript-fetch-sse-sandbox-server-index";
const SSE_EXTENSIONS = [
  SSE_MARKER,
  SSE_RECONNECT,
  SSE_SANDBOX_SERVER_INDEX,
] as const;

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function resolveLocalRef(root: JsonObject, value: unknown): JsonObject | undefined {
  let item = object(value);
  const seen = new Set<string>();
  while (item && typeof item.$ref === "string") {
    const ref = item.$ref;
    if (!ref.startsWith("#/") || seen.has(ref)) return undefined;
    seen.add(ref);
    let current: unknown = root;
    for (const encodedSegment of ref.slice(2).split("/")) {
      const segment = encodedSegment.replace(/~1/g, "/").replace(/~0/g, "~");
      current = object(current)?.[segment];
    }
    item = object(current);
  }
  return item;
}

function normalizedMediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function operationLabel(method: string, path: string, operation: JsonObject): string {
  const id =
    typeof operation.operationId === "string"
      ? ` (${operation.operationId})`
      : "";
  return `${method.toUpperCase()} ${path}${id}`;
}

function fail(label: string, message: string): never {
  throw new Error(`Invalid SSE generation contract for ${label}: ${message}`);
}

/**
 * Fail closed around OpenAPI Generator's lack of native SSE support.
 *
 * Every successful `text/event-stream` response must be explicitly approved by
 * the overlay, and every approved operation must expose the narrow array-item
 * shape the pinned TypeScript template knows how to lower to one typed SSE
 * message. This prevents a future spec update from silently regenerating
 * another buffered `Promise<T[]>` client.
 */
export function assertSseContracts(document: unknown): void {
  const root = object(document);
  if (!root) {
    throw new Error("Cannot validate SSE contracts: OpenAPI document is not an object");
  }
  const paths = object(root.paths);
  if (!paths) {
    throw new Error("Cannot validate SSE contracts: OpenAPI document has no paths object");
  }

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = resolveLocalRef(root, rawPathItem);
    if (!pathItem) {
      throw new Error(
        `Invalid SSE generation contract for path ${path}: path item reference is unresolved or cyclic`,
      );
    }

    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const operation = object(rawOperation);
      if (!operation) continue;

      const label = operationLabel(method, path, operation);
      const responses = object(operation.responses);
      let successfulSseSchema: JsonObject | undefined;
      let successfulSseCount = 0;
      let competingSuccessfulMedia: string | undefined;

      for (const [status, rawResponse] of Object.entries(responses ?? {})) {
        if (!/^2(?:\d\d|XX)$/i.test(status)) continue;
        const response = resolveLocalRef(root, rawResponse);
        const content = object(response?.content);
        for (const [rawMediaType, rawMedia] of Object.entries(content ?? {})) {
          const mediaType = normalizedMediaType(rawMediaType);
          if (mediaType === "text/event-stream") {
            successfulSseCount += 1;
            successfulSseSchema = object(object(rawMedia)?.schema);
          } else {
            competingSuccessfulMedia ??= `${status} ${rawMediaType}`;
          }
        }
      }

      const hasMarker = Object.hasOwn(operation, SSE_MARKER);
      if (hasMarker && operation[SSE_MARKER] !== true) {
        fail(label, `${SSE_MARKER} must be true when present`);
      }
      const marked = operation[SSE_MARKER] === true;
      const companionExtension = SSE_EXTENSIONS.slice(1).find((name) =>
        Object.hasOwn(operation, name),
      );
      if (!marked && companionExtension) {
        fail(
          label,
          `${companionExtension} requires ${SSE_MARKER}: true`,
        );
      }
      if (successfulSseCount > 0 && !marked) {
        fail(
          label,
          `successful text/event-stream response is missing ${SSE_MARKER}`,
        );
      }
      if (marked && successfulSseCount === 0) {
        fail(
          label,
          `${SSE_MARKER} is present but no successful text/event-stream response exists`,
        );
      }
      const parameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ];
      const hasSseParameterMarker = parameters.some((rawParameter) => {
        const parameter = resolveLocalRef(root, rawParameter);
        return (
          parameter?.[SSE_TERMINAL_PARAM] !== undefined ||
          parameter?.[SSE_LAST_EVENT_ID_PARAM] !== undefined
        );
      });
      if (!marked && hasSseParameterMarker) {
        fail(
          label,
          `SSE parameter extensions require ${SSE_MARKER}: true`,
        );
      }
      if (!marked) continue;
      if (successfulSseCount !== 1) {
        fail(
          label,
          `expected exactly one successful text/event-stream response, found ${successfulSseCount}`,
        );
      }
      if (competingSuccessfulMedia) {
        fail(
          label,
          `successful response has competing media type ${competingSuccessfulMedia}`,
        );
      }
      const itemSchema = object(successfulSseSchema?.items);
      const itemRef = itemSchema?.$ref;
      if (
        successfulSseSchema?.type !== "array" ||
        typeof itemRef !== "string" ||
        !itemRef.startsWith("#/components/schemas/") ||
        !resolveLocalRef(root, itemSchema)
      ) {
        fail(
          label,
          "response schema must be an array whose items use one model $ref",
        );
      }

      if (
        operation[SSE_RECONNECT] !== undefined &&
        typeof operation[SSE_RECONNECT] !== "boolean"
      ) {
        fail(label, `${SSE_RECONNECT} must be a boolean`);
      }

      let lastEventIdCount = 0;
      for (const rawParameter of parameters) {
        const parameter = resolveLocalRef(root, rawParameter);
        if (!parameter) {
          fail(label, "parameter reference is unresolved or cyclic");
        }
        for (const extension of [
          SSE_TERMINAL_PARAM,
          SSE_LAST_EVENT_ID_PARAM,
        ]) {
          if (
            Object.hasOwn(parameter, extension) &&
            parameter[extension] !== true
          ) {
            fail(label, `${extension} must be true when present`);
          }
        }
        if (parameter[SSE_TERMINAL_PARAM] === true && parameter.in !== "query") {
          fail(label, `${SSE_TERMINAL_PARAM} is only valid on query parameters`);
        }
        if (parameter[SSE_LAST_EVENT_ID_PARAM] === true) {
          lastEventIdCount += 1;
          if (
            parameter.in !== "header" ||
            typeof parameter.name !== "string" ||
            parameter.name.toLowerCase() !== "last-event-id"
          ) {
            fail(
              label,
              `${SSE_LAST_EVENT_ID_PARAM} must mark the Last-Event-ID header parameter`,
            );
          }
        }
      }
      if (lastEventIdCount > 1) {
        fail(label, `${SSE_LAST_EVENT_ID_PARAM} may mark at most one parameter`);
      }

      const servers = Array.isArray(operation.servers)
        ? operation.servers
        : Array.isArray(pathItem.servers)
          ? pathItem.servers
          : Array.isArray(root.servers)
            ? root.servers
            : [];
      for (const [index, rawServer] of servers.entries()) {
        const url = object(rawServer)?.url;
        let parsed: URL | undefined;
        try {
          parsed = typeof url === "string" ? new URL(url) : undefined;
        } catch {
          parsed = undefined;
        }
        if (
          !parsed ||
          parsed.protocol !== "https:" ||
          parsed.username !== "" ||
          parsed.password !== "" ||
          parsed.search !== "" ||
          parsed.hash !== "" ||
          /[{}'\\\r\n]/.test(url as string)
        ) {
          fail(
            label,
            `operation server ${index} must use a concrete HTTPS URL`,
          );
        }
      }

      const sandboxIndex = operation[SSE_SANDBOX_SERVER_INDEX];
      if (sandboxIndex !== undefined) {
        if (
          !Number.isInteger(sandboxIndex) ||
          (sandboxIndex as number) < 0 ||
          (sandboxIndex as number) >= servers.length
        ) {
          fail(
            label,
            `${SSE_SANDBOX_SERVER_INDEX} must reference an existing operation server`,
          );
        }
      }
    }
  }
}
