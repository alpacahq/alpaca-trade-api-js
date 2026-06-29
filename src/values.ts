/**
 * Generation-safe value helpers that push less validation/conversion onto the
 * caller.
 *
 * Alpaca's API models money/quantity as numeric strings (e.g. `"1234.56"`),
 * timestamps as `Date` on the typed models (though market-data list responses
 * deserialize their symbol-keyed maps verbatim, so nested timestamps can arrive
 * as ISO `string`s at runtime), and `timeframe` as a free-form string even
 * though its grammar is fixed. The official SDKs cope with this differently:
 *
 *   - alpaca-py keeps money fields as `str` and ships a `TimeFrame(amount,
 *     unit)` builder with a `TimeFrameUnit` enum and presets.
 *   - the Go SDK uses `decimal.Decimal` for money and a `NewTimeFrame(n, unit)`
 *     builder with `OneMin`/`OneDay`/... presets.
 *
 * We follow alpaca-py for money (keep the wire-truthful `string`; JS has no
 * built-in decimal and `number` is float64) and add the ergonomic conversion
 * helpers a Go user gets for free, plus the TimeFrame builder both SDKs ship.
 *
 * This module is hand-written and lives outside the generated `apis/`/`models/`
 * trees, which are kept untouched as a faithful snapshot of the OpenAPI spec.
 */

/**
 * A monetary or quantity value as returned by Alpaca: a numeric string such as
 * `"1234.56"`. Kept as `string` to stay wire-truthful and avoid float64
 * precision loss; use {@link toNumber} for display/most math, or a decimal
 * library (decimal.js / big.js) for exact arithmetic on large balances.
 */
export type Money = string;

/**
 * Parse an Alpaca numeric string (or number) into a `number`.
 *
 * Returns `undefined` for `null`/`undefined`/empty and for unparseable values
 * (never throws and never returns `NaN`).
 *
 * Precision note: JavaScript `number` is an IEEE-754 float64. It is exact for
 * integers up to 2^53 and fine for display, but for exact arithmetic on large
 * balances prefer a decimal library (decimal.js / big.js). No such dependency
 * is bundled here.
 */
export function toNumber(value: string | number | null | undefined): number | undefined {
    if (value == null || value === "") {
        return undefined;
    }
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? undefined : n;
}

/**
 * Like {@link toNumber} but returns `fallback` instead of `undefined` when the
 * value is missing or unparseable.
 */
export function toNumberOr(value: string | number | null | undefined, fallback: number): number {
    const n = toNumber(value);
    return n === undefined ? fallback : n;
}

/**
 * Format an Alpaca money value for **display** using `Intl.NumberFormat`
 * (zero dependencies). Accepts the wire `string` (e.g. `"1234.5"`) or a
 * `number` and returns a localized currency string (e.g. `"$1,234.50"`).
 *
 * For unparseable input the original string is returned as-is (or `""` for
 * nullish), so it never throws. This is **display only** — it parses through
 * float64 and is not safe for exact arithmetic on large balances; for that,
 * keep the wire `string` and use a decimal library (see the README money
 * cookbook).
 */
export function formatMoney(
    value: Money | number | null | undefined,
    opts: { currency?: string; locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
    if (value == null || value === "") {
        return "";
    }
    const n = toNumber(value);
    if (n === undefined) {
        return String(value);
    }
    const { currency = "USD", locale, minimumFractionDigits, maximumFractionDigits } = opts;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(n);
}

/**
 * Normalize a time field that may be a `Date` or an ISO `string` (as nested
 * market-data list timestamps can arrive at runtime) into a `Date`. Returns
 * `undefined` for nullish or invalid input (never throws).
 */
export function toDate(value: string | Date | null | undefined): Date | undefined {
    if (value == null) {
        return undefined;
    }
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Normalize a `Date` or string time value into an ISO-8601 string, suitable for
 * request parameters. Returns `undefined` for nullish or invalid input.
 */
export function toISO(value: string | Date | null | undefined): string | undefined {
    const d = toDate(value);
    return d === undefined ? undefined : d.toISOString();
}

declare const timeFrameBrand: unique symbol;

/**
 * A validated `timeframe` request value (e.g. `"5Min"`, `"1Day"`). This is a
 * branded `string`: it is assignable to a plain `string` (so the generated
 * request models still accept it), but a raw string literal is *not* assignable
 * back to `TimeFrameString`. The SDK's facade bar methods require this brand, so
 * callers must go through {@link timeFrame} or a {@link TimeFrame} preset rather
 * than passing an unvalidated string.
 */
export type TimeFrameString = string & { readonly [timeFrameBrand]: true };

/**
 * Base unit of a {@link timeFrame}. Values are the wire tokens Alpaca expects.
 * Mirrors alpaca-py's `TimeFrameUnit`.
 */
export enum TimeFrameUnit {
    Minute = "Min",
    Hour = "Hour",
    Day = "Day",
    Week = "Week",
    Month = "Month",
}

/**
 * Build a `timeframe` request value (e.g. `"5Min"`, `"1Day"`) from an amount
 * and unit, validating the combination the way alpaca-py does:
 *
 *   - Minute: 1-59
 *   - Hour:   1-23
 *   - Day / Week / Month: exactly 1
 *
 * Throws a descriptive error for invalid input rather than letting the API
 * reject it at request time. Returns a plain `string` so it drops directly into
 * any `timeframe` request field.
 */
export function timeFrame(amount: number, unit: TimeFrameUnit): TimeFrameString {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(`TimeFrame amount must be a positive integer, got ${amount}.`);
    }
    switch (unit) {
        case TimeFrameUnit.Minute:
            if (amount > 59) {
                throw new Error(`TimeFrame minutes must be 1-59, got ${amount}.`);
            }
            break;
        case TimeFrameUnit.Hour:
            if (amount > 23) {
                throw new Error(`TimeFrame hours must be 1-23, got ${amount}.`);
            }
            break;
        case TimeFrameUnit.Day:
        case TimeFrameUnit.Week:
        case TimeFrameUnit.Month:
            if (amount !== 1) {
                throw new Error(`TimeFrame ${unit} amount must be 1, got ${amount}.`);
            }
            break;
        default:
            throw new Error(`Unknown TimeFrameUnit: "${unit as string}".`);
    }
    return `${amount}${unit}` as TimeFrameString;
}

/**
 * Presets for the common single-unit timeframes (mirrors the Go SDK's
 * `OneMin`/`OneHour`/...). Each is the wire string accepted by `timeframe`.
 */
export const TimeFrame = {
    Minute: timeFrame(1, TimeFrameUnit.Minute),
    Hour: timeFrame(1, TimeFrameUnit.Hour),
    Day: timeFrame(1, TimeFrameUnit.Day),
    Week: timeFrame(1, TimeFrameUnit.Week),
    Month: timeFrame(1, TimeFrameUnit.Month),
} as const;

/**
 * Normalize a `symbols` argument into the comma-separated string Alpaca's
 * market-data endpoints expect. Accepts a ready-made string (returned as-is) or
 * an array of symbols (joined with `,`), so callers can pass the JS-idiomatic
 * `["AAPL", "MSFT"]` instead of hand-joining `"AAPL,MSFT"`.
 */
export function normalizeSymbols(symbols: string | string[]): string {
    return Array.isArray(symbols) ? symbols.join(",") : symbols;
}
