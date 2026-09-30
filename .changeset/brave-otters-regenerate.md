---
"@alpacahq/alpaca-trade-api": major
---

Regenerate the SDK from the latest Trading and Market Data OpenAPI
specifications.

**Breaking contract updates.** Remove the upstream crypto perpetual-futures and
index-value APIs and their ergonomic helpers. Replace generated order,
option-contract, corporate-announcement, position-close response,
activity-detail, and tokenization-issuer types with their current named
schemas. Adopt corrected asset, option-contract, portfolio-history, and
activity field types, including optional options-activity `groupId` values, the
new `REO` reorganization code, the clarified `REORG`/`WRM` worthless-removal
classification, and null-safe required primitive arrays.

**New APIs and streaming.** Add Travel Rule VASP/update operations,
tokenization-mint `idempotencyKey` support, and corporate-actions SSE. Replace
broken buffered SSE array methods with typed, cancellable, resumable async
streams, and add first-class `trading.subscribeActivities` and
`marketData.subscribeCorporateActions` facade helpers with refreshable OAuth
providers.

**Reliability and migration support.** Bound asynchronous REST credential
resolution and request preparation by the configured request timeout and caller
cancellation. Ship a migration index plus a focused 4.x-to-5.0 codemod for safe
generated-contract rewrites and manual-review diagnostics.
