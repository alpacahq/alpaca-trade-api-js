---
"@alpacahq/alpaca-trade-api": minor
---

Require patched Node.js 22.23.4, 24.22.1, or 26.12.1 and drop end-of-life Node.js 20. REST and SSE use the runtime's global `fetch()`, which decompresses Brotli, so [CVE-2026-111497](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) is fixed only by upgrading and redeploying Node.js. Upgrading this package does not patch the runtime.
