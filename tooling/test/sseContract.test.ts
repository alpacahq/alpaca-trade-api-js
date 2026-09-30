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
  servers: [
    { url: "https://paper-api.alpaca.markets" },
    { url: "https://api.alpaca.markets" },
  ],
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

  it("accepts only runtime-supported successful SSE statuses", () => {
    const withNoContent = operation({
      "x-typescript-fetch-sse": true,
      responses: {
        ...operation().responses,
        "204": { description: "Stop reconnecting" },
      },
    });
    expect(() =>
      assertSseContracts(document(withNoContent)),
    ).not.toThrow();

    for (const status of ["201", "206", "2XX"]) {
      const unsupported = operation({
        "x-typescript-fetch-sse": true,
        responses: {
          "200": operation().responses["200"],
          [status]: { description: "Unsupported success" },
        },
      });
      expect(() =>
        assertSseContracts(document(unsupported)),
      ).toThrowError(new RegExp(`status ${status} is unsupported`));
    }

    const contentfulNoContent = operation({
      "x-typescript-fetch-sse": true,
      responses: {
        ...operation().responses,
        "204": {
          content: {
            "text/event-stream":
              operation().responses["200"].content[
                "text/event-stream"
              ],
          },
        },
      },
    });
    expect(() =>
      assertSseContracts(document(contentfulNoContent)),
    ).toThrowError(/204 must not declare response content/);
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
    ).toThrowError(/must reference an existing operation-level server/);
  });

  it("rejects SSE authentication the template cannot emit", () => {
    const spec = document(
      operation({
        "x-typescript-fetch-sse": true,
        security: [{ cookieKey: [] }],
      }),
    ) as Record<string, any>;
    spec.components.securitySchemes = {
      cookieKey: {
        type: "apiKey",
        in: "cookie",
        name: "session",
      },
    };

    expect(() => assertSseContracts(spec)).toThrowError(
      /cookieKey.*apiKey in cookie.*cannot be emitted/,
    );

    spec.paths["/events"].get.security = [{ missing: [] }];
    expect(() => assertSseContracts(spec)).toThrowError(
      /security scheme missing is unresolved/,
    );
  });

  it("accepts every authentication scheme the SSE template emits", () => {
    const spec = document(
      operation({
        "x-typescript-fetch-sse": true,
        security: [
          { headerKey: [], queryKey: [] },
          { basic: [] },
          { bearer: [] },
          { oauth: ["events:read"] },
        ],
      }),
    ) as Record<string, any>;
    spec.components.securitySchemes = {
      headerKey: {
        type: "apiKey",
        in: "header",
        name: "X-Key",
      },
      queryKey: {
        type: "apiKey",
        in: "query",
        name: "key",
      },
      basic: { type: "http", scheme: "basic" },
      bearer: { type: "http", scheme: "bearer" },
      oauth: {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "https://auth.example.com/token",
            scopes: { "events:read": "Read events" },
          },
        },
      },
    };

    expect(() => assertSseContracts(spec)).not.toThrow();
  });

  it("requires operation-level SSE servers when template metadata needs them", () => {
    const pathServers = document(
      operation({
        "x-typescript-fetch-sse": true,
      }),
    ) as Record<string, any>;
    pathServers.paths["/events"].servers = [
      { url: "https://stream.example.com" },
    ];
    expect(() => assertSseContracts(pathServers)).toThrowError(
      /path-level servers cannot be emitted/,
    );

    const rootServers = document(
      operation({
        "x-typescript-fetch-sse": true,
      }),
    ) as Record<string, any>;
    rootServers.servers = [
      { url: "https://paper-api.alpaca.markets" },
      { url: "https://api.alpaca.markets" },
    ];
    expect(() => assertSseContracts(rootServers)).not.toThrow();

    rootServers.paths["/events"].get[
      "x-typescript-fetch-sse-sandbox-server-index"
    ] = 0;
    expect(() => assertSseContracts(rootServers)).toThrowError(
      /must reference an existing operation-level server/,
    );
  });

  it("pins root-server fallback to the target runtime hosts", () => {
    const trading = document(
      operation({ "x-typescript-fetch-sse": true }),
    ) as Record<string, any>;
    trading.servers = [{ url: "https://api.example.com" }];
    expect(() =>
      assertSseContracts(trading, "trading"),
    ).toThrowError(/do not match the trading runtime hosts/);

    const marketData = document(
      operation({ "x-typescript-fetch-sse": true }),
    ) as Record<string, any>;
    marketData.servers = [
      { url: "https://data.alpaca.markets" },
      { url: "https://data.sandbox.alpaca.markets" },
    ];
    expect(() =>
      assertSseContracts(marketData, "market-data"),
    ).not.toThrow();

    marketData.servers = [
      { url: "https://data.sandbox.alpaca.markets" },
    ];
    expect(() =>
      assertSseContracts(marketData, "market-data"),
    ).toThrowError(/do not match the market-data runtime hosts/);

    marketData.paths["/events"].get.servers = [
      { url: "https://stream.data.alpaca.markets" },
    ];
    expect(() =>
      assertSseContracts(marketData, "market-data"),
    ).toThrowError(/do not match the market-data runtime hosts/);
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
        responses: { "200": { $ref: "#/components/responses/events" } },
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
