/**
 * Unified, ergonomic top-level client for the Alpaca SDK.
 *
 * The generated SDK ships ~16 trading and ~11 market-data `Api` classes, each
 * of which must be constructed with its own `Configuration`. Wiring those by
 * hand is tedious and error-prone. `Alpaca` bundles them behind a single
 * constructor that takes credentials once and lazily exposes every sub-API
 * (plus the WebSocket streaming clients) through two grouped namespaces:
 *
 *   - `alpaca.trading.*`     – orders, positions, account, assets, …
 *   - `alpaca.marketData.*`  – stocks, crypto, news, screener, …
 *
 * The two groups mirror the package's `trading` / `marketData` split, which
 * also avoids the `CorporateActionsApi` name collision present in both trees.
 *
 * This module is hand-written and lives outside the generated `apis/`/`models/`
 * trees, which are kept untouched as a faithful snapshot of the OpenAPI spec.
 *
 * @example
 * ```ts
 * import { Alpaca } from "@alpacahq/alpaca-trade-api";
 *
 * const alpaca = new Alpaca({ keyId, secret, paper: true });
 *
 * await alpaca.trading.orders.market({ symbol: "AAPL", qty: 1, side: "buy" });
 * await alpaca.marketData.stocks.stockBars({ symbols: "AAPL" });
 *
 * const updates = alpaca.trading.stream();
 * updates.onTradeUpdate((u) => console.log(u.event));
 * updates.connect();
 *
 * const bars = alpaca.marketData.stockStream({ feed: "iex" });
 * bars.onBar((b) => console.log(b.symbol, b.close));
 * bars.connect();
 * ```
 */
import type { AlpacaCredentials, ResolvedCredentials } from "./auth";
import { resolveCredentials } from "./auth";
import { ApiError, FetchError } from "./errors";
import * as trading from "./trading";
import * as marketData from "./market-data";
// `streaming` is imported for TYPES ONLY (erased at build time) so the REST
// facade carries no static dependency on `ws`/`@msgpack/msgpack`. The runtime
// implementation is fetched lazily via the registry, which the `streaming`
// module populates when it is loaded (always so for the main entrypoint).
import type * as streaming from "./streaming";
import { getStreaming } from "./streamingRegistry";
import * as pagination from "./pagination";
import * as orders from "./orders";
import * as values from "./values";
import * as marketDataShapes from "./marketDataShapes";

/**
 * Live trading host. Paper trading uses the package default (`paper-api`).
 *
 * Re-exported from the trading runtime so there is a single source of truth.
 */
export const LIVE_TRADING_BASE_PATH = trading.TRADING_LIVE_HOST;

/** Values accepted by {@link AlpacaClientOptions.credentials}. */
export type AlpacaRequestCredentials = "omit" | "same-origin" | "include";

/** Values accepted by {@link AlpacaClientOptions.redirect}. */
export type AlpacaRequestRedirect = "error" | "follow" | "manual";

/**
 * Options accepted by the top-level {@link Alpaca} client.
 *
 * Provide credentials as either an API `keyId`/`secret` pair or an OAuth
 * `accessToken`. Any of them may be omitted and resolved from the standard
 * Alpaca environment variables (`APCA_API_KEY_ID`, `APCA_API_SECRET_KEY`,
 * `APCA_API_OAUTH_TOKEN`). A non-empty explicit token selects OAuth; otherwise
 * any non-empty explicit key field selects key authentication ahead of an
 * environment token. Empty strings are treated as absent. With no explicit
 * scheme, environment OAuth takes precedence over environment keys. Every
 * other field is an optional passthrough shared by both the trading and
 * market-data REST configurations.
 */
export interface AlpacaClientOptions {
    /** API key id, or set `APCA_API_KEY_ID`. Pair with {@link secret}. */
    keyId?: string;
    /** API secret, or set `APCA_API_SECRET_KEY`. Pair with {@link keyId}. */
    secret?: string;
    /**
     * OAuth2 access token sent as `Authorization: Bearer <token>` (or set
     * `APCA_API_OAUTH_TOKEN`). An explicitly passed token takes precedence over
     * key credentials for REST requests. Note: the real-time streaming
     * endpoints authenticate with a key/secret pair, so OAuth-only clients
     * cannot open WebSocket streams.
     */
    accessToken?: string;
    /**
     * Use the paper-trading environment. Defaults to `true`.
     *
     * Affects the trading REST host (`paper-api` vs `api`) and the default
     * trading-updates stream endpoint. Market data uses the same host
     * (`data.alpaca.markets`) regardless of this flag.
     */
    paper?: boolean;
    /**
     * Use the market-data **sandbox** host (`data.sandbox.alpaca.markets` and
     * `stream.data.sandbox.alpaca.markets`). Defaults to `false`. Affects only
     * market data; the trading host is selected by {@link paper}.
     */
    sandbox?: boolean;
    /** Per-request timeout in ms; aborts the fetch when exceeded. Defaults to 30s; pass `0` to disable. */
    timeoutMs?: number;
    /**
     * Automatic retry/backoff policy. The facade enables a safe default
     * (3 attempts = 1 initial + 2 retries, exponential `250ms`..`5s` backoff with
     * `±20%` jitter, on the safe/idempotent verbs only) so transient `5xx`/`429`/
     * network blips recover transparently. Pass a {@link trading.RetryConfig} to
     * tune it, or `false` to disable retries entirely.
     */
    retry?: trading.RetryConfig | false;
    /**
     * Proactive client-side rate limiting. The facade enables a safe default
     * (~200 requests/minute, applied independently to the trading and
     * market-data hosts) so burst workloads self-throttle instead of relying on
     * 429 retries. Pass a {@link trading.RateLimitConfig} to tune it, or `false`
     * to disable it entirely.
     */
    rateLimit?: trading.RateLimitConfig | false;
    /** Override the default `User-Agent` header (set to `""` to disable). */
    userAgent?: string;
    /** Override the `fetch` implementation (useful for tests/polyfills). */
    fetchApi?: trading.FetchAPI;
    /** Middleware applied before/after every REST request. */
    middleware?: trading.Middleware[];
    /** Headers sent on every REST request. */
    headers?: trading.HTTPHeaders;
    /** Value for the `credentials` option on every REST request. */
    credentials?: AlpacaRequestCredentials;
    /**
     * How `fetch` treats 3xx redirects. Defaults to `"error"` — Alpaca's APIs
     * never redirect, and following one off-host would forward the
     * `APCA-API-*` secret headers to the redirect target. Set `"follow"` to opt
     * back into the platform default (e.g. behind a redirecting proxy).
     */
    redirect?: AlpacaRequestRedirect;
}

/** REST configuration fields shared by both sub-clients. */
type SharedRestConfig = Pick<
    trading.ConfigurationParameters,
    | "keyId"
    | "secret"
    | "accessToken"
    | "sandbox"
    | "timeoutMs"
    | "retry"
    | "rateLimit"
    | "userAgent"
    | "fetchApi"
    | "middleware"
    | "headers"
    | "credentials"
    | "redirect"
>;

/**
 * Safe default rate limit applied by the facade when the caller doesn't opt
 * out. Roughly mirrors Alpaca's ~200 req/min ceiling; each sub-client builds
 * its own limiter from these values, so trading and market data are throttled
 * independently.
 */
export const DEFAULT_RATE_LIMIT: trading.RateLimitConfig = {
    maxRequests: 200,
    intervalMs: 60_000,
};

/**
 * Safe default retry policy applied by the facade when the caller doesn't opt
 * out. `maxRetries: 2` yields 3 attempts (1 initial + 2 retries) per the SDK
 * spec; the remaining knobs (250ms..5s exponential backoff, ±20% jitter, the
 * retryable status set, safe-verbs-only gating) come from the transport
 * defaults. Pass `retry: false` to disable, or a partial config to override
 * individual fields.
 */
export const DEFAULT_RETRY: trading.RetryConfig = {
    maxRetries: 2,
};

