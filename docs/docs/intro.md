---
slug: /
title: Introduction
---

# @alpacahq/alpaca-trade-api

`@alpacahq/alpaca-trade-api` is the Node.js and TypeScript SDK for Alpaca's
**Trading API** and **Market Data API**. One package exposes one `Alpaca` client
with two primary namespaces:

- `alpaca.trading` for accounts, assets, orders, positions, and trading events.
- `alpaca.marketData` for historical, latest, and real-time market data.

Pass credentials once; the client creates its sub-APIs lazily. The package ships
dual ESM and CommonJS builds, requires Node.js 20 or newer for its primary
runtime, and offers a REST-only entrypoint for other modern runtimes.

## Generated APIs and the ergonomic facade

The client uses two additive layers:

1. **Generated REST APIs** preserve Alpaca's OpenAPI surface. Every generated
   method remains available at
   `alpaca.<group>.<resource>.<method>(...)`, such as
   `alpaca.trading.assets.getV2Assets()` or
   `alpaca.marketData.stocks.stockBars(...)`.
2. **Ergonomic helpers** add TypeScript-focused conveniences without replacing
   generated methods: typed order builders, workflow helpers, normalized
   market-data shapes, and pagination.

If a convenience helper does not cover your use case, use the generated method
directly. See [Values & types](./types-and-values.md#discovering-capabilities)
to find which accessor owns a generated method or ergonomic helper.

## How the docs are organized

These pages use progressive disclosure:

- **[Getting started](./getting-started.md)** gets a paper-trading client running
  with one authenticated call and one safely identifiable paper order.
- **SDK Areas** explain workflows for [Trading](./trading.md),
  [Market Data](./market-data.md), and
  [Streaming & Events](./streaming.md).
- **Guides** cover Node/TypeScript concerns such as authentication, resilience,
  pagination, values and types, testing, and runtime compatibility.
- **[API Reference](./api/index.md)** is a curated, example-driven facade
  reference spanning generated REST methods, ergonomic helpers, and streams.

The documentation contract is explicit:

- The repository
  [`README.md`](https://github.com/alpacahq/alpaca-trade-api-js) is a concise
  gateway for installation and orientation.
- These guides are the canonical narrative source for workflows, conventions,
  safety, and integration guidance.
- The generated API Reference owns the curated method index and per-method
  examples.
- Published TypeScript declarations and your editor own the complete API
  surface, exact signatures, and model fields for the installed version.

## AI coding guidance

The same comprehensive guidance for coding agents is available in two formats:

- Read the packaged
  [`LLMS.md`](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/LLMS.md)
  directly.
- Install the equivalent Agent Skill:
  `npx skills add alpacahq/alpaca-trade-api-js`.

For repository maintenance rather than application code, use the repo-only
[`AGENTS.md`](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md).
