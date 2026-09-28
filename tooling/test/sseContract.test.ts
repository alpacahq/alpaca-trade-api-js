import { describe, expect, it } from "vitest";
import { assertSseContracts } from "../src/sseContract.js";

const operation = (overrides: Record<string, unknown> = {}) => ({
  operationId: "Subscribe",
  parameters: [
    { name: "until", in: "query", schema: { type: "string" } },
    { name: "Last-Event-Id", in: "header", schema: { type: "string" } },
  ],
  responses: {
    "200": {
      content: {
        "text/event-stream": {
          schema: {
            type: "array",
            items: { $ref: "#/components/schemas/Event" },
          },
        },
      },
    },
  },
  ...overrides,
});

const document = (op: Record<string, unknown>) => ({
  openapi: "3.1.0",
  paths: { "/events": { get: op } },
  components: { schemas: { Event: { type: "object" } } },
});

describe("SSE generation contract", () => {
  it("accepts an explicitly marked supported SSE operation", () => {
    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": true,
            "x-typescript-fetch-sse-reconnect": true,
            parameters: [
              {
                name: "until",
                in: "query",
                schema: { type: "string" },
                "x-typescript-fetch-sse-terminal": true,
              },
              {
                name: "Last-Event-Id",
                in: "header",
                schema: { type: "string" },
                "x-typescript-fetch-sse-last-event-id": true,
              },
            ],
            servers: [{ url: "https://stream.example.com" }],
          }),
        ),
      ),
    ).not.toThrow();
  });

  it("rejects an unmarked event stream", () => {
    expect(() => assertSseContracts(document(operation()))).toThrowError(
      /missing x-typescript-fetch-sse/,
    );
  });

  it("rejects a stale marker on a non-SSE operation", () => {
    expect(() =>
      assertSseContracts(
        document({
          ...operation(),
          "x-typescript-fetch-sse": true,
          responses: {
            "200": {
              content: {
                "application/json": { schema: { type: "object" } },
              },
            },
          },
        }),
      ),
    ).toThrowError(/no successful text\/event-stream/);
  });

  it("rejects false markers and companion metadata without approval", () => {
    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": false,
          }),
        ),
      ),
    ).toThrowError(/must be true when present/);

    const nonSse = {
      ...operation(),
      responses: { "200": { content: { "application/json": {} } } },
      "x-typescript-fetch-sse-reconnect": true,
    };
    expect(() => assertSseContracts(document(nonSse))).toThrowError(
      /requires x-typescript-fetch-sse: true/,
    );
  });

  it("rejects ambiguous or non-array SSE response shapes", () => {
    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": true,
            responses: {
              "200": {
                content: {
                  "text/event-stream": {
                    schema: { $ref: "#/components/schemas/Event" },
                  },
                },
              },
            },
          }),
        ),
      ),
    ).toThrowError(/array whose items use one model \$ref/);
  });

  it("rejects invalid operation servers and sandbox indices", () => {
    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": true,
            servers: [{ url: "http://stream.example.com" }],
          }),
        ),
      ),
    ).toThrowError(/must use a concrete HTTPS URL/);

    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": true,
            servers: [{ url: "https://{tenant}.example.com" }],
          }),
        ),
      ),
    ).toThrowError(/must use a concrete HTTPS URL/);

    expect(() =>
      assertSseContracts(
        document(
          operation({
            "x-typescript-fetch-sse": true,
            "x-typescript-fetch-sse-sandbox-server-index": 2,
            servers: [{ url: "https://stream.example.com" }],
          }),
        ),
      ),
    ).toThrowError(/must reference an existing operation server/);
  });

  it("resolves referenced parameters before checking extension metadata", () => {
    const spec = document(
      operation({
        "x-typescript-fetch-sse": true,
        parameters: [
          { $ref: "#/components/parameters/until" },
          { $ref: "#/components/parameters/lastEventId" },
        ],
      }),
    ) as Record<string, any>;
    spec.components.parameters = {
      until: {
        name: "until",
        in: "query",
        schema: { type: "string" },
        "x-typescript-fetch-sse-terminal": true,
      },
      lastEventId: {
        name: "Last-Event-Id",
        in: "header",
        schema: { type: "string" },
        "x-typescript-fetch-sse-last-event-id": true,
      },
    };

    expect(() => assertSseContracts(spec)).not.toThrow();
  });

  it("resolves referenced responses and rejects unresolved item models", () => {
    const spec = document(
      operation({
        "x-typescript-fetch-sse": true,
        responses: { "2XX": { $ref: "#/components/responses/events" } },
      }),
    ) as Record<string, any>;
    spec.components.responses = {
      events: operation().responses["200"],
    };

    expect(() => assertSseContracts(spec)).not.toThrow();

    spec.components.responses.events.content[
      "text/event-stream"
    ].schema.items.$ref = "#/components/schemas/Missing";
    expect(() => assertSseContracts(spec)).toThrowError(
      /array whose items use one model \$ref/,
    );
  });

  it("resolves path-item and chained response references", () => {
    const spec = document({}) as Record<string, any>;
    spec.paths["/events"] = { $ref: "#/components/pathItems/events" };
    spec.components.pathItems = {
      events: {
        get: operation({
          "x-typescript-fetch-sse": true,
          responses: { "200": { $ref: "#/components/responses/first" } },
        }),
      },
    };
    spec.components.responses = {
      first: { $ref: "#/components/responses/second" },
      second: operation().responses["200"],
    };

    expect(() => assertSseContracts(spec)).not.toThrow();
  });

  it("normalizes media types and rejects competing successful bodies", () => {
    const normalized = operation({
      "x-typescript-fetch-sse": true,
      responses: {
        "200": {
          content: {
            "Text/Event-Stream; charset=utf-8":
              operation().responses["200"].content["text/event-stream"],
          },
        },
      },
    });
    expect(() => assertSseContracts(document(normalized))).not.toThrow();

    const competing = structuredClone(normalized) as Record<string, any>;
    competing.responses["200"].content["application/json"] = {
      schema: { type: "object" },
    };
    expect(() => assertSseContracts(document(competing))).toThrowError(
      /competing media type/,
    );
  });

  it("rejects cyclic references and misplaced parameter markers", () => {
    const cyclic = document({}) as Record<string, any>;
    cyclic.paths["/events"] = { $ref: "#/components/pathItems/loop" };
    cyclic.components.pathItems = {
      loop: { $ref: "#/components/pathItems/loop" },
    };
    expect(() => assertSseContracts(cyclic)).toThrowError(
      /unresolved or cyclic/,
    );

    const misplaced = operation({
      "x-typescript-fetch-sse": true,
      parameters: [
        {
          name: "until",
          in: "header",
          "x-typescript-fetch-sse-terminal": true,
        },
      ],
    });
    expect(() => assertSseContracts(document(misplaced))).toThrowError(
      /only valid on query parameters/,
    );
  });

  it("rejects unsafe server URL components", () => {
    for (const url of [
      "https://user@example.com",
      "https://stream.example.com?token=x",
      "https://stream.example.com/#fragment",
      "https://stream.example.com/'unsafe",
    ]) {
      expect(() =>
        assertSseContracts(
          document(
            operation({
              "x-typescript-fetch-sse": true,
              servers: [{ url }],
            }),
          ),
        ),
      ).toThrowError(/must use a concrete HTTPS URL/);
    }
  });
});
