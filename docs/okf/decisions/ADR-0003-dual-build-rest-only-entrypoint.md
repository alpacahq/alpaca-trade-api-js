---
type: Architecture Decision
title: ADR-0003 Dual CJS and ESM build with a REST-only entrypoint
description: tsup emits native CJS and ESM bundles with api-extractor declarations, and export conditions resolve edge and browser runtimes to a streaming-free REST build.
status: accepted
date: unknown
deciders: []
supersedes: []
affects: [alpaca_trade_api_js.sdk]
allium: []
evidence: ["tsup.config.ts", "package.json", "README.md", "src/rest.ts", "src/index.ts", ".github/workflows/ci.yaml", "scripts/verify-package.mjs"]
tags: [alpacahq, adr, generated]
timestamp: 2026-09-12T00:00:00+00:00
generated_by: claude-opus-5 / layered-docs 2026-09
source_commit: d9bf929886238c16dc790501432c9e3cd7c0f8e2
source_branch: docs/layered-2026-09
generated_at: 2026-09-12T00:00:00+00:00
confidence: high
review_status: draft-needs-review
---

# ADR-0003 Dual CJS and ESM build with a REST-only entrypoint

## Context

Consumers run the package on Node, Bun, Deno, Cloudflare Workers, Vercel Edge and in
browsers (`README.md`). The streaming clients depend on Node-compatible WebSocket
modules that do not run on edge runtimes or in the browser, and the generated source
uses extensionless relative imports that `tsc` alone cannot turn into native ESM
(`tsup.config.ts`, `README.md`).

## Decision

Build with `tsup`, emitting both CJS and native ESM from three entries —
`src/index.ts`, `src/rest.ts` and `src/testing.ts` — while `tsc --noEmit` remains the
type authority. Declarations are produced with `experimentalDts` (api-extractor)
because the legacy dts rollup emitted invalid namespace re-exports. Package
`exports` conditions (`workerd`, `worker`, `edge-light`, `deno`, `browser`) resolve
the root import to the streaming-free REST build, so REST works everywhere and the
stream factories throw if called on those targets (`package.json`, `tsup.config.ts`,
`README.md`).

## Consequences

- Runtime dependencies (`ws`, `@msgpack/msgpack`) stay out of REST-only bundles, keeping edge bundles free of Node-only modules (`tsup.config.ts`, `src/rest.ts`).
- A build plugin restores the `node:` scheme on builtin imports that esbuild strips, because edge runtimes and Node ESM require the prefix (`tsup.config.ts`).
- The supported Node floor is 20, set by the transport relying on platform-global `fetch`, `Headers`, `URL` and `AbortController`; CI executes the packed package on Node 20 while building on Node 24 (`package.json`, `README.md`, `.github/workflows/ci.yaml`, `scripts/verify-package.mjs`).
- REST declarations stay portable so strict Node projects need no DOM libs, and package fixtures cover CJS, ESM, no-DOM and edge consumers (`README.md`, `test/package-fixtures/`).
