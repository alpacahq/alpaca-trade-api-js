# Migration guide: `4.x` → `5.0`

Version 5 adopts Alpaca's latest Trading and Market Data OpenAPI documents.
The upstream documents removed public endpoints and replaced several anonymous
generated models with named schemas, so this is a major SDK release.

> Still using 3.x? Complete the
> [3.x → 4.0 migration](MIGRATION.md) first. The
> [migration guide index](MIGRATIONS.md) describes the supported upgrade paths.

Install the new major:

```bash
npm install @alpacahq/alpaca-trade-api@^5
```

## Automated migration helper

The [`alpaca-v4-to-v5.js`](codemods/alpaca-v4-to-v5.js) codemod applies safe
generated-contract renames and adds review diagnostics for semantic changes:

```bash
# TypeScript
npx jscodeshift \
  -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v4-to-v5.js \
  --parser=tsx --extensions=ts,tsx,mts,cts src

# JavaScript
npx jscodeshift \
  -t ./node_modules/@alpacahq/alpaca-trade-api/codemods/alpaca-v4-to-v5.js \
  --parser=babel --extensions=js,jsx,mjs,cjs src
```

Run it on a clean version-control branch and review the resulting diff and
jscodeshift report. The transform does not silently rewrite removed APIs, SSE
control flow, `REORG`/`REO` semantics, or Trading dividend flag comparisons.
See the [codemod reference](codemods/README.md) for its exact scope.

Applications that receive an Alpaca client through dependency injection can
register its exact lexical name with `--instanceName=client` (comma-separate
multiple names). Each requested name must resolve to exactly one lexical binding
in a source file. This opt-in includes function parameters and stable aliases,
but ignores reassigned, shadowed, or otherwise ambiguous bindings. A variable
merely named `alpaca` is not trusted without the option or a proven SDK
constructor.

JavaScript users must also manually audit response consumers because untyped
data flow cannot always prove that a property came from this SDK. In particular,
search for and review:

- `CorporateAnnouncement` date string operations and the removed
  `corporateActionsId` / `expirationDate` fields;
- `Assets.easyToBorrow`, replacing it with an appropriate `borrowStatus`
  comparison;
- truthiness checks on Trading dividend `foreign` / `special` string flags.

TypeScript reports these response-shape changes through compiler diagnostics.
The codemod deliberately does not match property names globally because that
would modify unrelated application objects.

Required non-nullable primitive arrays now receive the same defensive
deserialization as model arrays: an upstream `null` or missing value becomes
`[]` instead of leaking `null` through a non-nullable TypeScript field. This
only changes malformed responses that contradict their OpenAPI requirement.

## Removed upstream endpoints

The Market Data specification no longer publishes the crypto perpetual-futures
or index-value endpoints. Version 5 therefore removes:

- `alpaca.marketData.cryptoPerpetualFutures` (also available through the
  `alpaca.data` alias in v4) and
  `marketData.CryptoPerpetualFuturesApi`;
- `alpaca.marketData.indices` (also available through `alpaca.data`) and
  `marketData.IndexApi`;
- `getIndexValues`, `iterateIndexValues`, and
  `collectIndexValuesBySymbol`;
- generated `indexValues` / `indexLatestValues` and their `Raw` siblings;
- generated `cryptoPerpLatestBars`, `cryptoPerpLatestFuturesPricing`,
  `cryptoPerpLatestOrderbooks`, `cryptoPerpLatestQuotes`,
  `cryptoPerpLatestTrades`, and their `Raw` siblings;
- the canonical `IndexValue`, `toIndexValue`, and
  `toIndexValuesBySymbol` exports;
- the generated `marketData.IndexValue` model and its
  `IndexValueFromJSON`, `IndexValueFromJSONTyped`, `IndexValueToJSON`,
  `IndexValueToJSONTyped`, and `instanceOfIndexValue` runtime helpers;
- the generated `CryptoPerpFuturesPricing`,
  `CryptoPerpLatestFuturesPricingResp`, `CryptoPerpLoc`,
  `IndexLatestValuesResp`, and `IndexValuesResp` models and their
  `FromJSON`, `FromJSONTyped`, `ToJSON`, `ToJSONTyped`, and `instanceOf*`
  runtime helpers.

These endpoints were removed upstream rather than relocated; continuing to call
them on version 4 results in server errors.

## Generated trading model renames

Order creation now uses the named `CreateOrderRequest` schema:

```ts
await alpaca.trading.orders.postOrder({
  createOrderRequest: {
    symbol: "AAPL",
    qty: "1",
    side: "buy",
    type: "market",
    timeInForce: "day",
  },
});
```

