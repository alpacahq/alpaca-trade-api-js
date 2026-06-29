/**
 * Generation-safe, ergonomic builders for the `POST /v2/orders` request.
 *
 * The generated `OrdersApi.postOrder` takes a doubly-wrapped argument
 * (`postOrder({ postOrderRequest: { ... } })`) and the underlying
 * {@link PostOrderRequest} marks only `type`/`timeInForce` as required, so an
 * order missing its `symbol`, `side`, or `qty` still type-checks and only fails
 * at request time. These builders fix both problems the way alpaca-py and the
 * Go SDK do: one ergonomic call per order kind, with the fields each kind
 * actually needs required at compile time (via discriminated-union inputs), and
 * `qty`/prices accepted as `number | string` (normalized to the wire-truthful
 * `string`).
 *
 * Each builder is pure (no network) and returns a typed {@link PostOrderRequest}
 * ready to hand to `postOrder({ postOrderRequest })`. The facade's
 * `alpaca.trading.orders` exposes thin methods (`.market()`, `.limit()`, ...)
 * that submit the built request for you.
 *
 * This module is hand-written and lives outside the generated `apis/`/`models/`
 * trees, which are kept untouched as a faithful snapshot of the OpenAPI spec.
 *
 * @example
 * ```ts
 * import { orders } from "@alpacahq/alpaca-ts-alpha";
 *
 * const req = orders.buildLimitOrder({ symbol: "AAPL", qty: 10, side: "buy", limitPrice: 150 });
 * await tradingOrdersApi.postOrder({ postOrderRequest: req });
 * ```
 */
import type {
    OrderSide,
    OrderType,
    OrderClass,
    TimeInForce,
    PositionIntent,
    PostOrderRequest,
    PostOrderRequestTakeProfit,
    PostOrderRequestStopLoss,
    MLegOrderLeg,
    AdvancedInstructions,
    InitOverrideFunction,
} from "./trading";

/**
 * A monetary or quantity input. Accepted as a `number` for ergonomics or a
 * `string` to stay wire-truthful for large/precise values; normalized to the
 * `string` Alpaca expects on the wire.
 */
export type Amount = number | string;

/**
 * Normalize a quantity/price input to the numeric string Alpaca expects.
 * Throws early (rather than failing at request time) for non-finite numbers or
 * empty/non-string-or-number input.
 */
export function toAmountString(value: Amount, field: string = "amount"): string {
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`Order ${field} must be a finite number, got ${value}.`);
        }
        return String(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") {
            throw new Error(`Order ${field} must be a non-empty value.`);
        }
        return trimmed;
    }
    throw new Error(`Order ${field} must be a number or string, got ${typeof value}.`);
}

/**
 * Per-submission options for the ergonomic order methods (headers/transport
 * concerns that aren't part of the order body).
 */
export interface OrderSubmitOptions {
    /**
     * `Idempotency-Key` for this POST. Replaying the same key with the same
     * parameters within Alpaca's 24h window returns the original response
     * instead of creating a duplicate order, which makes a `POST` safe to retry
     * yourself (the transport never auto-retries non-idempotent methods). Reusing
     * a key with *different* parameters is rejected by the server.
     */
    idempotencyKey?: string;
}

/**
 * Build the `initOverrides` for an order submission from
 * {@link OrderSubmitOptions}. Returns `undefined` when there is nothing to add
 * (so the generated method keeps its defaults). Merges onto the existing headers
 * (preserving auth) rather than replacing them.
 */
export function orderInitOverrides(
    options?: OrderSubmitOptions,
): InitOverrideFunction | undefined {
    const key = options?.idempotencyKey;
    if (!key) {
        return undefined;
    }
    return async ({ init }) => ({
        headers: { ...(init.headers as Record<string, string>), "Idempotency-Key": key },
    });
}

/** Fields shared by every order kind. `timeInForce` defaults to `"day"`. */
export interface CommonOrderFields {
    /** Time-in-force. Defaults to `"day"`. */
    timeInForce?: TimeInForce;
    /** Client-supplied unique id (<= 128 chars). */
    clientOrderId?: string;
    /** Allow execution in pre/post/overnight sessions (limit + day/gtc only). */
    extendedHours?: boolean;
    /** Desired position strategy (e.g. `"buy_to_open"`). */
    positionIntent?: PositionIntent;
}

// Enforce "exactly one of qty | notional" at the type level.
type QtyOnly = { qty: Amount; notional?: never };
type NotionalOnly = { notional: Amount; qty?: never };

/** A market order. Requires `symbol`, `side`, and exactly one of `qty`/`notional`. */
export type MarketOrderInput = CommonOrderFields & {
    symbol: string;
    side: OrderSide;
} & (QtyOnly | NotionalOnly);

/** A limit order. Requires `symbol`, `side`, `qty`, and `limitPrice`. */
export interface LimitOrderInput extends CommonOrderFields {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    limitPrice: Amount;
}