function sharedRestConfig(options: AlpacaClientOptions, creds: ResolvedCredentials): SharedRestConfig {
    return {
        // Resolved (env-fallback + OAuth precedence): exactly one scheme is set,
        // so we never send both the key headers and a bearer token.
        keyId: creds.keyId,
        secret: creds.secret,
        accessToken: creds.accessToken,
        sandbox: options.sandbox,
        timeoutMs: options.timeoutMs,
        // Default-on (3 attempts), but `retry: false` opts out and an explicit
        // (possibly partial) config overrides individual fields.
        retry: options.retry === false ? undefined : { ...DEFAULT_RETRY, ...options.retry },
        // Default-on, but `rateLimit: false` opts out and an explicit config tunes it.
        rateLimit: options.rateLimit === false ? undefined : options.rateLimit ?? DEFAULT_RATE_LIMIT,
        userAgent: options.userAgent,
        fetchApi: options.fetchApi,
        middleware: options.middleware,
        headers: options.headers,
        credentials: options.credentials,
        redirect: options.redirect,
    };
}

/**
 * The generated {@link trading.OrdersApi} plus ergonomic order builders.
 *
 * Illustrates the SDK's two-layer model on one class: it *inherits* every
 * generated method (`postOrder`, `getAllOrders`, `deleteOrderByOrderID`, ...)
 * unchanged (layer 1, always available), and *adds* one ergonomic builder per
 * common order kind (layer 2) that drops the `postOrder({ postOrderRequest })`
 * wrapper, accepts `number | string` amounts, and requires the fields each kind
 * needs at compile time (see {@link orders}). Each returns the created
 * {@link trading.Order}. The additive builders never hide the raw `postOrder`;
 * they are enumerated under `trading.orders` in `ergonomicCapabilities`.
 *
 * @example
 * ```ts
 * await alpaca.trading.orders.market({ symbol: "AAPL", qty: 1, side: "buy" });
 * await alpaca.trading.orders.limit({ symbol: "AAPL", qty: 1, side: "buy", limitPrice: 150 });
 * ```
 */
/**
 * Refined input for {@link OrdersApi.getAllOrders}: `side` surfaces the
 * {@link trading.OrderSide} values for autocomplete (the generated request
 * types it as a bare `string`; the open union keeps it override-compatible),
 * and `symbols` accepts a `string[]` (joined for you) in addition to the raw
 * comma-separated `string`.
 */
export type GetAllOrdersInput = Omit<trading.GetAllOrdersRequest, "side" | "symbols"> & {
    // eslint-disable-next-line @typescript-eslint/ban-types
    side?: trading.OrderSide | (string & {});
    symbols?: string | string[];
};

export class OrdersApi extends trading.OrdersApi {
    /** Place a market order (requires `qty` or `notional`). */
    market(input: orders.MarketOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildMarketOrder(input) });
    }
    /** Place a limit order. */
    limit(input: orders.LimitOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildLimitOrder(input) });
    }
    /** Place a stop (stop-market) order. */
    stop(input: orders.StopOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildStopOrder(input) });
    }
    /** Place a stop-limit order. */
    stopLimit(input: orders.StopLimitOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildStopLimitOrder(input) });
    }
    /** Place a trailing-stop order (requires `trailPrice` or `trailPercent`). */
    trailingStop(input: orders.TrailingStopOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildTrailingStopOrder(input) });
    }
    /** Place a bracket order (entry + take-profit + stop-loss). */
    bracket(input: orders.BracketOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildBracketOrder(input) });
    }
    /** Place a one-cancels-other (OCO) order. */
    oco(input: orders.OcoOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildOcoOrder(input) });
    }
    /** Place a one-triggers-other (OTO) order. */
    oto(input: orders.OtoOrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildOtoOrder(input) });
    }
    /**
     * Generic escape hatch: submit a near-raw order, normalizing amount fields
     * to wire strings. Use the typed methods above when possible; reach for this
     * only for shapes they don't cover (e.g. `mleg`). Supply a stable, unique
     * `clientOrderId` so an ambiguous transport failure can be reconciled before
     * deciding whether to submit another order.
     */
    submit(input: orders.OrderInput): Promise<trading.Order> {
        return this.postOrder({ postOrderRequest: orders.buildOrder(input) });
    }

    /**
     * List orders. Overrides the generated method so `side` is the typed
     * {@link trading.OrderSide} and `symbols` accepts a `string[]` (joined for
     * you). Everything else delegates unchanged.
     */
    getAllOrders(
        requestParameters: GetAllOrdersInput = {},
        initOverrides?: RequestInit | trading.InitOverrideFunction,
    ): Promise<trading.Order[]> {
        const { symbols, ...rest } = requestParameters;
        return super.getAllOrders(
            { ...rest, symbols: symbols === undefined ? undefined : values.normalizeSymbols(symbols) },
            initOverrides,
        );
    }
}

/** Order events that end an order's lifecycle (used by {@link TradingClient.submitAndWait}). */
const DEFAULT_TERMINAL_EVENTS: readonly streaming.TradeUpdateEvent[] = [
    "fill",
    "canceled",
    "rejected",
    "expired",
    "done_for_day",
];

/** Map REST order statuses to their corresponding trade-update event names. */
function tradeEventForOrderStatus(status: trading.OrderStatus | undefined): streaming.TradeUpdateEvent | undefined {
    if (status === "filled") return "fill";
    if (status === "partially_filled") return "partial_fill";
    if (
        status === "new" ||
        status === "done_for_day" ||
        status === "canceled" ||
        status === "expired" ||
        status === "replaced" ||
        status === "pending_cancel" ||
        status === "pending_replace" ||
        status === "pending_new" ||
        status === "stopped" ||
        status === "rejected" ||
        status === "suspended" ||
        status === "calculated"
    ) {
        return status;
    }
    return undefined;
}

/** Options for {@link TradingClient.submitAndWait}. */
export interface SubmitAndWaitOptions {
    /** Reject if no terminal event arrives within this many ms. Default `30000`. */
    timeoutMs?: number;
    /** Which order events count as terminal. Defaults to fill/canceled/rejected/expired/done_for_day. */
    terminalEvents?: streaming.TradeUpdateEvent[];
    /**
     * Reuse an existing (connected) trading stream instead of opening one. When
     * provided it is left open; otherwise a stream is created and disconnected
     * once the promise settles.
     */
    stream?: streaming.TradingStream;
}

/** Workflow stage reported by {@link SubmitAndWaitError}. */
export type SubmitAndWaitPhase = "subscription" | "placement" | "reconciliation" | "terminal";

/**
 * Actionable failure from {@link TradingClient.submitAndWait}.
 *
 * When {@link placementAmbiguous} is true, the order placement may have reached
 * Alpaca. Reconcile with {@link clientOrderId} before submitting another order.
 * When placement is confirmed, {@link orderId} identifies the known order.
 */
export class SubmitAndWaitError extends Error {
    override readonly name = "SubmitAndWaitError";
    readonly clientOrderId: string;
    readonly orderId?: string;
    readonly phase: SubmitAndWaitPhase;
    readonly placementAmbiguous: boolean;
    readonly cause: unknown;

    constructor(
        message: string,
        details: {
            clientOrderId: string;
            orderId?: string;
            phase: SubmitAndWaitPhase;
            placementAmbiguous: boolean;
            cause: unknown;
        },
    ) {
        super(message);
        this.clientOrderId = details.clientOrderId;
        this.orderId = details.orderId;
        this.phase = details.phase;
        this.placementAmbiguous = details.placementAmbiguous;
        this.cause = details.cause;
    }
}

/**
 * Result of {@link TradingClient.validateConnection}. A discriminated union: on
 * success `ok` is `true` and the fetched {@link trading.Account} is attached; on
 * failure `ok` is `false` with the HTTP `status` / Alpaca `code` (when the
 * failure was an API response) plus a human-readable `message`. Never throws.
 */
export type ConnectionCheck =
    | { ok: true; account: trading.Account }
    | { ok: false; status?: number; code?: number | string; message: string };

/**
 * Trading sub-client. Two layers in one object:
 *
 *   1. **Generated (always present).** Every trading `Api` is a lazily
 *      constructed, memoized accessor — `account`, `accountActivities`,
 *      `assets`, `calendar`, `corporateActions`, `orders`, `positions`,
 *      `watchlists`, ... — each exposing its raw generated methods.
 *   2. **Ergonomic (additive).** Hand-written conveniences on top: the order
 *      builders on `orders` ({@link OrdersApi}), the workflow helpers
 *      `submitAndWait` / `closeAllPositions`, and the `iterate*` / `collect*`
 *      pagination helpers. These never replace a raw method.
 *
 * The ergonomic helpers on this client are enumerated in `ergonomicCapabilities`
 * (find one with `findErgonomic`); the generated accessors in `capabilities`
 * (find one with `findCapabilities`).
 */
