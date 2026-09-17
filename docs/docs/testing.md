---
title: Testing your integration
---

# Testing your integration

The dedicated `@alpacahq/alpaca-trade-api/testing` entrypoint provides a
network-free harness for unit tests. It lets application code exercise the real
facade, generated deserialization, and ergonomic helpers without contacting
Alpaca or hand-building `Response` objects.

## Create a mock client

`createMockAlpaca(routes, options?)` returns an `Alpaca` client backed by
`mockFetch`. It supplies dummy credentials and disables client-side rate
limiting by default.

Routes are checked in order, and the first match wins:

- `path` is either an exact `URL.pathname` string or a regular expression.
- Optional `method` matching is case-insensitive; omit it to match any method.
- `body` may be an object, which is JSON-encoded, or a string sent verbatim.
- `status` defaults to 200 and `headers` adds response headers.
- `respond(request)` handles dynamic or asynchronous responses.

```ts
import { describe, expect, it } from "vitest";
import {
  createMockAlpaca,
} from "@alpacahq/alpaca-trade-api/testing";

describe("portfolio summary", () => {
  it("reads account state and a latest price without the network", async () => {
    const alpaca = createMockAlpaca([
      {
        method: "GET",
        path: "/v2/account",
        body: {
          account_number: "PA42",
          status: "ACTIVE",
          buying_power: "10000.00",
        },
      },
      {
        method: "GET",
        path: /\/v2\/stocks\/[A-Z]+\/trades\/latest$/,
        respond: ({ url }) => ({
          symbol: url.pathname.split("/")[3],
          trade: { p: 99.5 },
        }),
      },
    ]);

    const account = await alpaca.trading.account.getAccount();
    const price = await alpaca.marketData.getLatestPrice("AAPL");

    expect(account.accountNumber).toBe("PA42");
    expect(account.buyingPower).toBe("10000.00");
    expect(price).toBe(99.5);
  });
});
```

## Unmatched requests and fallbacks

An unmatched request receives a descriptive JSON 404 naming its method and
path. This makes accidental network dependencies and stale route fixtures fail
visibly.

Provide `fallback` when a shared default is useful:

```ts
const alpaca = createMockAlpaca([], {
  fallback: ({ method, url }) => new Response(
    JSON.stringify({ message: `Unhandled ${method} ${url.pathname}` }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  ),
});
```

`mockFetch(routes, { fallback })` is also exported directly when you need only
a fetch-compatible function, for example to pass as a `fetchApi` option to a
raw `Configuration`.

Keep these tests focused on your application's request construction, response
handling, and failure policies. Use paper trading separately for integration
tests that intentionally exercise Alpaca's live service behavior.