/** A stop (stop-market) order. Requires `symbol`, `side`, `qty`, and `stopPrice`. */
export interface StopOrderInput extends CommonOrderFields {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    stopPrice: Amount;
}

/** A stop-limit order. Requires `symbol`, `side`, `qty`, `stopPrice`, and `limitPrice`. */
export interface StopLimitOrderInput extends CommonOrderFields {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    stopPrice: Amount;
    limitPrice: Amount;
}

// Enforce "exactly one of trailPrice | trailPercent" at the type level.
type TrailPriceOnly = { trailPrice: Amount; trailPercent?: never };
type TrailPercentOnly = { trailPercent: Amount; trailPrice?: never };

/** A trailing-stop order. Requires `symbol`, `side`, `qty`, and one of `trailPrice`/`trailPercent`. */
export type TrailingStopOrderInput = CommonOrderFields & {
    symbol: string;
    side: OrderSide;
    qty: Amount;
} & (TrailPriceOnly | TrailPercentOnly);

/** Take-profit leg of a bracket/OCO/OTO order. */
export interface TakeProfitInput {
    limitPrice: Amount;
}

/** Stop-loss leg of a bracket/OCO/OTO order. */
export interface StopLossInput {
    stopPrice: Amount;
    /** Optional: makes the stop a stop-limit instead of stop-market. */
    limitPrice?: Amount;
}

/**
 * A bracket order (entry plus take-profit and stop-loss legs). Pass `limitPrice`
 * for a limit entry; omit it for a market entry. Both legs are required.
 */
export interface BracketOrderInput extends CommonOrderFields {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    /** Present -> limit entry; absent -> market entry. */
    limitPrice?: Amount;
    takeProfit: TakeProfitInput;
    stopLoss: StopLossInput;
}

/**
 * A one-cancels-other (OCO) order: a take-profit and a stop-loss attached to an
 * existing position (no entry). Submitted as `type: "limit"`.
 */
export interface OcoOrderInput extends CommonOrderFields {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    takeProfit: TakeProfitInput;
    stopLoss: StopLossInput;
}

// Enforce "exactly one of takeProfit | stopLoss" for OTO.
type OtoTakeProfit = { takeProfit: TakeProfitInput; stopLoss?: never };
type OtoStopLoss = { stopLoss: StopLossInput; takeProfit?: never };

/**
 * A one-triggers-other (OTO) order: an entry that, once filled, triggers a
 * single take-profit or stop-loss leg. Pass `limitPrice` for a limit entry;
 * omit it for a market entry.
 */
export type OtoOrderInput = CommonOrderFields & {
    symbol: string;
    side: OrderSide;
    qty: Amount;
    /** Present -> limit entry; absent -> market entry. */
    limitPrice?: Amount;
} & (OtoTakeProfit | OtoStopLoss);

/**
 * Near-raw input for the generic {@link buildOrder} escape hatch: the full
 * {@link PostOrderRequest} surface with amount fields accepted as `number |
 * string`. Use this for order shapes the typed builders don't cover (e.g.
 * multi-leg `mleg` options).
 */
export interface OrderInput extends CommonOrderFields {
    type: OrderType;
    symbol?: string;
    side?: OrderSide;
    orderClass?: OrderClass;
    qty?: Amount;
    notional?: Amount;
    limitPrice?: Amount;
    stopPrice?: Amount;
    trailPrice?: Amount;
    trailPercent?: Amount;
    takeProfit?: TakeProfitInput;
    stopLoss?: StopLossInput;
    legs?: Array<MLegOrderLeg>;
    advancedInstructions?: AdvancedInstructions;
}

function applyCommon(req: PostOrderRequest, input: CommonOrderFields): void {
    if (input.clientOrderId !== undefined) req.clientOrderId = input.clientOrderId;
    if (input.extendedHours !== undefined) req.extendedHours = input.extendedHours;
    if (input.positionIntent !== undefined) req.positionIntent = input.positionIntent;
}

function buildTakeProfit(tp: TakeProfitInput): PostOrderRequestTakeProfit {
    return { limitPrice: toAmountString(tp.limitPrice, "takeProfit.limitPrice") };
}

function buildStopLoss(sl: StopLossInput): PostOrderRequestStopLoss {
    const out: PostOrderRequestStopLoss = {
        stopPrice: toAmountString(sl.stopPrice, "stopLoss.stopPrice"),
    };
    if (sl.limitPrice !== undefined) {
        out.limitPrice = toAmountString(sl.limitPrice, "stopLoss.limitPrice");
    }
    return out;
}

/** Build a market order request. */
export function buildMarketOrder(input: MarketOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "market",
        timeInForce: input.timeInForce ?? "day",
    };
    if ("notional" in input && input.notional !== undefined) {
        req.notional = toAmountString(input.notional, "notional");
    } else if ("qty" in input && input.qty !== undefined) {
        req.qty = toAmountString(input.qty, "qty");
    } else {
        throw new Error("A market order requires either `qty` or `notional`.");
    }
    applyCommon(req, input);
    return req;
}

