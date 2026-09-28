import { describe, it, expect } from 'vitest';

import {
    StockDailyAuctionsFromJSON,
    NewsFromJSON,
    NewsRespFromJSON,
    MoversRespFromJSON,
    MostActivesRespFromJSON,
    CryptoOrderbookFromJSON,
    CorporateActionEventFromJSON,
    CorporateActionEventToJSON,
    instanceOfCorporateActionEvent,
    StockAuctionsRespSingleFromJSON,
    StockBarsRespFromJSON,
    StockLatestBarsRespFromJSON,
    StockBarsRespSingleFromJSON,
    StockQuotesRespFromJSON,
    StockQuotesRespSingleFromJSON,
    StockTradesRespFromJSON,
    StockTradesRespSingleFromJSON,
} from '../src/market-data';
import {
    ClockRespFromJSON,
    OptionContractsResponseFromJSON,
    PublicCalendarRespFromJSON,
    AccountFromJSON,
    AccountToJSON,
    OrderFromJSON,
    AccountConfigurationsFromJSON,
    OptionContractFromJSON,
    GetAccountActivities200ResponseInnerFromJSON,
    CorporateAnnouncementFromJSON,
    ActivityV2DetailNTAFromJSON,
    ActivityV2DetailNTAToJSON,
    CDIVActivityV2FromJSON,
    CommonCDIVActivityV2FromJSON,
    DIVSPDActivityV2FromJSON,
    OpcaCDIVActivityV2FromJSON,
} from '../src/trading';

// --- G01: null-safe array deserialization ----------------------------------
//
// Every required-array read site we guarded. Each case feeds `null` for the
// array field(s) on an otherwise-valid HTTP 200 body and asserts we return [].

type G01Case = {
    name: string;
    fn: (json: any) => any;
    input: any;
    arrayFields: string[];
};

const G01_CASES: G01Case[] = [
    { name: 'StockDailyAuctions', fn: StockDailyAuctionsFromJSON, input: { c: null, d: '2024-01-02', o: null }, arrayFields: ['c', 'o'] },
    { name: 'NewsResp', fn: NewsRespFromJSON, input: { news: null }, arrayFields: ['news'] },
    { name: 'MoversResp', fn: MoversRespFromJSON, input: { gainers: null, losers: null }, arrayFields: ['gainers', 'losers'] },
    { name: 'MostActivesResp', fn: MostActivesRespFromJSON, input: { most_actives: null }, arrayFields: ['mostActives'] },
    { name: 'CryptoOrderbook', fn: CryptoOrderbookFromJSON, input: { a: null, b: null, t: '2024-01-02T00:00:00Z' }, arrayFields: ['a', 'b'] },
    { name: 'StockAuctionsRespSingle', fn: StockAuctionsRespSingleFromJSON, input: { auctions: null }, arrayFields: ['auctions'] },
    { name: 'StockBarsRespSingle', fn: StockBarsRespSingleFromJSON, input: { bars: null }, arrayFields: ['bars'] },
    { name: 'StockQuotesRespSingle', fn: StockQuotesRespSingleFromJSON, input: { quotes: null }, arrayFields: ['quotes'] },
    { name: 'StockTradesRespSingle', fn: StockTradesRespSingleFromJSON, input: { trades: null }, arrayFields: ['trades'] },
    { name: 'ClockResp', fn: ClockRespFromJSON, input: { clocks: null }, arrayFields: ['clocks'] },
    { name: 'OptionContractsResponse', fn: OptionContractsResponseFromJSON, input: { option_contracts: null }, arrayFields: ['optionContracts'] },
    { name: 'PublicCalendarResp', fn: PublicCalendarRespFromJSON, input: { calendar: null }, arrayFields: ['calendar'] },
];

describe('G01 null-safe array deserialization', () => {
    for (const { name, fn, input, arrayFields } of G01_CASES) {
        it(`${name}: null array fields deserialize to [] instead of throwing`, () => {
            const result = fn(input);
            for (const field of arrayFields) {
                expect(result[field]).toEqual([]);
            }
        });

        it(`${name}: missing array fields (undefined) also deserialize to []`, () => {
            const result = fn({});
            for (const field of arrayFields) {
                expect(result[field]).toEqual([]);
            }
        });
    }

    it('News.images (Set-wrapped): null deserializes to an empty Set', () => {
        const result = NewsFromJSON({ images: null });
        expect(result.images).toBeInstanceOf(Set);
        expect(result.images.size).toBe(0);
    });

    it('News.images: populated array deserializes to a Set of entries', () => {
        const result = NewsFromJSON({ images: [{ size: 'large', url: 'https://x/y.png' }] });
        expect(result.images).toBeInstanceOf(Set);
        expect(result.images.size).toBe(1);
    });

    it('still deserializes populated arrays correctly', () => {
        const result = StockDailyAuctionsFromJSON({
            c: [{ c: ['@'], p: 1, s: 2, t: '2024-01-02T21:00:00Z', x: 'P' }],
            d: '2024-01-02',
            o: [],
        });
        expect(result.c).toHaveLength(1);
        expect(result.o).toEqual([]);
    });

    it('propagates the guard through nested arrays (auctions[].o = null)', () => {
        const result = StockAuctionsRespSingleFromJSON({
            symbol: 'AAPL',
            auctions: [{ c: [], d: '2024-01-02', o: null }],
        });
        expect(result.auctions).toHaveLength(1);
        expect(result.auctions[0].o).toEqual([]);
    });
});

// --- G08: null-safe map deserialization ------------------------------------

type G08Case = {
    name: string;
    fn: (json: any) => any;
    mapField: string;
};

