---
sidebar_position: 3
title: Authentication
---

# Authentication

Alpaca authenticates with two distinct headers, `APCA-API-KEY-ID` and
`APCA-API-SECRET-KEY`. The SDK maps these to a `keyId` / `secret` pair:

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";

const alpaca = new Alpaca({ keyId: "YOUR_KEY", secret: "YOUR_SECRET" });
```

:::warning Don't pass `apiKey` as a bare string
A single string would be sent for **both** header values and Alpaca would reject
it. Use the `keyId` / `secret` pair (or an OAuth token). The SDK throws a guided
error if you pass `apiKey` as a string.
:::

## OAuth

Provide an `accessToken` instead of a key pair to authenticate via OAuth (sent as
the `Authorization: Bearer` header):

```ts
const alpaca = new Alpaca({ accessToken: "OAUTH_TOKEN" });
```

## Verifying credentials

`trading.validateConnection()` checks credentials and connectivity without
throwing. It performs a lightweight authenticated probe (`getAccount`) and
returns a discriminated result: `{ ok: true, account }` on success, or
`{ ok: false, status, code, message }` on failure (a `401`/`403` for bad or
unauthorized credentials sets `status`; transport failures surface the
underlying `message`). Handy for a startup health check.

```ts
const check = await alpaca.trading.validateConnection();
if (!check.ok) {
  throw new Error(`Alpaca auth failed (${check.status ?? "network"}): ${check.message}`);
}
console.log("connected as", check.account.id);
```

## Paper vs live vs sandbox

- **`paper`** (default `true`) selects the paper trading host; set `paper: false`
  for live trading. Honored only by hosts that distinguish the two (e.g. trading).
- **`sandbox`** selects the market-data sandbox host where supported. Crypto and
  news streams are **production-only** (no sandbox endpoint).
- An explicit `basePath` always overrides the `paper` / `sandbox` selection.

```ts
const live = new Alpaca({ keyId, secret, paper: false });
```
