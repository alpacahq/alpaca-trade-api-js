---
type: Architecture Decision
title: ADR-0001 Generated REST clients are never hand-edited
description: REST clients and models are OpenAPI-generated and every required deviation is encoded declaratively so regeneration reproduces the committed trees byte-for-byte.
status: accepted
date: unknown
deciders: []
supersedes: []
affects: [alpaca_trade_api_js.sdk, alpaca_trade_api_js.codegen_tooling]
allium: []
evidence: ["AGENTS.md", "tooling/GENERATION.md", "tooling/overlays/trading.patch.json", "tooling/overlays/market-data.patch.json", "tooling/templates/typescript-fetch/modelGeneric.mustache", ".github/workflows/ci.yaml", "src/trading/.openapi-generator-ignore", "src/market-data/.openapi-generator-ignore"]
tags: [alpacahq, adr, generated]
timestamp: 2026-09-12T00:00:00+00:00
generated_by: claude-opus-5 / layered-docs 2026-09
source_commit: d9bf929886238c16dc790501432c9e3cd7c0f8e2
source_branch: docs/layered-2026-09
generated_at: 2026-09-12T00:00:00+00:00
confidence: high
review_status: draft-needs-review
---

# ADR-0001 Generated REST clients are never hand-edited

## Context

The Trading and Market Data REST surfaces are large and change upstream. The
repository generates `src/trading/{apis,models,index.ts}` and
`src/market-data/{apis,models,index.ts}` with OpenAPI Generator
(`tooling/config/trading.yaml`, `tooling/config/market-data.yaml`). Stock
`typescript-fetch` output needs three deviations: null-safe deserialization of
required arrays, undocumented-field passthrough on six trading models, and a
tightened market-data `feed` enum (`tooling/GENERATION.md`). Patching the output by
hand would be silently undone by the next regeneration.

## Decision

The generated trees are treated as derived artefacts and are never hand-edited.
Every deviation is encoded declaratively — in forked Mustache templates
(`tooling/templates/typescript-fetch/`) or JSON Patch overlays
(`tooling/overlays/`) — so that `npm run generate:offline` reproduces the committed
trees byte-for-byte. All behaviour and ergonomics live in hand-written modules
outside those trees (`AGENTS.md`). The two `runtime.ts` shims are the declared
exception and are protected from regeneration by `.openapi-generator-ignore`.

## Consequences

- CI enforces the invariant: the `regen-invariant` job runs `npm run generate:offline` and then `git diff --exit-code -- src/trading src/market-data` (`.github/workflows/ci.yaml`).
- Regeneration needs a JDK, so CI installs Temurin 17 (`.github/workflows/ci.yaml`) and the pipeline auto-detects a local JDK (`tooling/src/env.ts`).
- A stale overlay path fails the build with `OverlayDriftError` rather than silently producing different output (`tooling/GENERATION.md`, `tooling/src/overlay.ts`).
- The linter is scoped away from the generated trees (`biome.json`, `AGENTS.md`).
- Adopting an upstream spec change is an explicit, gated act: non-interactive adoption containing removed schemas or operations is refused unless overridden (`tooling/GENERATION.md`, `tooling/src/run.ts`).

## Alternatives considered

`tooling/GENERATION.md` records hand-editing generated files as the rejected
option ("never as a hand-edit"), but no wider alternatives discussion is recorded
in the repository.
