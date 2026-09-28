---
sidebar_position: 8
title: Runtime & module compatibility
---

# Runtime & module compatibility

The SDK targets **Node.js ≥ 20** and ships a dual **ESM + CJS** build. REST and
generated fetch-based SSE run on modern fetch runtimes; WebSocket streaming is
Node/Bun only.
This page covers the support matrix, how the package resolves on edge/browser
targets, the REST-only entrypoint, and the runtime dependencies.

## Requirements

- **Node.js ≥ 20** (developed against v24) — the REST transport uses the
  platform-global `fetch`, `Headers`, `URL`, and `AbortController`. (Node 18
  reached end-of-life in April 2025; the package declares `engines.node >= 20`.)
- **Strict Node without DOM libs is supported.** The published REST declarations
  provide their own portable fetch-facing types and do not require `"dom"` in a
  consumer's `tsconfig`.

## Support matrix

| Runtime | REST / fetch-based SSE | WebSockets | Notes |
| --- | :---: | :---: | --- |
| **Node.js ≥ 20** | ✅ | ✅ | Primary target. |
| **Bun** | ✅ | ✅ | Node-compatible (`ws` runs). |
| **Deno** | ✅ | ❌ | Root auto-resolves to the REST build via the `deno` export condition. |
| **Cloudflare Workers** / `workerd` | ✅ | ❌ | Root auto-resolves to the REST build (`workerd` / `worker`). |
| **Vercel Edge** | ✅ | ❌ | Root auto-resolves to the REST build (`edge-light`). |
| **Browser** | ✅ | ❌ | Resolves to the REST build (`browser`). Not recommended — see caveat. |

Legend: ✅ supported · ❌ not supported.

- **WebSocket streaming is Node/Bun only.** Those clients depend on
  Node-compatible streaming modules, which don't run on edge or in the browser.
  On those targets the package's
  [export conditions](#edge--browser-runtimes) transparently resolve the root
  import to the WebSocket-free [REST build](#rest-only-entrypoint), so REST and
  fetch-based SSE work
  and the stream factories (`stockStream`, `stream`, ...) plus `submitAndWait`
  throw if called. For WebSocket streaming, run on Node or Bun.
- **SSE is portable fetch.** `trading.subscribeActivities()` and
  `marketData.subscribeCorporateActions()` remain available from the REST build
  and return typed `AsyncIterable` subscriptions rather than Node
  WebSocket/EventEmitter clients. Their raw generated methods remain available
  under `trading.events` and `marketData.corporateActions`.
- **Browser: technically works, but discouraged.** Calling Alpaca directly from a
  browser ships your `APCA_API_SECRET_KEY` to the client. Prefer a server or
  proxy (see the [market-data backend example](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/examples/marketdata-backend.ts))
  rather than embedding credentials in front-end code.

## Runtime identity

REST requests identify the SDK and the runtime in the default `User-Agent`:
`APCA-NODE/<sdk-version> <Runtime>/<runtime-version>` (for example,
`APCA-NODE/5.0.0 Node/22.4.0`). The runtime segment is `Node`, `Bun`, `Deno`, or
`Unknown/unknown` when no runtime is detected; Bun and Deno are detected before
Node compatibility globals. Override the header with `userAgent`, or set
`userAgent: ""` to disable it.

## Module formats (ESM & CJS)

The package ships both native ESM (`dist/index.mjs`) and CommonJS
(`dist/index.js`), selected via conditional `exports`, with per-format type
declarations and `sideEffects: false` for tree-shaking.

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api";       // ESM
```

```js
const { Alpaca } = require("@alpacahq/alpaca-trade-api");  // CJS
```

:::warning Dual-package caveat
Don't load the SDK through *both* `import` and `require` in the same process if
you rely on `instanceof` against its exported classes (e.g. `ApiError`), or you
may compare against two copies.
:::

## Edge & browser runtimes

The WebSocket clients use Node-compatible WebSocket/EventEmitter modules, which
don't run on edge runtimes (Cloudflare Workers / `workerd`, Vercel Edge, Deno)
or in the browser.
To keep the root import working there, the package `exports` map declares
`workerd`, `worker`, `edge-light`, `deno`, and `browser` conditions that resolve
`@alpacahq/alpaca-trade-api` to the WebSocket-free [REST build](#rest-only-entrypoint)
automatically — so a plain `import { Alpaca } from "@alpacahq/alpaca-trade-api"`
builds and runs on those targets without loading the streaming implementation.

The trade-off is the same as importing `/rest` directly: REST and fetch-based
SSE work unchanged,
but the stream factories (`stockStream`, `stream`, ...) and `submitAndWait`
throw. For WebSocket streaming, run on Node and import the root entry there.

## REST-only entrypoint

If you never open a stream, import from `@alpacahq/alpaca-trade-api/rest` to keep the
`ws` / `@msgpack/msgpack` dependencies out of your module graph (smaller bundles,
faster cold starts). It re-exports everything except the `streaming` namespace —
including the typed errors and the `withResponse` response wrapper. The `Alpaca`
facade is the same class, so all REST methods and generated fetch-based SSE
subscriptions work unchanged; the WebSocket stream
factories (`stockStream`, `stream`, ...) and `submitAndWait` throw if called from
this entrypoint — import from `@alpacahq/alpaca-trade-api` when you need
WebSocket streams.
Its runtime graph and published declarations contain no Node, `ws`, or msgpack
requirements, so strict Node projects without DOM libs and edge consumers can
type-check the same REST facade.

```ts
import { Alpaca } from "@alpacahq/alpaca-trade-api/rest";
```

On edge and browser runtimes you usually don't need to reach for this subpath
explicitly — the root entrypoint resolves here automatically (see
[Edge & browser runtimes](#edge--browser-runtimes)).

## Dependencies

The REST client needs only standard fetch-platform globals. The **streaming**
clients (WebSockets) pull in two small runtime dependencies —
[`ws`](https://github.com/websockets/ws) and
[`@msgpack/msgpack`](https://github.com/msgpack/msgpack-javascript). At runtime
the `Alpaca` facade only constructs them when you actually open a stream, but the
**root entrypoint's module graph statically includes them** (it re-exports the
`streaming` namespace), so a bundler resolving `@alpacahq/alpaca-trade-api` will see
`ws` / `@msgpack/msgpack`. If you only use REST — or you target an
edge/browser runtime where `ws` cannot run — import from the
[REST-only entrypoint](#rest-only-entrypoint) (or rely on the automatic edge
resolution above) and they are never pulled in.