/** Build a limit order request. */
export function buildLimitOrder(input: LimitOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "limit",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        limitPrice: toAmountString(input.limitPrice, "limitPrice"),
    };
    applyCommon(req, input);
    return req;
}

/** Build a stop (stop-market) order request. */
export function buildStopOrder(input: StopOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "stop",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        stopPrice: toAmountString(input.stopPrice, "stopPrice"),
    };
    applyCommon(req, input);
    return req;
}

/** Build a stop-limit order request. */
export function buildStopLimitOrder(input: StopLimitOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "stop_limit",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        stopPrice: toAmountString(input.stopPrice, "stopPrice"),
        limitPrice: toAmountString(input.limitPrice, "limitPrice"),
    };
    applyCommon(req, input);
    return req;
}

/** Build a trailing-stop order request. */
export function buildTrailingStopOrder(input: TrailingStopOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "trailing_stop",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
    };
    if ("trailPrice" in input && input.trailPrice !== undefined) {
        req.trailPrice = toAmountString(input.trailPrice, "trailPrice");
    } else if ("trailPercent" in input && input.trailPercent !== undefined) {
        req.trailPercent = toAmountString(input.trailPercent, "trailPercent");
    } else {
        throw new Error("A trailing-stop order requires either `trailPrice` or `trailPercent`.");
    }
    applyCommon(req, input);
    return req;
}

/** Build a bracket order request (entry + take-profit + stop-loss). */
export function buildBracketOrder(input: BracketOrderInput): PostOrderRequest {
    const isLimit = input.limitPrice !== undefined;
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: isLimit ? "limit" : "market",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        orderClass: "bracket",
        takeProfit: buildTakeProfit(input.takeProfit),
        stopLoss: buildStopLoss(input.stopLoss),
    };
    if (isLimit) {
        req.limitPrice = toAmountString(input.limitPrice as Amount, "limitPrice");
    }
    applyCommon(req, input);
    return req;
}

/** Build a one-cancels-other (OCO) order request. */
export function buildOcoOrder(input: OcoOrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: "limit",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        orderClass: "oco",
        takeProfit: buildTakeProfit(input.takeProfit),
        stopLoss: buildStopLoss(input.stopLoss),
    };
    applyCommon(req, input);
    return req;
}

/** Build a one-triggers-other (OTO) order request. */
export function buildOtoOrder(input: OtoOrderInput): PostOrderRequest {
    const isLimit = input.limitPrice !== undefined;
    const req: PostOrderRequest = {
        symbol: input.symbol,
        side: input.side,
        type: isLimit ? "limit" : "market",
        timeInForce: input.timeInForce ?? "day",
        qty: toAmountString(input.qty, "qty"),
        orderClass: "oto",
    };
    if (isLimit) {
        req.limitPrice = toAmountString(input.limitPrice as Amount, "limitPrice");
    }
    if ("takeProfit" in input && input.takeProfit !== undefined) {
        req.takeProfit = buildTakeProfit(input.takeProfit);
    } else if ("stopLoss" in input && input.stopLoss !== undefined) {
        req.stopLoss = buildStopLoss(input.stopLoss);
    } else {
        throw new Error("An OTO order requires either `takeProfit` or `stopLoss`.");
    }
    applyCommon(req, input);
    return req;
}

/**
 * Generic escape hatch: build a {@link PostOrderRequest} from a near-raw input,
 * normalizing the amount fields (`qty`/`notional`/prices/trails and the
 * take-profit/stop-loss legs) to wire strings. `type` is required; everything
 * else is passed through as given. Use the typed builders above when possible;
 * reach for this only for shapes they don't cover (e.g. `mleg`).
 */
export function buildOrder(input: OrderInput): PostOrderRequest {
    const req: PostOrderRequest = {
        type: input.type,
        timeInForce: input.timeInForce ?? "day",
    };
    if (input.symbol !== undefined) req.symbol = input.symbol;
    if (input.side !== undefined) req.side = input.side;
    if (input.orderClass !== undefined) req.orderClass = input.orderClass;
    if (input.qty !== undefined) req.qty = toAmountString(input.qty, "qty");
    if (input.notional !== undefined) req.notional = toAmountString(input.notional, "notional");
    if (input.limitPrice !== undefined) req.limitPrice = toAmountString(input.limitPrice, "limitPrice");
    if (input.stopPrice !== undefined) req.stopPrice = toAmountString(input.stopPrice, "stopPrice");
    if (input.trailPrice !== undefined) req.trailPrice = toAmountString(input.trailPrice, "trailPrice");
    if (input.trailPercent !== undefined) req.trailPercent = toAmountString(input.trailPercent, "trailPercent");
    if (input.takeProfit !== undefined) req.takeProfit = buildTakeProfit(input.takeProfit);
    if (input.stopLoss !== undefined) req.stopLoss = buildStopLoss(input.stopLoss);
    if (input.legs !== undefined) req.legs = input.legs;
    if (input.advancedInstructions !== undefined) req.advancedInstructions = input.advancedInstructions;
    applyCommon(req, input);
    return req;
}
