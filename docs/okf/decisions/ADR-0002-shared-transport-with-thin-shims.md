---
type: Architecture Decision
title: ADR-0002 One shared transport behind thin per-API shims
description: The HTTP transport lives once in src/core/runtime.ts; the per-API runtime modules only add host constants and a Configuration subclass.
status: accepted
date: unknown
deciders: []
supersedes: []
affects: [alpaca_trade_api_js.sdk]
allium: []
evidence: ["AGENTS.md", "src/core/runtime.ts", "src/trading/runtime.ts", "src/market-data/runtime.ts", "src/client.ts", "src/middleware.ts", "src/rate-limit.ts", "src/errors.ts"]
tags: [alpacahq, adr, generated]
timestamp: 2026-09-12T00:00:00+00:00
generated_by: claude-opus-5 / layered-docs 2026-09
source_commit: d9bf929886238c16dc790501432c9e3cd7c0f8e2
source_branch: docs/layered-2026-09
generated_at: 2026-09-12T00:00:00+00:00
confidence: high
review_status: draft-needs-review
---

# ADR-0002 One shared transport behind thin per-API shims

## Context

OpenAPI Generator emits a `runtime.ts` per generated target. With two targets that
would mean two independent copies of the HTTP layer, so retry, timeout, rate
limiting, middleware and error parsing would drift between the Trading and Market
Data clients (`AGENTS.md`).

## Decision

The transport — retry and backoff, request timeouts, rate limiting, typed errors,
middleware, querystring handling and response wrappers — lives once in
`src/core/runtime.ts`. `src/trading/runtime.ts` and `src/market-data/runtime.ts` are
thin shims that re-export it and add their host constants plus a
`Configuration` subclass overriding the default base path (`AGENTS.md`,
`src/trading/runtime.ts`, `src/market-data/runtime.ts`).

The shims are not identical, though. The market-data shim additionally exports a
`JSONApiResponse` subclass that deliberately shadows the `export *` re-export, so
every generated market-data API parses response bodies with `lossless-json` and a
custom number reviver; integer tokens beyond `2^53` (in practice crypto trade ids)
come back as exact decimal strings rather than lossy `number`s. The trading
transport is unaffected (`src/market-data/runtime.ts:22-52`).

## Consequences

- Transport changes are made in one place; the shims are touched only for host or base-path concerns (`AGENTS.md`).
- The shims sit inside otherwise generator-owned trees, so they are excluded from regeneration via `.openapi-generator-ignore` and protected by the stale-file cleanup step (`tooling/GENERATION.md`).
- Host selection is centralised, but the two groups are driven by **independent** flags: the trading host is chosen by `paper` (`src/trading/runtime.ts:26-30` — `paper === false` gives the live host, otherwise the paper host), while the market-data host is chosen by a separate `sandbox` flag (`src/market-data/runtime.ts:64-68` — `sandbox === true` gives `data.sandbox.alpaca.markets`, otherwise `data.alpaca.markets`). `paper` is accepted on the market-data `Configuration` for symmetry but has no effect there, so `paper: true` alone still reaches **production** market data (`src/market-data/runtime.ts:8-12`, `src/client.ts:92-105`).
- The one genuine transport divergence is the market-data `JSONApiResponse` override described above; it is the exception to "transport changes are made in one place" (`src/market-data/runtime.ts:46-52`).
- Cross-cutting behaviour such as the typed `ApiError` envelope and the default user agent applies uniformly to both API groups (`src/errors.ts`, `AGENTS.md`).
