import type { OrdersApi, SubmitAndWaitError, SubmitAndWaitPhase } from "../../src";
import type * as orders from "../../src/orders";

type Equal<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends
    (<T>() => T extends Expected ? 1 : 2)
        ? true
        : false;

type Assert<Condition extends true> = Condition;

export type OrdersErgonomicMethodContracts = [
    Assert<Equal<Parameters<OrdersApi["market"]>, [input: orders.MarketOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["limit"]>, [input: orders.LimitOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["stop"]>, [input: orders.StopOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["stopLimit"]>, [input: orders.StopLimitOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["trailingStop"]>, [input: orders.TrailingStopOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["bracket"]>, [input: orders.BracketOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["oco"]>, [input: orders.OcoOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["oto"]>, [input: orders.OtoOrderInput]>>,
    Assert<Equal<Parameters<OrdersApi["submit"]>, [input: orders.OrderInput]>>,
];

declare const submitAndWaitError: SubmitAndWaitError;
const clientOrderId: string = submitAndWaitError.clientOrderId;
const phase: SubmitAndWaitPhase = submitAndWaitError.phase;
const placementAmbiguous: boolean = submitAndWaitError.placementAmbiguous;
const cause: unknown = submitAndWaitError.cause;
const orderId: string | undefined = submitAndWaitError.orderId;

export type SubmitAndWaitErrorContract = [
    typeof clientOrderId,
    typeof phase,
    typeof placementAmbiguous,
    typeof cause,
    typeof orderId,
];