export class TradingClient {
    private readonly config: trading.Configuration;
    private readonly credentials: AlpacaCredentials;
    private readonly paper: boolean;

    private _account?: trading.AccountsApi;
    private _accountActivities?: trading.AccountActivitiesApi;
    private _accountConfigurations?: trading.AccountConfigurationsApi;
    private _assets?: trading.AssetsApi;
    private _calendar?: trading.CalendarApi;
    private _clock?: trading.ClockApi;
    private _corporateActions?: trading.CorporateActionsApi;
    private _cryptoFunding?: trading.CryptoFundingApi;
    private _events?: trading.EventsApi;
    private _locates?: trading.LocatesApi;
    private _orders?: OrdersApi;
    private _portfolioHistory?: trading.PortfolioHistoryApi;
    private _positions?: trading.PositionsApi;
    private _tokenization?: trading.TokenizationApi;
    private _watchlists?: trading.WatchlistsApi;

    constructor(options: AlpacaClientOptions) {
        const creds = resolveCredentials(options);
        // Streaming authenticates with a key/secret pair; OAuth-only clients
        // resolve to empty values here and cannot open streams.
        this.credentials = { keyId: creds.keyId ?? "", secret: creds.secret ?? "" };
        this.paper = options.paper ?? true;
        this.config = new trading.Configuration({
            ...sharedRestConfig(options, creds),
            paper: this.paper,
        });
    }

    get account(): trading.AccountsApi {
        return (this._account ??= new trading.AccountsApi(this.config));
    }
    get accountActivities(): trading.AccountActivitiesApi {
        return (this._accountActivities ??= new trading.AccountActivitiesApi(this.config));
    }
    get accountConfigurations(): trading.AccountConfigurationsApi {
        return (this._accountConfigurations ??= new trading.AccountConfigurationsApi(this.config));
    }
    get assets(): trading.AssetsApi {
        return (this._assets ??= new trading.AssetsApi(this.config));
    }
    get calendar(): trading.CalendarApi {
        return (this._calendar ??= new trading.CalendarApi(this.config));
    }
    get clock(): trading.ClockApi {
        return (this._clock ??= new trading.ClockApi(this.config));
    }
    get corporateActions(): trading.CorporateActionsApi {
        return (this._corporateActions ??= new trading.CorporateActionsApi(this.config));
    }
    get cryptoFunding(): trading.CryptoFundingApi {
        return (this._cryptoFunding ??= new trading.CryptoFundingApi(this.config));
    }
    get events(): trading.EventsApi {
        return (this._events ??= new trading.EventsApi(this.config));
    }
    get locates(): trading.LocatesApi {
        return (this._locates ??= new trading.LocatesApi(this.config));
    }
    get orders(): OrdersApi {
        return (this._orders ??= new OrdersApi(this.config));
    }
    get portfolioHistory(): trading.PortfolioHistoryApi {
        return (this._portfolioHistory ??= new trading.PortfolioHistoryApi(this.config));
    }
    get positions(): trading.PositionsApi {
        return (this._positions ??= new trading.PositionsApi(this.config));
    }
    get tokenization(): trading.TokenizationApi {
        return (this._tokenization ??= new trading.TokenizationApi(this.config));
    }
    get watchlists(): trading.WatchlistsApi {
        return (this._watchlists ??= new trading.WatchlistsApi(this.config));
    }

    /**
     * Open a real-time trading-updates stream (orders/account events). The
     * `paper` environment is inherited from the client; pass options to tune
     * reconnect/backoff or inject a socket factory.
     */
    stream(
        options: Omit<streaming.TradingStreamOptions, "credentials" | "paper"> = {},
    ): streaming.TradingStream {
        return new (getStreaming().TradingStream)({
            ...options,
            credentials: this.credentials,
            paper: this.paper,
        });
    }

    // --- Workflow helpers --------------------------------------------------

    /**
     * Verify the client's credentials and connectivity without throwing.
     *
     * Performs a lightweight authenticated probe (`getAccount`) and returns a
     * discriminated {@link ConnectionCheck}: `{ ok: true, account }` when the
     * credentials work, or `{ ok: false, status, code, message }` otherwise.
     * A `401`/`403` surfaces as `ok: false` with the status set (bad or
     * unauthorized credentials); network/other failures come back with just a
     * `message`. Works for OAuth clients too, since it's a REST call.
     *
     * @example
     * ```ts
     * const check = await alpaca.trading.validateConnection();
     * if (!check.ok) throw new Error(`Alpaca auth failed (${check.status}): ${check.message}`);
     * ```
     */
    async validateConnection(): Promise<ConnectionCheck> {
        try {
            const account = await this.account.getAccount();
            return { ok: true, account };
        } catch (err) {
            if (err instanceof ApiError) {
                return { ok: false, status: err.status, code: err.code, message: err.message };
            }
            // Transport failures (DNS, connection refused, timeout/abort) are
            // wrapped in a FetchError; surface the underlying cause, which is the
            // actionable bit for a connectivity check.
            if (err instanceof FetchError) {
                return { ok: false, message: err.cause?.message ?? err.message };
            }
            return { ok: false, message: err instanceof Error ? err.message : String(err) };
        }
    }

    /**
     * Close every open position. Optionally cancel open orders first. Thin
     * wrapper over {@link trading.PositionsApi.deleteAllOpenPositions}.
     */
    closeAllPositions(
        options: trading.DeleteAllOpenPositionsRequest = {},
    ): Promise<trading.PositionClosedReponse[]> {
        return this.positions.deleteAllOpenPositions(options);
    }

