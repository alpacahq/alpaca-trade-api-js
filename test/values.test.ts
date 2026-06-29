import { describe, it, expect } from 'vitest';

import {
    TimeFrame,
    TimeFrameUnit,
    formatMoney,
    timeFrame,
    toDate,
    toISO,
    toNumber,
    toNumberOr,
} from '../src/values';
import type * as marketData from '../src/market-data';

describe('toNumber', () => {
    it('parses numeric strings', () => {
        expect(toNumber('1234.56')).toBe(1234.56);
        expect(toNumber('0')).toBe(0);
        expect(toNumber('-12.5')).toBe(-12.5);
        expect(toNumber('42')).toBe(42);
    });

    it('passes through numbers', () => {
        expect(toNumber(3.14)).toBe(3.14);
    });

    it('returns undefined for nullish/empty/unparseable', () => {
        expect(toNumber(null)).toBeUndefined();
        expect(toNumber(undefined)).toBeUndefined();
        expect(toNumber('')).toBeUndefined();
        expect(toNumber('abc')).toBeUndefined();
    });

    it('never returns NaN', () => {
        expect(toNumber('not-a-number')).not.toBeNaN();
        expect(toNumber(NaN)).toBeUndefined();
    });
});

describe('toNumberOr', () => {
    it('returns the parsed value when present', () => {
        expect(toNumberOr('10', 0)).toBe(10);
    });
    it('returns the fallback when missing or unparseable', () => {
        expect(toNumberOr(null, -1)).toBe(-1);
        expect(toNumberOr('', 7)).toBe(7);
        expect(toNumberOr('xyz', 99)).toBe(99);
    });
});

describe('formatMoney', () => {
    it('formats a wire string as localized USD by default', () => {
        expect(formatMoney('1234.5', { locale: 'en-US' })).toBe('$1,234.50');
        expect(formatMoney(1234.5, { locale: 'en-US' })).toBe('$1,234.50');
        expect(formatMoney('0', { locale: 'en-US' })).toBe('$0.00');
    });

    it('honors currency and fraction-digit options', () => {
        expect(formatMoney('1234.567', { locale: 'en-US', currency: 'EUR' })).toBe('€1,234.57');
        expect(formatMoney('1234', { locale: 'en-US', maximumFractionDigits: 0 })).toBe('$1,234');
    });

    it('returns empty string for nullish/empty and passes through unparseable input', () => {
        expect(formatMoney(null)).toBe('');
        expect(formatMoney(undefined)).toBe('');
        expect(formatMoney('')).toBe('');
        expect(formatMoney('not-money')).toBe('not-money');
    });
});

describe('toDate / toISO', () => {
    it('normalizes ISO strings and Dates', () => {
        const iso = '2024-01-02T03:04:05.000Z';
        expect(toDate(iso)?.toISOString()).toBe(iso);
        const d = new Date(iso);
        expect(toDate(d)).toBe(d);
    });

    it('returns undefined for nullish/invalid', () => {
        expect(toDate(null)).toBeUndefined();
        expect(toDate(undefined)).toBeUndefined();
        expect(toDate('not-a-date')).toBeUndefined();
    });

    it('toISO round-trips strings and Dates', () => {
        const iso = '2024-06-15T12:00:00.000Z';
        expect(toISO(iso)).toBe(iso);
        expect(toISO(new Date(iso))).toBe(iso);
        expect(toISO(null)).toBeUndefined();
        expect(toISO('nope')).toBeUndefined();
    });
});

describe('timeFrame builder', () => {
    it('builds valid wire strings', () => {
        expect(timeFrame(1, TimeFrameUnit.Minute)).toBe('1Min');
        expect(timeFrame(5, TimeFrameUnit.Minute)).toBe('5Min');
        expect(timeFrame(59, TimeFrameUnit.Minute)).toBe('59Min');
        expect(timeFrame(2, TimeFrameUnit.Hour)).toBe('2Hour');
        expect(timeFrame(23, TimeFrameUnit.Hour)).toBe('23Hour');
        expect(timeFrame(1, TimeFrameUnit.Day)).toBe('1Day');
        expect(timeFrame(1, TimeFrameUnit.Week)).toBe('1Week');
        expect(timeFrame(1, TimeFrameUnit.Month)).toBe('1Month');
    });

    it('exposes single-unit presets', () => {
        expect(TimeFrame.Minute).toBe('1Min');
        expect(TimeFrame.Hour).toBe('1Hour');
        expect(TimeFrame.Day).toBe('1Day');
        expect(TimeFrame.Week).toBe('1Week');
        expect(TimeFrame.Month).toBe('1Month');
    });

    it('rejects non-positive / non-integer amounts', () => {
        expect(() => timeFrame(0, TimeFrameUnit.Minute)).toThrow(/positive integer/);
        expect(() => timeFrame(-1, TimeFrameUnit.Day)).toThrow(/positive integer/);
        expect(() => timeFrame(1.5, TimeFrameUnit.Minute)).toThrow(/positive integer/);
    });

    it('enforces per-unit ranges', () => {
        expect(() => timeFrame(60, TimeFrameUnit.Minute)).toThrow(/1-59/);
        expect(() => timeFrame(24, TimeFrameUnit.Hour)).toThrow(/1-23/);
        expect(() => timeFrame(2, TimeFrameUnit.Day)).toThrow(/amount must be 1/);
        expect(() => timeFrame(3, TimeFrameUnit.Week)).toThrow(/amount must be 1/);
        expect(() => timeFrame(2, TimeFrameUnit.Month)).toThrow(/amount must be 1/);
    });

    it('drops into a real request type as a string', () => {
        const req: marketData.StockBarsRequest = {
            symbols: 'AAPL',
            timeframe: timeFrame(15, TimeFrameUnit.Minute),
        };
        expect(req.timeframe).toBe('15Min');
    });
});