const G08_CASES: G08Case[] = [
    { name: 'StockBarsResp', fn: StockBarsRespFromJSON, mapField: 'bars' },
    { name: 'StockTradesResp', fn: StockTradesRespFromJSON, mapField: 'trades' },
    { name: 'StockQuotesResp', fn: StockQuotesRespFromJSON, mapField: 'quotes' },
];

describe('G08 null-safe map deserialization', () => {
    for (const { name, fn, mapField } of G08_CASES) {
        it(`${name}: null map fields deserialize to {}`, () => {
            expect(fn({ [mapField]: null })[mapField]).toEqual({});
        });

        it(`${name}: missing map fields deserialize to {}`, () => {
            expect(fn({})[mapField]).toEqual({});
        });
    }

    it('preserves populated historical symbol maps', () => {
        const bars = { AAPL: [{ c: 190 }] };
        expect(StockBarsRespFromJSON({ bars }).bars).toEqual(bars);
    });

    it('guards object-valued maps before mapValues deserialization', () => {
        expect(StockLatestBarsRespFromJSON({ bars: null }).bars).toEqual({});

        const result = StockLatestBarsRespFromJSON({
            bars: {
                AAPL: {
                    c: 190,
                    h: 191,
                    l: 189,
                    n: 10,
                    o: 189.5,
                    t: '2024-01-02T15:00:00Z',
                    v: 100,
                    vw: 190.25,
                },
            },
        });
        expect(result.bars.AAPL.t).toEqual(new Date('2024-01-02T15:00:00Z'));
    });
});

describe('oneOf conversion fidelity', () => {
    it('selects the most specific overlapping activity detail model', () => {
        const wire = {
            system_date: '2026-09-25',
            external_id: 'external',
            request_id: 'request',
            symbol: 'AAPL',
        };

        const model = ActivityV2DetailNTAFromJSON(wire);

        expect(model).toMatchObject({ symbol: 'AAPL' });
        expect(ActivityV2DetailNTAToJSON(model)).toMatchObject(wire);
    });

    it('uses typed discriminator names and emits only the wire discriminator', () => {
        const wire = {
            action: 'insert',
            at: '2026-09-25T12:00:00Z',
            event_id: '01K00000000000000000000000',
            event_type: 'cash_dividend_corporateaction_event',
            region: 'us',
            ca: {
                id: 'ca-id',
                process_date: '2026-09-25',
                cusip: '037833100',
                ex_date: '2026-09-25',
                foreign: false,
                rate: '0.24',
                special: false,
                symbol: 'AAPL',
            },
        };

        const model = CorporateActionEventFromJSON(wire);
        const roundTrip = CorporateActionEventToJSON(model);

        expect(instanceOfCorporateActionEvent(model)).toBe(true);
        expect(roundTrip.event_type).toBe(wire.event_type);
        expect(roundTrip).not.toHaveProperty('eventType');
    });
});

describe('Trading dividend activity string flags', () => {
    it.each([
        ['CDIVActivityV2', CDIVActivityV2FromJSON],
        ['CommonCDIVActivityV2', CommonCDIVActivityV2FromJSON],
        ['DIVSPDActivityV2', DIVSPDActivityV2FromJSON],
        ['OpcaCDIVActivityV2', OpcaCDIVActivityV2FromJSON],
    ])('%s preserves wire string flags without boolean coercion', (_name, fromJSON) => {
        const model = fromJSON({
            foreign: 'false',
            special: 'true',
        });

        expect(model.foreign).toBe('false');
        expect(model.special).toBe('true');
        expect(typeof model.foreign).toBe('string');
        expect(typeof model.special).toBe('string');
    });
});

// --- G02: undocumented field passthrough ------------------------------------

type G02Case = { name: string; fn: (json: any) => any; base: any };

const G02_CASES: G02Case[] = [
    { name: 'Account', fn: AccountFromJSON, base: { id: 'a', status: 'ACTIVE' } },
    { name: 'Order', fn: OrderFromJSON, base: { id: 'o' } },
    { name: 'AccountConfigurations', fn: AccountConfigurationsFromJSON, base: {} },
    { name: 'OptionContract', fn: OptionContractFromJSON, base: {} },
    { name: 'GetAccountActivities200ResponseInner', fn: GetAccountActivities200ResponseInnerFromJSON, base: {} },
    { name: 'CorporateAnnouncement', fn: CorporateAnnouncementFromJSON, base: {} },
];

describe('G02 undocumented field passthrough', () => {
    for (const { name, fn, base } of G02_CASES) {
        it(`${name}: exposes wire fields the frozen spec does not declare`, () => {
            const result = fn({ ...base, undocumented_field: 'keep-me', another_extra: 42 });
            expect(result.undocumented_field).toBe('keep-me');
            expect(result.another_extra).toBe(42);
        });
    }

    it('Account: documented fields stay camelCase and override raw wire values', () => {
        const result = AccountFromJSON({
            id: 'acct-1',
            status: 'ACTIVE',
            buying_power: '1000',
            effective_buying_power: '2000',
            position_market_value: '500',
        });
        expect(result.buyingPower).toBe('1000'); // documented mapping (camelCase)
        expect(result.effective_buying_power).toBe('2000'); // undocumented passthrough
        expect(result.position_market_value).toBe('500');
    });

    it('Account: ToJSON does not re-emit undocumented passthrough keys (round-trip is clean)', () => {
        const model = AccountFromJSON({ id: 'acct-1', status: 'ACTIVE', effective_buying_power: '2000' });
        const wire = AccountToJSON(model);
        expect(wire).not.toHaveProperty('effective_buying_power');
        expect(wire.id).toBe('acct-1');
    });
});