    /**
     * Place an order and resolve once it reaches a terminal state, observed
     * over the trading-updates stream. Resolves with the terminal
     * {@link trading.Order}; rejects on timeout or a stream error.
     *
     * The stream confirms its `trade_updates` subscription before the order is
     * placed. A client order ID is known before subscribing, so a fast terminal
     * update can be matched even while the POST response is still pending.
     * Post-placement workflow failures reject with {@link SubmitAndWaitError},
     * exposing the `clientOrderId` and, after confirmation, the `orderId`.
     */
    submitAndWait(input: orders.OrderInput, options: SubmitAndWaitOptions = {}): Promise<trading.Order> {
        const timeoutMs = options.timeoutMs ?? 30_000;
        const terminal = new Set<string>(options.terminalEvents ?? DEFAULT_TERMINAL_EVENTS);
        const ownStream = options.stream === undefined;
        const stream = options.stream ?? this.stream();
        const EVENT = getStreaming().EVENT;
        const submittedInput: orders.OrderInput = {
            ...input,
            clientOrderId: input.clientOrderId ?? globalThis.crypto.randomUUID(),
        };
        const clientOrderId = submittedInput.clientOrderId as string;

        return new Promise<trading.Order>((resolve, reject) => {
            let settled = false;
            let cleaned = false;
            let placementStarted = false;
            let placementConfirmed = false;
            let workflowPhase: SubmitAndWaitPhase = "subscription";
            let orderId: string | undefined;
            const workflowController = new AbortController();

            const cleanup = (): void => {
                if (cleaned) return;
                cleaned = true;
                clearTimeout(timer);
                workflowController.abort();
                stream.off(EVENT.SUBSCRIPTION, onSubscription);
                stream.off(EVENT.TRADE_UPDATE, onUpdate);
                stream.off(EVENT.CLIENT_ERROR, onError);
                if (ownStream) stream.disconnect();
            };
            const settle = (run: () => void): void => {
                if (settled) return;
                settled = true;
                cleanup();
                run();
            };
            const matches = (order: trading.Order): boolean =>
                order.clientOrderId === clientOrderId || (orderId !== undefined && order.id === orderId);
            const consider = (u: streaming.TradeUpdate): void => {
                if (!matches(u.order) || !terminal.has(u.event)) return;
                settle(() => resolve(u.order));
            };
            function onUpdate(u: streaming.TradeUpdate): void {
                consider(u);
            }
            function onError(message: string): void {
                const cause = new Error(`trading stream error: ${message}`);
                if (placementStarted) {
                    const placementAmbiguous = !placementConfirmed;
                    const errorMessage = placementAmbiguous
                        ? `submitAndWait lost the trading stream after placement started for clientOrderId "${clientOrderId}"; the placement outcome is ambiguous. Reconcile this clientOrderId before submitting another order. Cause: ${cause.message}`
                        : `submitAndWait lost the trading stream after placement was confirmed for clientOrderId "${clientOrderId}", orderId "${orderId}". Inspect the order and resume monitoring before taking further action. Cause: ${cause.message}`;
                    settle(() =>
                        reject(
                            new SubmitAndWaitError(
                                errorMessage,
                                {
                                    clientOrderId,
                                    orderId,
                                    phase: workflowPhase,
                                    placementAmbiguous,
                                    cause,
                                },
                            ),
                        ),
                    );
                    return;
                }
                settle(() => reject(cause));
            }

            const place = async (): Promise<void> => {
                try {
                    const placed = await this.orders.postOrder(
                        { postOrderRequest: orders.buildOrder(submittedInput) },
                        { signal: workflowController.signal },
                    );
                    if (settled) return;
                    orderId = placed.id;
                    placementConfirmed = true;
                    workflowPhase = "terminal";
                } catch (err) {
                    if (settled) return;
                    if (!(err instanceof FetchError)) {
                        settle(() => reject(err as Error));
                        return;
                    }
                    workflowPhase = "reconciliation";
                    try {
                        const reconciled = await this.orders.getOrderByClientOrderId(
                            { clientOrderId },
                            { signal: workflowController.signal },
                        );
                        if (settled) return;
                        orderId = reconciled.id;
                        placementConfirmed = true;
                        workflowPhase = "terminal";
                        const event = tradeEventForOrderStatus(reconciled.status);
                        if (event !== undefined && terminal.has(event)) {
                            settle(() => resolve(reconciled));
                        }
                    } catch (reconciliationError) {
                        if (settled) return;
                        if (reconciliationError instanceof ApiError && reconciliationError.status === 404) {
                            return;
                        }
                        settle(() =>
                            reject(
                                new SubmitAndWaitError(
                                    `submitAndWait failed for clientOrderId "${clientOrderId}" because it could not reconcile the ambiguous placement. Query this clientOrderId before submitting another order.`,
                                    {
                                        clientOrderId,
                                        orderId,
                                        phase: "reconciliation",
                                        placementAmbiguous: true,
                                        cause: reconciliationError,
                                    },
                                ),
                            ),
                        );
                    }
                }
            };
            function onSubscription(subscriptions: unknown): void {
                if (
                    placementStarted ||
                    !Array.isArray(subscriptions) ||
                    !subscriptions.includes("trade_updates")
                ) {
                    return;
                }
                placementStarted = true;
                workflowPhase = "placement";
                void place();
            }

            const timer = setTimeout(() => {
                const timeoutCause = new DOMException(
                    `submitAndWait timed out after ${timeoutMs}ms`,
                    "TimeoutError",
                );
                const phaseDescription = !placementStarted
                    ? "before order placement while waiting for the trade_updates subscription"
                    : workflowPhase === "reconciliation"
                      ? "because the placement outcome is ambiguous while reconciling"
                      : !placementConfirmed
                      ? "because the placement outcome is ambiguous"
                      : "while waiting for a terminal update";
                const placementAmbiguous = placementStarted && !placementConfirmed;
                const action = placementAmbiguous
                    ? " Reconcile this clientOrderId before submitting another order."
                    : "";
                settle(() =>
                    reject(
                        new SubmitAndWaitError(
                            `submitAndWait timed out after ${timeoutMs}ms for clientOrderId "${clientOrderId}" ${phaseDescription}.${action}`,
                            {
                                clientOrderId,
                                orderId,
                                phase: workflowPhase,
                                placementAmbiguous,
                                cause: timeoutCause,
                            },
                        ),
                    ),
                );
            }, timeoutMs);

            try {
                stream.on(EVENT.SUBSCRIPTION, onSubscription);
                stream.on(EVENT.TRADE_UPDATE, onUpdate);
                stream.on(EVENT.CLIENT_ERROR, onError);
                stream.subscribeTradeUpdates();
                if (ownStream) stream.connect();
            } catch (error) {
                settle(() => reject(error as Error));
            }
        });
    }

    // --- Pagination --------------------------------------------------------
    //
    // The page token is managed for you, so it is omitted from request types.