Replace `PostOrderRequest`, `PostOrderRequestTakeProfit`, and
`PostOrderRequestStopLoss` model references with `CreateOrderRequest`,
`CreateOrderRequestTakeProfit`, and `CreateOrderRequestStopLoss`. The ergonomic
order builders (`market`, `limit`, `bracket`, and the other order helpers) keep
their existing call signatures.

Do not confuse the removed body model with the generated operation wrapper:
`trading.PostOrderRequest` still exists as the argument type for
`orders.postOrder(...)`, and now contains a `createOrderRequest` property whose
value is the renamed body model.

If you explicitly imported the generated operation wrapper, replace the v4
`PostOrderOperationRequest` type with v5 `PostOrderRequest`, and replace its
`postOrderRequest` property with `createOrderRequest`. In other words:

- v4 wrapper: `PostOrderOperationRequest`, containing
  `postOrderRequest: PostOrderRequest`;
- v5 wrapper: `PostOrderRequest`, containing
  `createOrderRequest: CreateOrderRequest`.

Response models also received stable upstream names:

- `GetOptionsContracts200Response` → `OptionContractsResponse`;
- `GetV2CorporateActionsAnnouncements200ResponseInner` and
  `GetV2CorporateActionsAnnouncementsId200Response` →
  `CorporateAnnouncement`;
- `PositionClosedReponse` → `PositionClosedResponse`.

The position-close rename only corrects the generated TypeScript name; the
`closeAllPositions()` response payload and runtime behavior are unchanged. The
codemod updates the model name and its generated JSON conversion and type-guard
helpers.

`CorporateAnnouncement` also adopts the current upstream field contract; this
is not only a type rename:

- `declarationDate`, `exDate`, `payableDate`, and `recordDate` are now `Date`
  values instead of strings;
- `caType` is now the `CorporateActionCaType` union rather than an arbitrary
  string;
- use `corporateActionId` instead of the removed `corporateActionsId`;
- `expirationDate` was removed, while `effectiveDate?: Date` was added.

Update string-only date handling such as `slice()` or direct serialization. To
send a date elsewhere, format it explicitly (for example,
`announcement.effectiveDate?.toISOString()`). Although announcement responses
preserve unknown wire fields for forward compatibility, raw snake-case fields
are not replacements for the removed camel-case properties.

## Other generated contract changes

- `getV2CorporateActionsAnnouncements({ caTypes })` now takes a
  `CorporateActionCaType[]` (for example, `["Dividend"]`) instead of one
  untyped string. The codemod splits comma-delimited literals such as
  `"Dividend,Merger"` into `["Dividend", "Merger"]` and canonicalizes known
  casing; dynamic, empty, or unknown values are left with a review TODO.
- `Assets.easyToBorrow` was removed upstream; use `borrowStatus`.
- `OptionContract.ppind` is now required.
- `PortfolioHistory.baseValue` and entries in `equity`, `profitLoss`, and
  `profitLossPct` can be `null`; `cashflow` is now typed as a map of numeric
  arrays.
- The `foreign` and `special` fields on cash-dividend activity models are typed
  as the wire strings `"true"` / `"false"` rather than booleans, matching what
  the API already returns.
- `groupId` is now optional on options activity models; handle `undefined` when
  grouping related activities.
- `ActivityV2DetailNTA` is now a union of the concrete activity-detail models
  instead of an unstructured interface.
- `GetTokenizationRequestsIssuerEnum` was replaced by the shared
  `TokenizationIssuer` model.

### String-valued dividend flags

Version 5 corrects the generated declarations for Trading activity details to
match the existing API wire format; it does not convert these flags from
booleans at runtime. Both non-empty strings are truthy in JavaScript, so do not
use `if (details.foreign)`, `if (details.special)`, or
`Boolean(details.foreign)`. Compare the value explicitly after narrowing the
activity detail:

```ts
const isForeign = details.foreign === "true";
const isSpecial = details.special === "true";
```

This applies to Trading cash-dividend and substitute-payment activity details.
Market Data corporate-action models continue to expose their `foreign` and
`special` fields as booleans.

### Narrowing activity details

Version 4 exposed non-trade activity `details` as an unstructured interface.
Version 5 preserves each concrete detail shape in a union, so narrow it before
reading variant-specific fields. The parent `activityType` describes the wire
event, but TypeScript does not automatically correlate that string with the
separate `details` union; combine the semantic check with a generated guard:

```ts
import { trading } from "@alpacahq/alpaca-trade-api";

if (
  event.activityType === "OPTRD" &&
  trading.instanceOfOPTRDActivityV2(event.details)
) {
  console.log(event.details.symbol);
  console.log(event.details.groupId ?? "ungrouped");
}
```

The generated `instanceOf...` functions are exported for every concrete detail
model. Avoid an unchecked cast when processing externally supplied event data.

### New `REO` activity code and clarified `REORG` meaning

