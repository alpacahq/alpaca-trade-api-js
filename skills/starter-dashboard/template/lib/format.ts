export type Tone = "positive" | "negative" | "neutral";

export function parseNumber(value: string | number | null | undefined): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatMoney(value: string | number | null | undefined): string {
  const number = parseNumber(value);
  if (number === null) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatSignedMoney(value: string | number | null | undefined): string {
  const number = parseNumber(value);
  if (number === null) return "-";

  return `${number > 0 ? "+" : ""}${formatMoney(number)}`;
}

/** Formats a decimal fraction (e.g. 0.0523) as a signed percent ("+5.23%"). */
export function formatPercent(value: string | number | null | undefined): string {
  const number = parseNumber(value);
  if (number === null) return "-";

  return `${number > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)}`;
}

export function toneOf(value: string | number | null | undefined): Tone {
  const number = parseNumber(value);
  if (number === null || number === 0) return "neutral";
  return number > 0 ? "positive" : "negative";
}

export function formatNumber(value: string | number | null | undefined): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "-";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(number);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "-";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