    /** Iterate option contracts across all pages. */
    iterateOptionsContracts(req: Omit<trading.GetOptionsContractsRequest, "pageToken"> = {}) {
        return pagination.paginate<trading.OptionContract>((pageToken) =>
            this.assets.getOptionsContracts({ ...req, pageToken }).then((r) => ({ items: r.optionContracts ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect option contracts into one array. */
    collectOptionsContracts(req: Omit<trading.GetOptionsContractsRequest, "pageToken"> = {}) {
        return pagination.collect<trading.OptionContract>((pageToken) =>
            this.assets.getOptionsContracts({ ...req, pageToken }).then((r) => ({ items: r.optionContracts ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    /**
     * Iterate account activities across all pages. Activities use cursor
     * pagination: the next `page_token` is the `id` of the last item.
     */
    iterateActivities(req: Omit<trading.GetAccountActivitiesRequest, "pageToken"> = {}) {
        return pagination.paginateCursor<trading.GetAccountActivities200ResponseInner>({
            fetchPage: (pageToken) => this.accountActivities.getAccountActivities({ ...req, pageToken }),
            getCursor: (last) => last.id,
            pageSize: req.pageSize,
        });
    }
    /** Collect account activities across all pages into one array. */
    collectActivities(req: Omit<trading.GetAccountActivitiesRequest, "pageToken"> = {}) {
        return pagination.collectCursor<trading.GetAccountActivities200ResponseInner>({
            fetchPage: (pageToken) => this.accountActivities.getAccountActivities({ ...req, pageToken }),
            getCursor: (last) => last.id,
            pageSize: req.pageSize,
        });
    }

    /** Iterate account activities of a specific type across all pages (cursor). */
    iterateActivitiesByType(req: trading.GetAccountActivitiesByActivityTypeRequest) {
        return pagination.paginateCursor<trading.GetAccountActivitiesByActivityType200ResponseInner>({
            fetchPage: (pageToken) => this.accountActivities.getAccountActivitiesByActivityType({ ...req, pageToken }),
            getCursor: (last) => last.id,
            pageSize: req.pageSize,
        });
    }
    /** Collect account activities of a specific type across all pages. */
    collectActivitiesByType(req: trading.GetAccountActivitiesByActivityTypeRequest) {
        return pagination.collectCursor<trading.GetAccountActivitiesByActivityType200ResponseInner>({
            fetchPage: (pageToken) => this.accountActivities.getAccountActivitiesByActivityType({ ...req, pageToken }),
            getCursor: (last) => last.id,
            pageSize: req.pageSize,
        });
    }
}

/**
 * Override a request's required comma-separated `symbols` so callers may also
 * pass a `string[]` (joined for them). The raw `string` form still type-checks.
 */
type WithSymbolList<T extends { symbols: string }> = Omit<T, "symbols"> & { symbols: string | string[] };
/** Like {@link WithSymbolList} but for requests where `symbols` is optional. */
type WithOptionalSymbolList<T extends { symbols?: string }> = Omit<T, "symbols"> & { symbols?: string | string[] };
/** Override forex `currencyPairs` so callers may also pass a `string[]`. */
type WithCurrencyPairList<T extends { currencyPairs: string }> = Omit<T, "currencyPairs"> & {
    currencyPairs: string | string[];
};
/** Override a request's `timeframe` to require the branded {@link values.TimeFrameString}. */
type WithTimeframe<T extends { timeframe: string }> = Omit<T, "timeframe"> & { timeframe: values.TimeFrameString };

/** Reshape a `{ [symbol]: Bar[] }` map into a `{ [symbol]: Candles }` map. */
function toCandlesBySymbol(
    bars: { [symbol: string]: marketDataShapes.Bar[] },
    opts?: marketDataShapes.ChartOptions,
): { [symbol: string]: marketDataShapes.Candles } {
    const out: { [symbol: string]: marketDataShapes.Candles } = {};
    for (const symbol of Object.keys(bars)) {
        out[symbol] = marketDataShapes.toCandles(bars[symbol], opts);
    }
    return out;
}

/**
 * Options for the multi-symbol `collect*BySymbol` (and normalized `get*`)
 * market-data helpers. All optional; defaults preserve a single combined,
 * unbounded request.
 */
export interface SymbolCollectOptions {
    /**
     * Keep at most this many records per symbol, stopping early once every
     * requested symbol is full. Guards against unbounded per-symbol history
     * (e.g. years of minute bars). Omit for "all pages".
     */
    maxPerSymbol?: number;
    /**
     * Fetch symbols in parallel with this many requests in flight. Default `1`
     * (one combined request whose single page-token chain is followed
     * sequentially, the historical behavior). Values > 1 split the symbol list
     * (see {@link chunkSize}) and run the chunks concurrently; the client-side
     * rate limiter still bounds the actual request rate.
     */
    concurrency?: number;
    /** Symbols per request when {@link concurrency} > 1. Default `1`. */
    chunkSize?: number;
}

/** Parse a symbols/currency-pairs argument into a trimmed, non-empty list. */
function symbolList(symbols: string | string[]): string[] {
    const list = Array.isArray(symbols) ? symbols : String(symbols).split(",");
    return list.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Drive a symbol-keyed collect. With default options this issues one combined
 * request and follows its page token to exhaustion. With `concurrency > 1` it
 * splits the symbol list into `chunkSize` groups fetched concurrently (capped
 * by `concurrency`); `maxPerSymbol` bounds each symbol's array either way.
 */
function collectSymbolMap<T>(
    symbols: string | string[],
    fetchPage: (symbolsCsv: string, pageToken?: string) => Promise<pagination.SymbolMapPage<T>>,
    opts: SymbolCollectOptions = {},
): Promise<{ [symbol: string]: T[] }> {
    const list = symbolList(symbols);
    const concurrency = opts.concurrency ?? 1;
    if (concurrency <= 1 || list.length <= 1) {
        return pagination.collectBySymbol<T>((pageToken) => fetchPage(list.join(","), pageToken), {
            maxPerSymbol: opts.maxPerSymbol,
            symbols: list,
        });
    }
    const groups = pagination.chunk(list, opts.chunkSize ?? 1);
    return pagination
        .mapConcurrent(groups, concurrency, (group) =>
            pagination.collectBySymbol<T>((pageToken) => fetchPage(group.join(","), pageToken), {
                maxPerSymbol: opts.maxPerSymbol,
                symbols: group,
            }),
        )
        .then((maps) => {
            const out: { [symbol: string]: T[] } = {};
            for (const map of maps) {
                for (const symbol of Object.keys(map)) {
                    out[symbol] = map[symbol];
                }
            }
            return out;
        });
}

/**
 * Market-data sub-client. Two layers in one object:
 *
 *   1. **Generated (always present).** Every market-data `Api` is a lazily
 *      constructed, memoized accessor — `stocks`, `crypto`, `options`,
 *      `forex`, `indices`, `news`, `screener`, ... — each exposing its raw
 *      generated methods (which keep Alpaca's compact wire keys).
 *   2. **Ergonomic (additive).** Hand-written conveniences on top: the
 *      normalized `get<Asset><Thing>` / `get<Asset>Candles` accessors (canonical
 *      symbol-keyed shapes, unified with streaming), the `getLatestPrice`
 *      workflow helper, and the `iterate*` / `collect*` pagination helpers.
 *      These never replace a raw method.
 *
 * The ergonomic helpers on this client are enumerated in `ergonomicCapabilities`
 * (find one with `findErgonomic`); the generated accessors in `capabilities`
 * (find one with `findCapabilities`).
 *
 * The `paper` option is accepted (it shares {@link AlpacaClientOptions} with the
 * trading client) but has no effect here: market data always uses
 * `data.alpaca.markets`. Free vs paid data is selected by your subscription and
 * the per-request `feed` parameter (`iex` is the only feed available for free).
 */
export class MarketDataClient {
    private readonly config: marketData.Configuration;
    private readonly credentials: AlpacaCredentials;
    private readonly sandbox: boolean;

    private _stocks?: marketData.StockApi;
    private _crypto?: marketData.CryptoApi;
    private _cryptoPerpetualFutures?: marketData.CryptoPerpetualFuturesApi;
    private _fixedIncome?: marketData.FixedIncomeApi;
    private _forex?: marketData.ForexApi;
    private _indices?: marketData.IndexApi;
    private _logos?: marketData.LogosApi;
    private _news?: marketData.NewsApi;
    private _options?: marketData.OptionApi;
    private _screener?: marketData.ScreenerApi;
    private _corporateActions?: marketData.CorporateActionsApi;

    constructor(options: AlpacaClientOptions) {
        const creds = resolveCredentials(options);
        // Streaming authenticates with a key/secret pair; OAuth-only clients
        // resolve to empty values here and cannot open streams.
        this.credentials = { keyId: creds.keyId ?? "", secret: creds.secret ?? "" };
        this.sandbox = options.sandbox ?? false;
        this.config = new marketData.Configuration(sharedRestConfig(options, creds));
    }

    get stocks(): marketData.StockApi {
        return (this._stocks ??= new marketData.StockApi(this.config));
    }
    get crypto(): marketData.CryptoApi {
        return (this._crypto ??= new marketData.CryptoApi(this.config));
    }
    get cryptoPerpetualFutures(): marketData.CryptoPerpetualFuturesApi {
        return (this._cryptoPerpetualFutures ??= new marketData.CryptoPerpetualFuturesApi(this.config));
    }
    get fixedIncome(): marketData.FixedIncomeApi {
        return (this._fixedIncome ??= new marketData.FixedIncomeApi(this.config));
    }
    get forex(): marketData.ForexApi {
        return (this._forex ??= new marketData.ForexApi(this.config));
    }
    get indices(): marketData.IndexApi {
        return (this._indices ??= new marketData.IndexApi(this.config));
    }
    get logos(): marketData.LogosApi {
        return (this._logos ??= new marketData.LogosApi(this.config));
    }
    get news(): marketData.NewsApi {
        return (this._news ??= new marketData.NewsApi(this.config));
    }
    get options(): marketData.OptionApi {
        return (this._options ??= new marketData.OptionApi(this.config));
    }
    get screener(): marketData.ScreenerApi {
        return (this._screener ??= new marketData.ScreenerApi(this.config));
    }
    get corporateActions(): marketData.CorporateActionsApi {
        return (this._corporateActions ??= new marketData.CorporateActionsApi(this.config));
    }

    /** Open a real-time US-equities data stream. */
    stockStream(
        options: Omit<streaming.StockDataStreamOptions, "credentials"> = {},
    ): streaming.StockDataStream {
        return new (getStreaming().StockDataStream)({ sandbox: this.sandbox, ...options, credentials: this.credentials });
    }

    /**
     * Open a real-time crypto data stream. Crypto streaming is production-only
     * (no sandbox endpoint), so the client's `sandbox` flag is not applied here.
     */
    cryptoStream(
        options: Omit<streaming.CryptoDataStreamOptions, "credentials"> = {},
    ): streaming.CryptoDataStream {
        return new (getStreaming().CryptoDataStream)({ ...options, credentials: this.credentials });
    }

    /** Open a real-time options data stream. */
    optionStream(
        options: Omit<streaming.OptionDataStreamOptions, "credentials"> = {},
    ): streaming.OptionDataStream {
        return new (getStreaming().OptionDataStream)({ sandbox: this.sandbox, ...options, credentials: this.credentials });
    }

    /**
     * Open a real-time news stream. News streaming is production-only (no
     * sandbox endpoint), so the client's `sandbox` flag is not applied here.
     */
    newsStream(
        options: Omit<streaming.MarketDataStreamOptions, "credentials"> = {},
    ): streaming.NewsStream {
        return new (getStreaming().NewsStream)({ ...options, credentials: this.credentials });
    }

    // --- Workflow helpers --------------------------------------------------

    /**
     * Latest trade price for a symbol as a `number` (or `undefined` when the
     * response carries no usable price). Thin wrapper over
     * {@link marketData.StockApi.stockLatestTradeSingle}.
     */
    async getLatestPrice(
        symbol: string,
        options: Omit<marketData.StockLatestTradeSingleRequest, "symbol"> = {},
    ): Promise<number | undefined> {
        const resp = await this.stocks.stockLatestTradeSingle({ ...options, symbol });
        return values.toNumber(resp.trade?.p);
    }

    // --- Normalized market-data shapes -------------------------------------
    //
    // The same canonical `Bar`/`Trade`/`Quote` the streaming clients emit, so a
    // dashboard can backfill history here and append live updates over the
    // WebSocket without reconciling two shapes. Each method auto-paginates and
    // returns a `{ [symbol]: T[] }` map; `get*Candles` reshape bars into the
    // columnar form charting libraries consume.

    /** Historical stock bars as canonical {@link marketDataShapes.Bar}s, keyed by symbol. */
    async getStockBars(
        req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Bar[] }> {
        return marketDataShapes.toBarsBySymbol(await this.collectStockBarsBySymbol(req, opts));
    }
    /** Historical crypto bars as canonical {@link marketDataShapes.Bar}s, keyed by symbol. */
    async getCryptoBars(
        req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Bar[] }> {
        return marketDataShapes.toBarsBySymbol(await this.collectCryptoBarsBySymbol(req, opts));
    }
    /** Historical option bars as canonical {@link marketDataShapes.Bar}s, keyed by symbol. */
    async getOptionBars(
        req: Omit<WithTimeframe<WithSymbolList<marketData.OptionBarsRequest>>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Bar[] }> {
        return marketDataShapes.toBarsBySymbol(await this.collectOptionBarsBySymbol(req, opts));
    }

    /** Historical stock trades as canonical {@link marketDataShapes.Trade}s, keyed by symbol. */
    async getStockTrades(
        req: Omit<WithSymbolList<marketData.StockTradesRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Trade[] }> {
        return marketDataShapes.toTradesBySymbol(await this.collectStockTradesBySymbol(req, opts), marketDataShapes.toStockTrade);
    }
    /** Historical crypto trades as canonical {@link marketDataShapes.Trade}s, keyed by symbol. */
    async getCryptoTrades(
        req: Omit<WithSymbolList<marketData.CryptoTradesRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Trade[] }> {
        return marketDataShapes.toTradesBySymbol(await this.collectCryptoTradesBySymbol(req, opts), marketDataShapes.toCryptoTrade);
    }

    /** Historical stock quotes as canonical {@link marketDataShapes.Quote}s, keyed by symbol. */
    async getStockQuotes(
        req: Omit<WithSymbolList<marketData.StockQuotesRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Quote[] }> {
        return marketDataShapes.toQuotesBySymbol(await this.collectStockQuotesBySymbol(req, opts), marketDataShapes.toStockQuote);
    }
    /** Historical crypto quotes as canonical {@link marketDataShapes.Quote}s, keyed by symbol. */
    async getCryptoQuotes(
        req: Omit<WithSymbolList<marketData.CryptoQuotesRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Quote[] }> {
        return marketDataShapes.toQuotesBySymbol(await this.collectCryptoQuotesBySymbol(req, opts), marketDataShapes.toCryptoQuote);
    }

    /**
     * Historical index values as canonical {@link marketDataShapes.IndexValue}s,
     * keyed by symbol. Preserves the full-precision `timestampRaw` (the generated
     * model truncates the timestamp to a `Date`).
     */
    async getIndexValues(
        req: Omit<WithSymbolList<marketData.IndexValuesRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.IndexValue[] }> {
        return marketDataShapes.toIndexValuesBySymbol(await this.collectIndexValuesBySymbol(req, opts));
    }

    /**
     * Historical stock auctions as canonical {@link marketDataShapes.DailyAuctions},
     * keyed by symbol. Each opening/closing {@link marketDataShapes.Auction}
     * preserves the full-precision `timestampRaw`.
     */
    async getStockAuctions(
        req: Omit<WithSymbolList<marketData.StockAuctionsRequest>, "pageToken">,
        opts?: SymbolCollectOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.DailyAuctions[] }> {
        return marketDataShapes.toAuctionsBySymbol(await this.collectStockAuctionsBySymbol(req, opts));
    }

    /** Historical stock bars as chart-ready columnar {@link marketDataShapes.Candles}, keyed by symbol. */
    async getStockCandles(
        req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken">,
        opts?: SymbolCollectOptions & marketDataShapes.ChartOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Candles }> {
        return toCandlesBySymbol(await this.getStockBars(req, opts), opts);
    }
    /** Historical crypto bars as chart-ready columnar {@link marketDataShapes.Candles}, keyed by symbol. */
    async getCryptoCandles(
        req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken">,
        opts?: SymbolCollectOptions & marketDataShapes.ChartOptions,
    ): Promise<{ [symbol: string]: marketDataShapes.Candles }> {
        return toCandlesBySymbol(await this.getCryptoBars(req, opts), opts);
    }

    // --- Normalized market-data shapes: single-symbol convenience ----------
    //
    // The `get<Asset><Thing>` accessors above always return a `{ [symbol]: T[] }`
    // map, so a single-symbol call still has to be unwrapped (`result[symbol]`).
    // These `*For(symbol, ...)` variants wrap them and hand back the unwrapped
    // canonical value for one symbol, inheriting the same pagination, symbol
    // stamping, and real-`Date` normalization.

    /** Unwrap a single-symbol `{ [symbol]: T[] }` map to that symbol's series (empty when absent). */
    private static firstSeries<T>(map: { [symbol: string]: T[] }, symbol: string): T[] {
        return map[symbol] ?? [];
    }

    /** Historical stock bars for one symbol as canonical {@link marketDataShapes.Bar}s. */
    async getStockBarsFor(
        symbol: string,
        req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Bar[]> {
        return MarketDataClient.firstSeries(await this.getStockBars({ ...req, symbols: [symbol] }, opts), symbol);
    }
    /** Historical crypto bars for one symbol as canonical {@link marketDataShapes.Bar}s. */
    async getCryptoBarsFor(
        symbol: string,
        req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Bar[]> {
        return MarketDataClient.firstSeries(await this.getCryptoBars({ ...req, symbols: [symbol] }, opts), symbol);
    }
    /** Historical option bars for one symbol as canonical {@link marketDataShapes.Bar}s. */
    async getOptionBarsFor(
        symbol: string,
        req: Omit<WithTimeframe<WithSymbolList<marketData.OptionBarsRequest>>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Bar[]> {
        return MarketDataClient.firstSeries(await this.getOptionBars({ ...req, symbols: [symbol] }, opts), symbol);
    }

    /** Historical stock trades for one symbol as canonical {@link marketDataShapes.Trade}s. */
    async getStockTradesFor(
        symbol: string,
        req: Omit<WithSymbolList<marketData.StockTradesRequest>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Trade[]> {
        return MarketDataClient.firstSeries(await this.getStockTrades({ ...req, symbols: [symbol] }, opts), symbol);
    }
    /** Historical crypto trades for one symbol as canonical {@link marketDataShapes.Trade}s. */
    async getCryptoTradesFor(
        symbol: string,
        req: Omit<WithSymbolList<marketData.CryptoTradesRequest>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Trade[]> {
        return MarketDataClient.firstSeries(await this.getCryptoTrades({ ...req, symbols: [symbol] }, opts), symbol);
    }

    /** Historical stock quotes for one symbol as canonical {@link marketDataShapes.Quote}s. */
    async getStockQuotesFor(
        symbol: string,
        req: Omit<WithSymbolList<marketData.StockQuotesRequest>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Quote[]> {
        return MarketDataClient.firstSeries(await this.getStockQuotes({ ...req, symbols: [symbol] }, opts), symbol);
    }
    /** Historical crypto quotes for one symbol as canonical {@link marketDataShapes.Quote}s. */
    async getCryptoQuotesFor(
        symbol: string,
        req: Omit<WithSymbolList<marketData.CryptoQuotesRequest>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions,
    ): Promise<marketDataShapes.Quote[]> {
        return MarketDataClient.firstSeries(await this.getCryptoQuotes({ ...req, symbols: [symbol] }, opts), symbol);
    }

    /** Historical stock bars for one symbol as chart-ready columnar {@link marketDataShapes.Candles}. */
    async getStockCandlesFor(
        symbol: string,
        req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions & marketDataShapes.ChartOptions,
    ): Promise<marketDataShapes.Candles> {
        return marketDataShapes.toCandles(await this.getStockBarsFor(symbol, req, opts), opts);
    }
    /** Historical crypto bars for one symbol as chart-ready columnar {@link marketDataShapes.Candles}. */
    async getCryptoCandlesFor(
        symbol: string,
        req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken" | "symbols">,
        opts?: SymbolCollectOptions & marketDataShapes.ChartOptions,
    ): Promise<marketDataShapes.Candles> {
        return marketDataShapes.toCandles(await this.getCryptoBarsFor(symbol, req, opts), opts);
    }

    // --- Pagination: multi-symbol endpoints --------------------------------
    //
    // `iterate*` yields flat `{ symbol, value }` records across every symbol and
    // page; `collect*BySymbol` returns a merged `{ [symbol]: T[] }` map. The
    // page token is managed for you, so it is omitted from the request type.

    /** Iterate historical stock bars across all symbols and pages. */
    iterateStockBars(req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.StockBar>((pageToken) =>
            this.stocks.stockBars({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical stock bars merged into a `{ [symbol]: StockBar[] }` map. */
    collectStockBarsBySymbol(req: Omit<WithTimeframe<WithSymbolList<marketData.StockBarsRequest>>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.StockBar>(req.symbols, (symbols, pageToken) =>
            this.stocks.stockBars({ ...req, symbols, pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical stock trades across all symbols and pages. */
    iterateStockTrades(req: Omit<WithSymbolList<marketData.StockTradesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.StockTrade>((pageToken) =>
            this.stocks.stockTrades({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical stock trades merged into a `{ [symbol]: StockTrade[] }` map. */
    collectStockTradesBySymbol(req: Omit<WithSymbolList<marketData.StockTradesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.StockTrade>(req.symbols, (symbols, pageToken) =>
            this.stocks.stockTrades({ ...req, symbols, pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical stock quotes across all symbols and pages. */
    iterateStockQuotes(req: Omit<WithSymbolList<marketData.StockQuotesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.StockQuote>((pageToken) =>
            this.stocks.stockQuotes({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.quotes ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical stock quotes merged into a `{ [symbol]: StockQuote[] }` map. */
    collectStockQuotesBySymbol(req: Omit<WithSymbolList<marketData.StockQuotesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.StockQuote>(req.symbols, (symbols, pageToken) =>
            this.stocks.stockQuotes({ ...req, symbols, pageToken }).then((r) => ({ data: r.quotes ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical stock auctions across all symbols and pages. */
    iterateStockAuctions(req: Omit<WithSymbolList<marketData.StockAuctionsRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.StockDailyAuctions>((pageToken) =>
            this.stocks.stockAuctions({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.auctions ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical stock auctions merged into a `{ [symbol]: StockDailyAuctions[] }` map. */
    collectStockAuctionsBySymbol(req: Omit<WithSymbolList<marketData.StockAuctionsRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.StockDailyAuctions>(req.symbols, (symbols, pageToken) =>
            this.stocks.stockAuctions({ ...req, symbols, pageToken }).then((r) => ({ data: r.auctions ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical crypto bars across all symbols and pages. */
    iterateCryptoBars(req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.CryptoBar>((pageToken) =>
            this.crypto.cryptoBars({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical crypto bars merged into a `{ [symbol]: CryptoBar[] }` map. */
    collectCryptoBarsBySymbol(req: Omit<WithTimeframe<WithSymbolList<marketData.CryptoBarsRequest>>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.CryptoBar>(req.symbols, (symbols, pageToken) =>
            this.crypto.cryptoBars({ ...req, symbols, pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical crypto trades across all symbols and pages. */
    iterateCryptoTrades(req: Omit<WithSymbolList<marketData.CryptoTradesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.CryptoTrade>((pageToken) =>
            this.crypto.cryptoTrades({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical crypto trades merged into a `{ [symbol]: CryptoTrade[] }` map. */
    collectCryptoTradesBySymbol(req: Omit<WithSymbolList<marketData.CryptoTradesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.CryptoTrade>(req.symbols, (symbols, pageToken) =>
            this.crypto.cryptoTrades({ ...req, symbols, pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical crypto quotes across all symbols and pages. */
    iterateCryptoQuotes(req: Omit<WithSymbolList<marketData.CryptoQuotesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.CryptoQuote>((pageToken) =>
            this.crypto.cryptoQuotes({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.quotes ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical crypto quotes merged into a `{ [symbol]: CryptoQuote[] }` map. */
    collectCryptoQuotesBySymbol(req: Omit<WithSymbolList<marketData.CryptoQuotesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.CryptoQuote>(req.symbols, (symbols, pageToken) =>
            this.crypto.cryptoQuotes({ ...req, symbols, pageToken }).then((r) => ({ data: r.quotes ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical option bars across all symbols and pages. */
    iterateOptionBars(req: Omit<WithTimeframe<WithSymbolList<marketData.OptionBarsRequest>>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.OptionBar>((pageToken) =>
            this.options.optionBars({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical option bars merged into a `{ [symbol]: OptionBar[] }` map. */
    collectOptionBarsBySymbol(req: Omit<WithTimeframe<WithSymbolList<marketData.OptionBarsRequest>>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.OptionBar>(req.symbols, (symbols, pageToken) =>
            this.options.optionBars({ ...req, symbols, pageToken }).then((r) => ({ data: r.bars ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical option trades across all symbols and pages. */
    iterateOptionTrades(req: Omit<WithSymbolList<marketData.OptionTradesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.OptionTrade>((pageToken) =>
            this.options.optionTrades({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical option trades merged into a `{ [symbol]: OptionTrade[] }` map. */
    collectOptionTradesBySymbol(req: Omit<WithSymbolList<marketData.OptionTradesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.OptionTrade>(req.symbols, (symbols, pageToken) =>
            this.options.optionTrades({ ...req, symbols, pageToken }).then((r) => ({ data: r.trades ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical index values across all symbols and pages. */
    iterateIndexValues(req: Omit<WithSymbolList<marketData.IndexValuesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.IndexValue>((pageToken) =>
            this.indices.indexValues({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.values ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical index values merged into a `{ [symbol]: IndexValue[] }` map. */
    collectIndexValuesBySymbol(req: Omit<WithSymbolList<marketData.IndexValuesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.IndexValue>(req.symbols, (symbols, pageToken) =>
            this.indices.indexValues({ ...req, symbols, pageToken }).then((r) => ({ data: r.values ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    /** Iterate historical forex rates across all currency pairs and pages. */
    iterateForexRates(req: Omit<WithCurrencyPairList<marketData.RatesRequest>, "pageToken">) {
        return pagination.paginateSymbolMap<marketData.ForexRate>((pageToken) =>
            this.forex.rates({ ...req, currencyPairs: values.normalizeSymbols(req.currencyPairs), pageToken }).then((r) => ({ data: r.rates ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect historical forex rates merged into a `{ [pair]: ForexRate[] }` map. */
    collectForexRatesBySymbol(req: Omit<WithCurrencyPairList<marketData.RatesRequest>, "pageToken">, opts?: SymbolCollectOptions) {
        return collectSymbolMap<marketData.ForexRate>(req.currencyPairs, (currencyPairs, pageToken) =>
            this.forex.rates({ ...req, currencyPairs, pageToken }).then((r) => ({ data: r.rates ?? {}, nextPageToken: r.nextPageToken })),
            opts,
        );
    }

    // --- Pagination: symbol-keyed single-object endpoints ------------------

    /** Iterate option snapshots across all symbols and pages. */
    iterateOptionSnapshots(req: Omit<WithSymbolList<marketData.OptionSnapshotsRequest>, "pageToken">) {
        return pagination.paginateSymbolObjects<marketData.OptionSnapshot>((pageToken) =>
            this.options.optionSnapshots({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.snapshots ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect option snapshots merged into a `{ [symbol]: OptionSnapshot }` map. */
    collectOptionSnapshotsBySymbol(req: Omit<WithSymbolList<marketData.OptionSnapshotsRequest>, "pageToken">) {
        return pagination.collectSymbolObjects<marketData.OptionSnapshot>((pageToken) =>
            this.options.optionSnapshots({ ...req, symbols: values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ data: r.snapshots ?? {}, nextPageToken: r.nextPageToken })),
        );
    }

    /** Iterate an option chain's snapshots across all symbols and pages. */
    iterateOptionChain(req: Omit<marketData.OptionChainRequest, "pageToken">) {
        return pagination.paginateSymbolObjects<marketData.OptionSnapshot>((pageToken) =>
            this.options.optionChain({ ...req, pageToken }).then((r) => ({ data: r.snapshots ?? {}, nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect an option chain's snapshots merged into a `{ [symbol]: OptionSnapshot }` map. */
    collectOptionChainBySymbol(req: Omit<marketData.OptionChainRequest, "pageToken">) {
        return pagination.collectSymbolObjects<marketData.OptionSnapshot>((pageToken) =>
            this.options.optionChain({ ...req, pageToken }).then((r) => ({ data: r.snapshots ?? {}, nextPageToken: r.nextPageToken })),
        );
    }

    // --- Pagination: top-level array endpoints -----------------------------

    /** Iterate single-symbol historical stock bars across all pages. */
    iterateStockBarSingle(req: Omit<WithTimeframe<marketData.StockBarSingleRequest>, "pageToken">) {
        return pagination.paginate<marketData.StockBar>((pageToken) =>
            this.stocks.stockBarSingle({ ...req, pageToken }).then((r) => ({ items: r.bars ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect single-symbol historical stock bars into one array. */
    collectStockBarSingle(req: Omit<WithTimeframe<marketData.StockBarSingleRequest>, "pageToken">) {
        return pagination.collect<marketData.StockBar>((pageToken) =>
            this.stocks.stockBarSingle({ ...req, pageToken }).then((r) => ({ items: r.bars ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    /** Iterate single-symbol historical stock trades across all pages. */
    iterateStockTradeSingle(req: Omit<marketData.StockTradeSingleRequest, "pageToken">) {
        return pagination.paginate<marketData.StockTrade>((pageToken) =>
            this.stocks.stockTradeSingle({ ...req, pageToken }).then((r) => ({ items: r.trades ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect single-symbol historical stock trades into one array. */
    collectStockTradeSingle(req: Omit<marketData.StockTradeSingleRequest, "pageToken">) {
        return pagination.collect<marketData.StockTrade>((pageToken) =>
            this.stocks.stockTradeSingle({ ...req, pageToken }).then((r) => ({ items: r.trades ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    /** Iterate single-symbol historical stock quotes across all pages. */
    iterateStockQuoteSingle(req: Omit<marketData.StockQuoteSingleRequest, "pageToken">) {
        return pagination.paginate<marketData.StockQuote>((pageToken) =>
            this.stocks.stockQuoteSingle({ ...req, pageToken }).then((r) => ({ items: r.quotes ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect single-symbol historical stock quotes into one array. */
    collectStockQuoteSingle(req: Omit<marketData.StockQuoteSingleRequest, "pageToken">) {
        return pagination.collect<marketData.StockQuote>((pageToken) =>
            this.stocks.stockQuoteSingle({ ...req, pageToken }).then((r) => ({ items: r.quotes ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    /** Iterate single-symbol historical stock auctions across all pages. */
    iterateStockAuctionSingle(req: Omit<marketData.StockAuctionSingleRequest, "pageToken">) {
        return pagination.paginate<marketData.StockDailyAuctions>((pageToken) =>
            this.stocks.stockAuctionSingle({ ...req, pageToken }).then((r) => ({ items: r.auctions ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect single-symbol historical stock auctions into one array. */
    collectStockAuctionSingle(req: Omit<marketData.StockAuctionSingleRequest, "pageToken">) {
        return pagination.collect<marketData.StockDailyAuctions>((pageToken) =>
            this.stocks.stockAuctionSingle({ ...req, pageToken }).then((r) => ({ items: r.auctions ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    /** Iterate news articles across all pages. */
    iterateNews(req: Omit<WithOptionalSymbolList<marketData.NewsRequest>, "pageToken"> = {}) {
        return pagination.paginate<marketData.News>((pageToken) =>
            this.news.news({ ...req, symbols: req.symbols === undefined ? undefined : values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ items: r.news ?? [], nextPageToken: r.nextPageToken })),
        );
    }
    /** Collect news articles into one array. */
    collectNews(req: Omit<WithOptionalSymbolList<marketData.NewsRequest>, "pageToken"> = {}) {
        return pagination.collect<marketData.News>((pageToken) =>
            this.news.news({ ...req, symbols: req.symbols === undefined ? undefined : values.normalizeSymbols(req.symbols), pageToken }).then((r) => ({ items: r.news ?? [], nextPageToken: r.nextPageToken })),
        );
    }

    // --- Pagination: corporate actions (nested multi-array envelope) --------

    /** Iterate each page's `CorporateActions` envelope, following the token. */
    async *iterateCorporateActionsPages(
        req: Omit<WithOptionalSymbolList<marketData.CorporateActionsRequest>, "pageToken">,
    ): AsyncGenerator<marketData.CorporateActions, void, void> {
        let pageToken: string | undefined ;
        const visitedTokens = new Set<string>();
        const symbols = req.symbols === undefined ? undefined : values.normalizeSymbols(req.symbols);
        for (;;) {
            const r = await this.corporateActions.corporateActions({ ...req, symbols, pageToken });
            yield r.corporateActions ?? ({} as marketData.CorporateActions);
            const next = r.nextPageToken ? r.nextPageToken : undefined;
            if (next === undefined || visitedTokens.has(next)) {
                return;
            }
            visitedTokens.add(next);
            pageToken = next;
        }
    }

    /**
     * Collect corporate actions across all pages into one `CorporateActions`
     * object, concatenating each action-type sub-array (cashDividends,
     * forwardSplits, ...) as it appears.
     */
    async collectCorporateActions(
        req: Omit<WithOptionalSymbolList<marketData.CorporateActionsRequest>, "pageToken">,
    ): Promise<marketData.CorporateActions> {
        const merged: { [key: string]: unknown[] } = {};
        for await (const page of this.iterateCorporateActionsPages(req)) {
            for (const key of Object.keys(page)) {
                const value = (page as Record<string, unknown>)[key];
                if (Array.isArray(value)) {
                    (merged[key] ??= []).push(...value);
                }
            }
        }
        return merged as marketData.CorporateActions;
    }
}

/**
 * Single entry point for the Alpaca SDK. Construct once with credentials and
 * access every trading and market-data API (and streaming client) through the
 * grouped {@link Alpaca.trading} and {@link Alpaca.data} namespaces.
 *
 * The facade is two layers, and the rule is simple: every generated REST method
 * is always reachable raw at `alpaca.<group>.<resource>.<method>()` (layer 1),
 * and a curated set of ergonomic helpers is layered additively on top (layer 2)
 * without ever hiding the raw methods. If no ergonomic helper exists for what
 * you need, the generated method is still there. The three discoverability maps
 * make this queryable: `capabilities` (generated, via `findCapabilities`),
 * `ergonomicCapabilities` (helpers, via `findErgonomic`), and
 * `streamingCapabilities` (real-time factories).
 */
export class Alpaca {
    private _trading?: TradingClient;
    private _marketData?: MarketDataClient;
    private readonly options: AlpacaClientOptions;

    constructor(options: AlpacaClientOptions = {}) {
        // Validate eagerly so a misconfigured client fails at construction
        // rather than on the first request. Resolves env-var fallbacks and the
        // OAuth-or-key/secret requirement; the sub-clients re-resolve lazily.
        resolveCredentials(options);
        this.options = options;
    }

    /** Whether this client targets the paper-trading environment. */
    get paper(): boolean {
        return this.options.paper ?? true;
    }

    /** Trading APIs and the trading-updates stream. */
    get trading(): TradingClient {
        return (this._trading ??= new TradingClient(this.options));
    }

    /**
     * Market-data APIs and the market-data streams. The `paper` flag does not
     * apply here — every call targets `data.alpaca.markets`; free vs paid data
     * is governed by your subscription and the `feed` parameter.
     */
    get marketData(): MarketDataClient {
        return (this._marketData ??= new MarketDataClient(this.options));
    }

    /** Alias for {@link Alpaca.marketData}. */
    get data(): MarketDataClient {
        return this.marketData;
    }
}