Version 5 adopts the upstream `REO` activity code for reorganizations. The
previous specification described `REORG` generically as "Reorg CA", but already
listed `WRM` (worthless removal) as its only subtype and exposed a corresponding
worthless-removal detail model. The updated contract makes that distinction
explicit:

- `REO` represents a reorganization (`ActivityType.Reo`);
- `REORG` remains the code for a worthless-removal corporate action
  (`ActivityType.Reorg`).

Update switches, filters, persisted mappings, and analytics that interpret
activity-type strings according to their intent:

- use `"REO"` for newly classified reorganization events;
- retain `"REORG"` for worthless removals, normally with subtype `"WRM"`;
- include both when the application handles the broader family of corporate
  actions.

Do not mechanically rewrite persisted historical `"REORG"` values to `"REO"`;
inspect their subtype and meaning. The generated `ActivityType.Reorg` property
still resolves to the `"REORG"` wire value, while `ActivityType.Reo` resolves to
`"REO"`.

## Added API coverage

Version 5 adds Trading API methods `searchVASPs` and
`updateWhitelistedAddressTravelRuleInfo` under `trading.cryptoFunding`, plus
`subscribeToCorporateActionsEventsSSE` under
`marketData.corporateActions`.

`TravelRuleInfo` requires both a destination (`beneficiaryVaspId`,
`beneficiaryIsSelfHosted: true`, or `beneficiaryManualEntry`) and an identity
(`beneficiaryEntityName`, or both `beneficiaryGivenName` and
`beneficiaryFamilyName`). TypeScript enforces these combinations, and runtime
serialization rejects incomplete JavaScript payloads before sending them.

## Generated SSE now returns a live stream

In version 4, `subscribeToActivitiesSSE()` was generated as
`Promise<ActivityEventV2[]>`. That signature was not functional for a live
`text/event-stream`: it buffered forever, attempted JSON-array parsing, and
inherited the ordinary request deadline.

Version 5 replaces it with `Promise<SseSubscription<ActivityEventV2>>`; the new
corporate-actions SSE method uses the same shape. Prefer the short facade
helpers for application code:

```ts
const events = await alpaca.trading.subscribeActivities();

try {
  for await (const event of events) {
    console.log(event.activityType, event.details);
  }
} finally {
  events.close();
}
```

The corresponding corporate-action helper is
`alpaca.marketData.subscribeCorporateActions()`. Both delegate to the raw
generated methods, which remain available as
`trading.events.subscribeToActivitiesSSE()` and
`marketData.corporateActions.subscribeToCorporateActionsEventsSSE()`.

The generated `*Raw` siblings now return `SSEApiResponse<T>` rather than
`JSONApiResponse<T[]>`.

The second argument is now `SseOptions`. Plain `RequestInit` fields remain valid
at the top level for source compatibility, while new code can group them under
`requestInit`:

```ts
await alpaca.trading.subscribeActivities(
  {},
  {
    signal: controller.signal,
    requestInit: {
      headers: { "X-Correlation-ID": correlationId },
    },
  },
);
```

Nested `requestInit` values override duplicate top-level `RequestInit` fields,
except for `signal`: when both locations provide an `AbortSignal`, either signal
cancels the subscription. Prefer supplying one signal unless intentionally
combining independent cancellation sources.

The former `InitOverrideFunction` form is not supported for SSE; use
`requestInit` or middleware `pre` instead. SSE runs middleware `pre` and
`onError`, but not `post`, because cloning a long-lived response can buffer or
stall its body.

Live subscriptions reconnect by default and resume with `Last-Event-ID`; finite
`until` / `untilId` queries do not reconnect. The initial open is limited to two
retries by default; established live streams continue reconnecting unless you
set `maxAttempts` / `maxElapsedMs`. Replays may include the last event again, so
deduplicate side effects by event id. Pass an `AbortSignal`, `reconnect: false`,
or reconnect limits when you need explicit lifecycle bounds. For a successful
200/204 connection, the configured `timeoutMs` ends after validated response
headers and does not bound the live body. For non-2xx responses, it remains
active while the SDK reads the bounded error body for a typed `ApiError`.
`connectTimeoutMs` overrides this deadline per subscription, and `0` disables
it. Opt into `idleTimeoutMs` or `maxDurationMs` to limit the live body.
Subscriptions are single-consumer; call `close()` if you open one but never
start iteration.

Fetch-based SSE accepts the same key/secret or OAuth credentials as REST.
Unlike WebSocket streams, it can use an OAuth-only client. Version 5 also
accepts a Promise or function-backed `accessToken` on the `Alpaca` facade; a
provider is evaluated before every REST request and SSE reconnect so expiring
tokens can be refreshed. HTTP `401` and `403` responses are terminal and do not
cause a reconnect loop.
