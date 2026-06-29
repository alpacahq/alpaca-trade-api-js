import "server-only";

import { Alpaca, ApiError, RateLimitError } from "@alpacahq/alpaca-ts-alpha";

let cached: Alpaca | undefined;

export function getAlpaca(): Alpaca {
  const keyId = process.env.APCA_API_KEY_ID;
  const secret = process.env.APCA_API_SECRET_KEY;

  if (!keyId || !secret) {
    throw new Error("Set APCA_API_KEY_ID and APCA_API_SECRET_KEY in .env.local.");
  }

  cached ??= new Alpaca({
    keyId,
    secret,
    paper: process.env.APCA_PAPER !== "false",
    timeoutMs: 10_000,
    retry: { maxRetries: 2 },
  });

  return cached;
}

export function describeAlpacaError(error: unknown): string {
  if (error instanceof RateLimitError) {
    return `Rate limited. Retry after ${error.retryAfterMs ?? "unknown"}ms. Request id: ${error.requestId ?? "n/a"}.`;
  }

  if (error instanceof ApiError) {
    return `Alpaca API error ${error.status}${error.code ? ` (${error.code})` : ""}: ${error.message}. Request id: ${error.requestId ?? "n/a"}.`;
  }

  return error instanceof Error ? error.message : "Unknown error.";
}
