---
slug: /
sidebar_position: 1
title: Introduction
---

# @alpacahq/alpaca-trade-api

A TypeScript SDK for the Alpaca **Trading API** and **Market Data API**, with a
single unified `Alpaca` client, typed errors and response metadata, opt-in
resilience (retry with observability / timeout / rate limiting / secure-by-default
redirects), pagination helpers, ergonomic order builders, normalized market-data
accessors, and real-time WebSocket streaming. Dual ESM + CJS build; requires
Node ≥ 20.

:::note 4.0 alpha
This site documents the **4.0 alpha** line. Install it with the `alpha` dist-tag:

```bash
npm install @alpacahq/alpaca-trade-api@alpha
```
:::

## How the docs are organized

- **[Getting started](./getting-started.md)** — install, first call, order builders, and workflow helpers.
- **[Authentication](./authentication.md)** — API keys, OAuth, paper/live/sandbox.
- **[Resilience & configuration](./resilience.md)** — retry (with `onRetry`/`onGiveUp` observability), timeouts, redirects, rate limiting, typed errors, and response headers via `withResponse`.
- **[Market data](./market-data.md)** — normalized, symbol-keyed accessors and latest-price helpers.
- **[Streaming](./streaming.md)** — real-time trading and market-data WebSocket streams.
- **[Pagination](./pagination.md)** — iterate/collect helpers and the generic `pagination` helper.
- **API reference** — a curated, example-driven reference for every REST endpoint
  (Trading API and Market Data API) in the sidebar, generated from the SDK's
  capability maps. Streaming and ergonomic helpers are documented in the guides
  above.

The repository [`README.md`](https://github.com/alpacahq/alpaca-trade-api-js)
remains the canonical narrative; these pages are a focused companion.
