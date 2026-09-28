---
title: "Trading SSE vs WebSocket Parity and SDK Retirement Impact"
publish: false
audience: [sdk-maintainers, trading-api]
purpose: "Assess the SDK impact of the proposed SSE-only Trading API direction and what must precede WebSocket retirement"
last_updated: 2026-09-23
research_date: 2026-09-23
---

# Trading SSE vs WebSocket Parity and SDK Retirement Impact

## Executive summary

**Recommendation: align the SDK roadmap with the RFC's SSE-only target, but do
not retire the trading WebSocket until the new stable SSE surface is public,
validated, and has completed the RFC's migration window.**

The internal
[SSE-only Event Streaming and Trading API WebSocket Deprecation RFC](https://alpaca.atlassian.net/wiki/spaces/ENG/pages/4672585865/RFC+SSE-only+Event+Streaming+and+Trading+API+WebSocket+Deprecation)
states the proposed strategic direction: Alpaca intends the new
`stream.<API-domain>` domains to expose SSE only, intends a stable Trading trade
events route at `/v2/trades`, and intends to deprecate and eventually remove the
Trading WebSocket. It also explicitly treats the Trading WebSocket-to-SSE move
as breaking in protocol, parameters, and data schema.

The RFC does **not** make that target surface available today. It says the
existing Trading trade-events SSE is undocumented and used only by the Go SDK,
and requires the new stable endpoint, public documentation, SDK readiness,
partner migration, and exit criteria before WebSocket shutdown. The repository
confirms that the JavaScript SDK currently has only the WebSocket
implementation.

If this SDK migrates now and removes the WebSocket:

1. It moves ahead of the RFC rollout by replacing an explicitly documented
   Trading API contract with an endpoint that is not yet a published Trading
   API contract.
2. It loses a proven subscription-readiness acknowledgement that currently
   protects `submitAndWait()` from missing fast order updates.
3. It breaks the public `TradingStream extends AlpacaWebSocket` API, including
   lifecycle methods, authentication waits, reconnect hooks, WebSocket-specific
   options, and observable `instanceof` behavior.
4. It exchanges the current tested JSON WebSocket protocol for a deliberately
   different SSE schema and lifecycle whose JavaScript mapping and operational
   behavior have not yet been validated.
5. It gains replay cursors and the RFC's simpler HTTP authentication and
   routing model, but it does **not** remove the `ws` or MessagePack
   dependencies because market-data WebSockets remain.

The SDK should follow the RFC's additive rollout: implement and validate SSE
while the old route remains available, preserve the current `TradingStream`
facade where semantics can honestly be adapted, then deprecate and remove
WebSocket after the stable endpoint, migration guidance, usage criteria, and
safety period exist.

## Scope

This report covers only:

- order and trade updates associated with an Alpaca trading account;
- `TradingStream`, `alpaca.trading.stream()`, and `submitAndWait()` in this SDK;
- the effect of replacing that transport with Server-Sent Events.

It does **not** propose changing stock, crypto, options, or news market-data
WebSockets.

## The current and target streaming surfaces must not be conflated

### 1. Trading API WebSocket: current SDK transport

The documented Trading API stream uses:

- live: `wss://api.alpaca.markets/stream`;
- paper: `wss://paper-api.alpaca.markets/stream`;
- in-band key/secret authentication;
- a `listen` request for the `trade_updates` channel;
- a `listening` acknowledgement;
- messages framed as `{ "stream": "trade_updates", "data": { ... } }`.

It documents the main order lifecycle: routing, fills, partial fills,
cancellation, expiration, replacement, rejection, and uncommon pending or
rejection states.

Source: [Alpaca WebSocket Streaming](https://docs.alpaca.markets/us/docs/websocket-streaming).

The JavaScript SDK implements this protocol in
[`src/streaming/tradingStream.ts`](../../src/streaming/tradingStream.ts).

### 2. Trading API Activity SSE: documented, but not equivalent

The Trading API OpenAPI specification contains:

- live: `GET https://api.alpaca.markets/v2beta1/events/activities`;
- paper: `GET https://paper-api.alpaca.markets/v2beta1/events/activities`;
- `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` authentication;
- replay parameters `since`, `until`, `since_id`, and `until_id`.

This endpoint emits booked financial activities. Its trade-related activity
coverage is limited to fills, corrections, and busts. It intentionally omits
non-fill lifecycle events such as:

- `accepted`;
- `new`;
- `pending_new`;
- `canceled`;
- `expired`;
- `replaced`;
- `rejected`;
- pending cancellation or replacement states.

It also does not embed the complete REST `Order` object. Therefore it cannot
replace the SDK's `trade_updates` stream or support the current
`submitAndWait()` semantics.

Sources:

- [Subscribe to Activity Events](https://docs.alpaca.markets/us/reference/subscribetoactivitiessse)
- [Activity SSE guide](https://docs.alpaca.markets/us/docs/activity-sse)
- [`tooling/specs/trading-api.json`](../../tooling/specs/trading-api.json)

### 3. Existing Trade Events SSE: deployed precursor, not the final RFC route

Alpaca documents `GET /v2/events/trades` with:

- full order lifecycle events;
- full order snapshots;
- ULID `event_id` values;
- historical replay through timestamps or ULID cursors;
- SSE heartbeat and error comments;
- per-account ordering guidance.

However, its published OpenAPI document identifies itself as **Broker API**,
uses `https://broker-api.alpaca.markets` and
`https://broker-api.sandbox.alpaca.markets`, and specifies Basic Auth.

Source: [Subscribe to Trade Events (SSE)](https://docs.alpaca.markets/us/reference/subscribetotradev2sse).

At the same time, Alpaca's official Go Trading API SDK:

- builds `BaseURL + "/v2/events/trades"`;
- uses the normal Trading API live or paper base URL;
- authenticates with Alpaca key headers or OAuth Bearer;
- exposes this as `StreamTradeUpdates`.

Sources:

- [Go SDK `stream.go`](https://github.com/alpacahq/alpaca-trade-api-go/blob/master/alpaca/stream.go)
- [Go SDK trade-update example](https://pkg.go.dev/github.com/alpacahq/alpaca-trade-api-go/v3#readme-trade-updates-stream-example)
- [Go SDK migration from `/v2beta1` to `/v2`](https://github.com/alpacahq/alpaca-trade-api-go/pull/326)

The code and published material support the RFC's statement:

> `/v2/events/trades` is deployed and supported by an official SDK on Trading
> API hosts, but is undocumented for Trading API and currently used only by the
> Go SDK.

### 4. RFC target: stable SSE on a new stream domain

The RFC proposes:

- SSE-only `stream.<API-domain>` hosts;
- a stable Trading trade-events route at `/v2/trades`;
- no `/events` segment and no alpha or beta alias;
- no WebSocket route on the new domains;
- existing API-domain WebSocket and SSE routes retained during migration;
- eventual removal of WebSocket and its in-stream authentication flow;
- public documentation and SDK migration before shutdown.

The RFC's migration table says the move from Trading WebSocket to
`/v2/trades` changes the **protocol, parameters, and data schema**. Therefore
"parity" for this SDK should mean preserving required user workflows and event
coverage through an explicit adapter—not assuming wire-shape identity.

One RFC detail should be reconciled rather than copied into SDK code: its table
calls the legacy Trading WebSocket path `/v2/stream`, while this repository and
the public Trading WebSocket documentation use `/stream`. The rollout inventory
should confirm whether both routes exist and ensure the actual `/stream`
traffic is measured and migrated.

## Parity assessment

| Capability | Trading WebSocket | Existing/target Trade Events SSE | Retirement assessment |
| --- | --- | --- | --- |
| Trading live/paper use | Explicitly documented | Existing route used by Go SDK; stable new-domain route proposed by RFC | **Delivery gate, not a direction gap** |
| Core order events | Documented | Existing Broker SSE documents them; target must be validated | **Likely capability parity** |
| Full REST order snapshot | Documented | Present in existing Broker SSE examples; target schema may differ | **Adapter required** |
| Rare states | Several documented | Broader prose list, but schema enum is inconsistent | **Unverified** |
| Trade corrections/busts | Not clearly catalogued on WS page | Explicitly documented | **Possible SSE gain** |
| Multileg payloads | WebSocket examples include them | SSE examples include them, but schema has errors | **Unverified wire parity** |
| Crypto behavior | WebSocket is current SDK behavior | Target SSE behavior is not yet published | **Unverified** |
| Subscription acknowledgement | Explicit `listening` frame | No equivalent protocol message | **Replace with validated SSE readiness** |
| Unsubscribe/control | Send an empty `listen` set | Abort/close HTTP request | **Different semantics** |
| Replay | None documented | `since` / `since_id` | **SSE gain** |
| Ordering guarantee | Not documented | Per-account guarantee in existing Broker SSE guidance | **Confirm for target route** |
| Duplicate handling | Not documented | Replay may duplicate; idempotency required | **New consumer obligation** |
| Slow-consumer signal | Not documented | Comment says messages were dropped | **SSE gain if handled** |
| Heartbeat | WebSocket ping/pong at transport layer | `:heartbeat` application comments | **Different health model** |
| Authentication | In-band key/secret | RFC requires HTTP-time auth and a browser-compatible option; Go SDK supports key headers/OAuth | **Migration requirement** |
| Latency | Real-time; no numeric SLA | Low-latency; no WS/SSE comparison | **Unknown** |
| Connection limit | Not documented for this stream | Broker FAQ says 25; Trading limit unknown | **Unknown** |
| Replay retention | N/A | Not published for Trading SSE | **Unknown** |
| Deprecation direction | Current public docs do not announce removal | Internal RFC proposes full retirement after an additive migration | **Direction exists; public schedule and exit criteria pending** |

### Event and schema inconsistencies

The current SSE reference is not sufficiently precise to establish full parity:

- prose mentions `held` and `restated`, while the published event enum omits
  one or both;
- `position_qtys` is declared as a string even though multileg examples show a
  symbol-to-quantity object;
- the Go `TradeUpdate` model is permissive and omits fields such as multileg
  `legs`, `position_qtys`, `previous_execution_id`, `reason`, `settle_date`, and
  `swap_rate`;
- successful decoding by the Go SDK therefore does not prove complete wire
  equivalence.

Event types must remain open strings, and raw WebSocket/SSE payloads must be
compared before claiming parity.

## What the SDK loses if it retires trading WebSocket now

### 1. A published Trading API contract if retirement precedes the RFC rollout

This is the largest risk.

The current WebSocket is explicitly described as a Trading API surface. The
full Trade Events SSE is formally described as a Broker API surface, despite
official Go SDK evidence that it is also deployed on Trading API hosts.

The RFC acknowledges this gap and requires the stable endpoint to become a
documented, supported public surface before deprecation. Retiring WebSocket
before that work lands would make the JavaScript SDK depend on:

- a route absent from the Trading API OpenAPI document;
- undocumented Trading-host authentication and authorization behavior;
- undocumented Trading-host event, ordering, replay, and operational
  guarantees;
- no completed public Trading API deprecation window.

This is a sequencing objection, not an objection to the RFC's SSE-only end
state. The SDK should target the new-domain `/v2/trades` contract once it is
available rather than turn the current undocumented `/v2/events/trades` route
into a new long-term public dependency.

### 2. The subscription-readiness guarantee used by `submitAndWait()`

The WebSocket server acknowledges the active channel:

```json
{
  "stream": "listening",
  "data": { "streams": ["trade_updates"] }
}
```

The SDK waits for this exact acknowledgement before posting the order. See
[`src/client.ts`](../../src/client.ts), particularly `submitAndWait()`.

This sequencing protects against:

1. placing an order;
2. receiving a fast terminal event before the stream is ready;
3. waiting forever for an update that was already missed.

SSE has no topic subscription handshake. The acknowledgement is therefore not
preserved literally; it must be replaced with validated HTTP/SSE readiness,
cursor recovery, and the existing REST reconciliation. Readiness should require
a successful `200` response with `text/event-stream`, then either:

- rewrite `submitAndWait()` around an SSE-specific `open` event; or
- synthesize the existing `SUBSCRIPTION` event with `["trade_updates"]`.

Neither is exactly equivalent to a server-confirmed channel subscription, but
that is a compatibility behavior to redesign and test—not a reason to reject
the RFC's SSE target.

### 3. The inherited `AlpacaWebSocket` public API

`TradingStream` currently extends `AlpacaWebSocket`. Consumers inherit:

- `connect()` and `disconnect()`;
- `getState()`;
- `on`, `once`, `off`, `removeListener`, `removeAllListeners`,
  `listenerCount`, and `eventNames`;
- `onConnect`, `onDisconnect`, `onError`, and `onStateChange`;
- `onReconnecting` and `onReconnected`;
- `whenAuthenticated`, `waitForAuthenticationResult`, and
  `waitForAuthentication`.

See:

- [`src/streaming/tradingStream.ts`](../../src/streaming/tradingStream.ts)
- [`src/streaming/websocket.ts`](../../src/streaming/websocket.ts)

Even if the replacement retains the name `TradingStream`, removing inheritance
changes:

- TypeScript assignability;
- `instanceof AlpacaWebSocket`;
- subclass and mocking behavior;
- lifecycle event timing;
- what "authenticated" and "subscribed" mean.

Preserving only `trading.stream()` and `onTradeUpdate()` is not API parity.

### 4. WebSocket-specific configuration

`TradingStreamOptions` currently exposes shared options including:

- `wsFactory`;
- `pingIntervalMs`;
- `pongWaitMs`;
- reconnect limits, backoff, jitter, and delays;
- `callbackExecutor`;
- custom `url`.

`codec` is already omitted from `TradingStreamOptions`, so it is not a
consumer-facing loss.

An SSE client would instead need:

- `fetchApi`;
- an `AbortSignal`;
- initial `sinceId`;
- response-header and idle timeouts;
- parser-buffer limits;
- cursor and retry observability.

Removing or silently ignoring existing options is a TypeScript and behavioral
breaking change.

### 5. Current connection-health semantics

The WebSocket base actively sends ping frames and terminates a connection that
does not answer with pong.

SSE health is different:

- Alpaca may send `:heartbeat`;
- an open but dead HTTP connection can appear healthy;
- the client must track last activity and enforce an idle timeout;
- slow-consumer and internal-error conditions arrive as comments;
- no heartbeat interval or timeout SLA is published for Trading-host SSE.

The replacement must not map ping/pong options directly onto SSE without
documenting the changed meaning.

### 6. Current error and reconnect semantics

The WebSocket currently understands:

- explicit authorization success/failure frames;
- `action: "error"` messages;
- unexpected close;
- automatic reauthentication and resubscription;
- bounded reconnect with exponential backoff and jitter.

SSE requires a new classification:

- terminal HTTP authentication and permission failures;
- retryable network failures, unexpected EOF, `429`, and transient `5xx`;
- `Retry-After`;
- standard SSE `retry:` fields;
- comment-based slow-client and internal-error signals;
- MIME validation;
- cursor selection on reconnect.

The SDK also must distinguish:

- the last event received;
- the last event dispatched;
- the last event durably processed by the application.

An EventEmitter callback provides no durable-processing acknowledgement, so the
SDK cannot safely claim exactly-once or acknowledged replay.

### 7. Mature test coverage

The existing implementation has tests for:

- WebSocket authentication and subscription frames;
- trade-update mapping;
- authorization failure;
- malformed messages;
- subscription acknowledgement;
- reconnect and resubscription;
- real local WebSocket transport;
- `submitAndWait()` sequencing, ambiguity, reconciliation, timeout, and
  ownership behavior;
- facade wiring, capabilities, docs, and examples.

Relevant suites include:

- [`test/streaming.test.ts`](../../test/streaming.test.ts)
- [`test/streaming.transport.test.ts`](../../test/streaming.transport.test.ts)
- [`test/workflows.test.ts`](../../test/workflows.test.ts)
- [`test/client.test.ts`](../../test/client.test.ts)
- [`test/endpoints.trading.test.ts`](../../test/endpoints.trading.test.ts)

There is no equivalent SSE trade-update test suite today. Retiring WebSocket
before building and running one removes a known, tested path in favor of an
untested path.

### 8. A second migration for recently migrated consumers

The v4 migration already moved legacy users from `alpaca.trade_ws` to
`alpaca.trading.stream()`. Removing that API creates another migration for the
same consumers and invalidates current examples and guidance.

Affected artifacts include:

- `MIGRATION.md`;
- the v3-to-v4 codemod documentation;
- `docs/docs/streaming.md`;
- `docs/docs/runtime-compatibility.md`;
- `docs/docs/resilience.md`;
- `docs/docs/trading.md`;
- `examples/trading-bot.ts`;
- `LLMS.md` and the generated Skill;
- API-reference examples and documentation tests.

### 9. No dependency or market-data simplification

Retiring the trading WebSocket does not remove:

- `ws`;
- `@msgpack/msgpack`;
- the shared streaming registry;
- Node `EventEmitter`;
- WebSocket reconnect and lifecycle code.

Market-data streams still need all of them. At most, the shared WebSocket base
could lose its JSON codec branch and the trading-specific event constant.

Therefore dependency reduction is not a justification for this migration.

## What the SDK could gain from SSE

These are meaningful benefits and align with the RFC's platform motivation,
but their exact SDK behavior still depends on the target contract.

### Replay and recovery

`event_id` plus `since_id` can recover updates after a disconnect. The current
WebSocket has no documented replay cursor.

The application must still:

- persist cursors;
- tolerate duplicate replay;
- understand cursor inclusivity;
- reconcile after retention gaps;
- avoid claiming exactly-once delivery.

### HTTP-time authentication and OAuth streaming

The Go SDK authenticates Trading SSE using either Alpaca key headers or OAuth
Bearer. The JavaScript SDK currently discards OAuth-only credentials for
streaming because its WebSocket requires key/secret authentication.

The RFC makes removal of WebSocket-only in-stream authentication explicit and
requires an equivalent browser-compatible SSE path before retirement. The
stable endpoint must therefore document supported key, OAuth, and browser
authentication mechanisms. This Node SDK can send headers with `fetch`, but
its implementation alone does not solve the RFC's broader browser migration:
native browser `EventSource` cannot attach arbitrary authorization headers.

There is also a packaging gap: this package's `browser`, worker, edge, Deno,
and workerd exports currently resolve to the REST-only entrypoint, which throws
for stream factories. If the JavaScript SDK is expected to provide the RFC's
browser migration path, it needs a browser-safe SSE entrypoint or a separately
documented fetch-based client mechanism. That requirement is additive; it does
not imply bringing market-data WebSockets into browser exports.

### Simpler network topology

SSE uses a long-lived HTTP GET and is often easier to pass through HTTP-aware
gateways and proxies than WebSockets. More importantly for the RFC, normal HTTP
semantics simplify distributed gateway accounting, rate limiting, routing, and
observability. The fact that this JavaScript package retains `ws` for market
data does not negate those server-side benefits.

SSE still requires:

- proxy timeout configuration;
- buffering prevention;
- idle detection;
- retry and replay logic.

### Better server-originated operational signals

Alpaca's SSE documentation describes:

- heartbeat comments;
- slow-reader warnings with dropped-message counts;
- internal-server-error comments;
- replay guidance.

These can improve observability if the Trading-host endpoint provides the same
contract.

## Why the generated Activity SSE client cannot be reused

The generated
[`EventsApi.subscribeToActivitiesSSE()`](../../src/trading/apis/EventsApi.ts):

- calls `/v2beta1/events/activities`, not `/v2/events/trades`;
- returns `Promise<Array<ActivityEventV2>>`;
- wraps the response in `JSONApiResponse`;
- waits for the response to end and parses it as ordinary JSON.

The OpenAPI operation itself warns that generated clients may hang on an
open-ended SSE response.

A real implementation must be hand-written outside the generated tree, just
like the existing streaming clients.

## SDK design for the RFC migration

The production implementation should target the RFC's stable new-domain
`/v2/trades` route. The existing Trading-host `/v2/events/trades` route is
useful for early interoperability tests, but should not be baked in as the
long-term default unless the final public contract retains it.

### Transport

Use Node's global `fetch` with an SSE parser rather than native `EventSource`.

Reasons:

- the package supports all Node 20 releases, while global `EventSource` arrived
  only in later Node 20 and remains experimental;
- standard `EventSource` cannot set Alpaca's authentication headers;
- fetch supports headers, `AbortSignal`, response validation, injected test
  transports, and SDK-controlled retries;
- a standards-compliant parser handles chunk boundaries, multiline `data:`,
  comments, `id:`, and `retry:`.

An implementation based on `eventsource-parser` is a reasonable candidate;
this is an implementation recommendation, not an Alpaca requirement.

Sources:

- [Node 20 `EventSource`](https://nodejs.org/download/release/v20.19.0/docs/api/globals.html#eventsource)
- [Node 20 `fetch`](https://nodejs.org/docs/latest-v20.x/api/globals.html#fetch)
- [MDN `EventSource` constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)
- [WHATWG Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [`eventsource-parser`](https://github.com/rexxars/eventsource-parser)

### Compatibility facade

To minimize migration cost:

- retain `TradingStream`;
- retain `trading.stream()`;
- retain `subscribeTradeUpdates()` and `onTradeUpdate()`;
- retain EventEmitter methods and common lifecycle callbacks;
- treat a validated `200 text/event-stream` response as connected and
  authenticated;
- synthesize the existing subscription event only if its changed meaning is
  clearly documented;
- preserve `TradeUpdate` and `TradeUpdateEvent` as the public compatibility
  model where the new schema can be mapped without losing meaning;
- add a dedicated SSE wire mapper rather than assuming the existing
  `mapTradeUpdate()` input shape;
- add typed `at`, `eventId`, correction, reason, and multileg fields while
  preserving unknown-field passthrough.

The dedicated mapper is required because the RFC explicitly identifies the
WebSocket-to-SSE data schema as breaking. This still changes inheritance and
WebSocket-specific options, so it should not be represented as a completely
transparent transport swap.

### Reliability requirements

The SSE transport should:

1. send `Accept: text/event-stream`;
2. send the confirmed Alpaca authentication headers;
3. reject off-origin redirects to avoid forwarding credentials;
4. require HTTP `200` and validate `Content-Type`;
5. use separate header-connect and idle timers, not an overall request timeout;
6. abort the active fetch on `disconnect()`;
7. parse and surface heartbeat, slow-client, and server-error comments;
8. reconnect with bounded exponential backoff and jitter;
9. respect `Retry-After` and valid SSE `retry:` values;
10. reconnect with the documented Alpaca cursor;
11. expose the JSON `event_id` and not assume it equals a standard SSE `id:`;
12. tolerate duplicates and unknown event names;
13. preserve callback ordering under the default synchronous executor;
14. cap parser buffers and contain malformed events.

### `submitAndWait()` requirements

Before posting an order:

1. attach trade-update, readiness, and error listeners;
2. open the SSE request;
3. receive and validate the successful response headers and mark the stream
   ready;
4. only then place the order.

After placement, retain the current ambiguous-placement reconciliation logic.
The SSE cursor can improve recovery, but it does not remove the need for REST
reconciliation because:

- cursor retention is unknown;
- callbacks do not acknowledge durable processing;
- delivery semantics are not formally guaranteed.

## Semver assessment

### Major change

Retiring WebSocket is a major change if the release:

- removes `TradingStream`;
- removes or renames `trading.stream()`;
- removes `subscribeTradeUpdates()` or `onTradeUpdate()`;
- changes `SubmitAndWaitOptions.stream`;
- removes WebSocket-specific options;
- breaks `TradingStream instanceof AlpacaWebSocket`;
- changes lifecycle or readiness semantics without compatibility behavior.

### Minor, additive preparation

Adding a separate SSE transport while retaining WebSocket can be minor:

- `trading.tradeEvents()` or an explicit transport option, initially against
  the new stable route when available;
- new SSE cursor and heartbeat options;
- new typed fields on `TradeUpdate`;
- OAuth support where confirmed.

### Compatibility-wrapper caveat

Keeping all names while switching the implementation to SSE reduces source
changes but does not eliminate behavioral and type changes. It should still be
treated conservatively unless the previous options and lifecycle contract are
preserved or formally deprecated first.

## Required validation before WebSocket retirement

Consistent with the RFC rollout, run the legacy WebSocket and the new-domain
SSE route concurrently against the same live and paper accounts, preserving raw
messages. The existing `/v2/events/trades` route can provide an additional
baseline but is not a substitute for validating the final `/v2/trades` route.

### Endpoint and authentication

- final live and paper `stream.<API-domain>/v2/trades` URLs;
- API key headers on live and paper stream domains;
- OAuth Bearer on live and paper stream domains;
- the RFC-required browser-compatible authenticated client path;
- wrong-environment credentials;
- authentication failure status and body;
- response `Content-Type`;
- redirect behavior.

### Event corpus

- equity market and limit orders;
- partial and complete fills;
- cancel and replace;
- asynchronous rejection;
- expiration and `done_for_day`;
- trailing-stop orders;
- bracket, OCO, and OTO child states;
- simple options and multileg options;
- crypto market, limit, and stop-limit orders;
- cancel/replace rejection races;
- Alpaca-assisted fixtures for correction, bust, suspension, restatement, and
  rare lifecycle states.

### Payload comparison

- `event`, `event_id`, `at`, and `timestamp`;
- complete `order` snapshot;
- `execution_id` and `previous_execution_id`;
- `price`, `qty`, and `position_qty`;
- `reason`, `settle_date`, and `swap_rate`;
- multileg `legs` and `position_qtys`;
- account scoping and presence or absence of `account_id`.

### Recovery and operations

- reconnect from `since_id`;
- cursor inclusivity and duplicate behavior;
- multiple events within the same millisecond;
- replay/live handoff;
- replay retention boundary;
- ordering before and after reconnect;
- heartbeat format and cadence;
- stalled-reader warning and recovery;
- idle and half-open connections;
- concurrent-connection limits;
- `429` and retry headers;
- WebSocket versus SSE p50/p95/p99 delivery latency;
- long-running behavior across open, close, overnight, and weekends.

## Decision gates

Retire the WebSocket only when all of the following are true:

1. The RFC direction, final stream domains, stable version, and path names are
   approved; the `/stream` versus `/v2/stream` legacy-path discrepancy is
   reconciled.
2. The new-domain `/v2/trades` route is deployed for live and paper and
   published as a supported Trading API contract.
3. API key, OAuth, and browser-compatible authentication paths are documented.
4. The target event/payload schema and migration mapping are published; no
   assumption of WebSocket wire-schema parity remains.
5. Replay inclusivity, retention, ordering, heartbeat, connection limits, and
   latency expectations are known.
6. Side-by-side tests demonstrate no unexplained event gaps across supported
   asset classes and order types.
7. `submitAndWait()` passes equivalent race, ambiguity, timeout, and
   reconciliation tests.
8. SDKs, examples, and public migration guidance are released, and JavaScript
   users receive an additive SSE/deprecation period before removal.
9. OAuth/Connect partner usage is attributable and the RFC's usage and
   partner-readiness exit criteria pass.
10. The legacy route remains available through the agreed rollback safety
    period; migration does not depend on HTTP redirects.

## Recommended rollout

### Phase 1: additive SSE and baseline

- Confirm the final new-domain URL and schema.
- Add a hand-written SSE trading client against `/v2/trades`.
- Keep the existing WebSocket as the default.
- Expose raw cursor and transport diagnostics.
- Run parity tests and production canaries.
- Inventory usage and identify affected OAuth/Connect partners.

### Phase 2: preferred SSE

- Make SSE the recommended/default transport after contract and production
  validation.
- Keep WebSocket as an explicit fallback only through the announced migration
  and rollback window.
- Deprecate WebSocket-specific trading options.
- Publish migration guidance and monitor legacy traffic through the announced
  compatibility period.

### Phase 3: retirement

- Remove the trading WebSocket entry points in a major release only after the
  RFC exit criteria pass.
- Keep market-data WebSockets unchanged.
- Preserve the SDK's `TradeUpdate` compatibility model through an explicit SSE
  adapter where semantics permit; document fields that cannot be preserved.
- Retain REST reconciliation in `submitAndWait()`.
- Retain legacy deployment/routing for the agreed rollback safety period before
  final infrastructure removal.

## Final conclusion

The RFC makes the proposed end state clear: the Trading API should move to SSE
on a stable new stream domain, and the legacy Trading WebSocket should
eventually be retired. This report supports that direction, subject to RFC
approval and the rollout gates below.

The current SDK evidence changes the implementation and sequencing details:
`TradingStream` is a substantial public WebSocket API, `submitAndWait()` relies
on a server subscription acknowledgement, the RFC says the SSE data schema is
different, and the stable `/v2/trades` route does not yet exist in this
repository's generated Trading API contract.

Therefore the correct SDK action is not to resist SSE, and not to remove
WebSocket immediately. It is to implement the RFC's additive SSE phase, build
an explicit compatibility adapter and new readiness semantics, validate both
transports side by side, then deprecate and remove WebSocket in a major release
after documentation, partner migration, traffic, and rollback gates pass.

## Sources

### Alpaca

- [RFC: SSE-only Event Streaming and Trading API WebSocket Deprecation](https://alpaca.atlassian.net/wiki/spaces/ENG/pages/4672585865/RFC+SSE-only+Event+Streaming+and+Trading+API+WebSocket+Deprecation)
- [WebSocket Streaming](https://docs.alpaca.markets/us/docs/websocket-streaming)
- [Subscribe to Trade Events SSE](https://docs.alpaca.markets/us/reference/subscribetotradev2sse)
- [SSE Events overview](https://docs.alpaca.markets/us/docs/sse-events)
- [Subscribe to Activity Events SSE](https://docs.alpaca.markets/us/reference/subscribetoactivitiessse)
- [Activity SSE guide](https://docs.alpaca.markets/us/docs/activity-sse)
- [Broker API FAQ](https://docs.alpaca.markets/us/docs/broker-api-faq)
- [Go Trading SDK SSE implementation](https://github.com/alpacahq/alpaca-trade-api-go/blob/master/alpaca/stream.go)
- [Go Trading SDK TradeUpdate model](https://github.com/alpacahq/alpaca-trade-api-go/blob/master/alpaca/entities.go)
- [Go SDK `/v2` migration](https://github.com/alpacahq/alpaca-trade-api-go/pull/326)
- [Legacy Broker v1 Trade Events removal](https://docs.alpaca.markets/us/changelog/2026-08-03-trade-events-adc57be)

### Runtime and protocol

- [Node.js 20 global APIs](https://nodejs.org/download/release/v20.19.0/docs/api/globals.html)
- [MDN `EventSource` constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)
- [WHATWG Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [`eventsource-parser`](https://github.com/rexxars/eventsource-parser)

### SDK implementation

- [`src/streaming/tradingStream.ts`](../../src/streaming/tradingStream.ts)
- [`src/streaming/websocket.ts`](../../src/streaming/websocket.ts)
- [`src/streaming/types.ts`](../../src/streaming/types.ts)
- [`src/client.ts`](../../src/client.ts)
- [`src/streamingRegistry.ts`](../../src/streamingRegistry.ts)
- [`src/capabilities.ts`](../../src/capabilities.ts)
- [`src/trading/apis/EventsApi.ts`](../../src/trading/apis/EventsApi.ts)
- [`tooling/specs/trading-api.json`](../../tooling/specs/trading-api.json)
- [`package.json`](../../package.json)

## Confidence and limitations

- **High confidence:** current SDK architecture, public API impact, Activity SSE
  non-parity, generated-client limitation, and continued market-data dependency
  on WebSockets.
- **High confidence about direction, not delivery:** the RFC proposes SSE-only
  new stream domains, stable `/v2/trades`, additive migration, and eventual
  WebSocket retirement.
- **Medium confidence:** ordinary order-event overlap between Trading WebSocket
  and the existing Trading-host `/v2/events/trades`, based on the official Go
  SDK and Broker schema.
- **Low confidence until the target route is published and authenticated
  testing is complete:** final new-domain wire schema, rare events, operational
  limits, replay retention, ordering guarantees, browser authentication, and
  latency parity.

No authenticated live or paper requests were made during this research, and no
decrypted or private credentials were accessed.
