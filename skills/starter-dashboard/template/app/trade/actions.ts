"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";

const optionalNumber = z.number().positive().optional();

const SubmitOrderInput = z
  .object({
    symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
    side: z.enum(["buy", "sell"]),
    type: z.enum(["market", "limit"]),
    timeInForce: z.enum(["day", "gtc"]),
    qty: optionalNumber,
    notional: optionalNumber,
    limitPrice: optionalNumber,
  })
  .refine((value) => value.qty || value.notional, {
    message: "Enter either quantity or notional.",
    path: ["qty"],
  })
  .refine((value) => !(value.qty && value.notional), {
    message: "Use quantity or notional, not both.",
    path: ["notional"],
  })
  .refine((value) => value.type === "market" || (value.qty && value.limitPrice && !value.notional), {
    message: "Limit orders require quantity and limit price, not notional.",
    path: ["limitPrice"],
  });

function readOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return Number(value);
}

function tradeUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/trade?${search}`;
}

export async function submitOrder(formData: FormData): Promise<void> {
  const parsed = SubmitOrderInput.safeParse({
    symbol: formData.get("symbol"),
    side: formData.get("side"),
    type: formData.get("type"),
    timeInForce: formData.get("timeInForce"),
    qty: readOptionalNumber(formData.get("qty")),
    notional: readOptionalNumber(formData.get("notional")),
    limitPrice: readOptionalNumber(formData.get("limitPrice")),
  });

  if (!parsed.success) {
    redirect(tradeUrl({ error: parsed.error.issues[0]?.message ?? "Invalid order." }));
  }

  const input = parsed.data;

  let nextParams: Record<string, string>;
  try {
    const order =
      input.type === "limit"
        ? await getAlpaca().trading.orders.limit({
            symbol: input.symbol,
            side: input.side,
            qty: input.qty as number,
            limitPrice: input.limitPrice as number,
            timeInForce: input.timeInForce,
          })
        : input.notional !== undefined
          ? await getAlpaca().trading.orders.market({
              symbol: input.symbol,
              side: input.side,
              notional: input.notional,
              timeInForce: input.timeInForce,
            })
          : await getAlpaca().trading.orders.market({
              symbol: input.symbol,
              side: input.side,
              qty: input.qty as number,
              timeInForce: input.timeInForce,
            });

    nextParams = {
      ok: "1",
      symbol: order.symbol ?? input.symbol,
      status: order.status ?? "submitted",
      id: order.id ?? "",
    };
  } catch (error) {
    nextParams = { error: describeAlpacaError(error) };
  }

  redirect(tradeUrl(nextParams));
}
