/**
 * Canonical Alpaca OpenAPI spec sources. Fetched fresh from docs.alpaca.markets
 * so they reflect the published API surface; the pipeline normalizes and diffs
 * them against the pinned snapshot before adopting.
 */
export const SPEC_BASE_URL = "https://docs.alpaca.markets/us/openapi";

export const SPEC_FILES: Record<string, string> = {
  trading: "trading-api.json",
  "market-data": "market-data-api.json",
};

export async function fetchSpec(file: string): Promise<unknown> {
  const url = `${SPEC_BASE_URL}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
