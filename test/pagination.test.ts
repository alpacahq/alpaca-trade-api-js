import { describe, it, expect } from 'vitest';

import {
    chunk,
    collect,
    collectBySymbol,
    collectCursor,
    collectSymbolObjects,
    mapConcurrent,
    paginate,
    paginateCursor,
    paginateSymbolMap,
    paginateSymbolObjects,
    type Page,
    type SymbolMapPage,
    type SymbolObjectPage,
} from '../src/pagination';

describe('G04 pagination helpers', () => {
    const threePages: Record<string, Page<number>> = {
        '': { items: [1, 2], nextPageToken: 'p2' },
        p2: { items: [3, 4], nextPageToken: 'p3' },
        p3: { items: [5], nextPageToken: null },
    };

    it('collect() follows nextPageToken until exhausted', async () => {
        const all = await collect<number>(async (token) => threePages[token ?? '']);
        expect(all).toEqual([1, 2, 3, 4, 5]);
    });

    it('paginate() passes the correct token to each fetch and visits pages in order', async () => {
        const seenTokens: Array<string | undefined> = [];
        const out: number[] = [];
        for await (const item of paginate<number>(async (token) => {
            seenTokens.push(token);
            return threePages[token ?? ''];
        })) {
            out.push(item);
        }
        expect(out).toEqual([1, 2, 3, 4, 5]);
        expect(seenTokens).toEqual([undefined, 'p2', 'p3']);
    });

    it('paginate() yields lazily and stops fetching on early break', async () => {
        let fetches = 0;
        const out: number[] = [];
        for await (const item of paginate<number>(async (token) => {
            fetches += 1;
            return threePages[token ?? ''];
        })) {
            out.push(item);
            if (out.length === 3) break;
        }
        expect(out).toEqual([1, 2, 3]);
        expect(fetches).toBe(2); // only the first two pages were fetched
    });

    it('handles a single page with no next token', async () => {
        const all = await collect<number>(async () => ({ items: [42], nextPageToken: undefined }));
        expect(all).toEqual([42]);
    });

    it('treats an empty-string next token as terminal', async () => {
        const all = await collect<number>(async () => ({ items: [7], nextPageToken: '' }));
        expect(all).toEqual([7]);
    });

    it('continues past an empty page that still carries a next token', async () => {
        const pages: Record<string, Page<number>> = {
            '': { items: [], nextPageToken: 'p2' },
            p2: { items: [9], nextPageToken: null },
        };
        const all = await collect<number>(async (token) => pages[token ?? '']);
        expect(all).toEqual([9]);
    });

    it('tolerates a nullish items array without throwing', async () => {
        const all = await collect<number>(async () => ({ items: undefined as unknown as number[], nextPageToken: null }));
        expect(all).toEqual([]);
    });

    it('collect() honors maxItems, truncating the page and not fetching further', async () => {
        let fetches = 0;
        const all = await collect<number>(async (token) => {
            fetches += 1;
            return threePages[token ?? ''];
        }, { maxItems: 3 });
        expect(all).toEqual([1, 2, 3]);
        expect(fetches).toBe(2); // stopped after the page that satisfied the cap
    });

    it('stops on a repeated next token instead of looping forever', async () => {
        let fetches = 0;
        // A misbehaving endpoint that always echoes the same token.
        const all = await collect<number>(async (token) => {
            fetches += 1;
            return { items: token === 'loop' ? [99] : [1], nextPageToken: 'loop' };
        }, { maxItems: 100 });
        // First page (token undefined) -> [1] with next 'loop'; second page
        // (token 'loop') -> [99] with next 'loop' === current -> STOP.
        expect(all).toEqual([1, 99]);
        expect(fetches).toBe(2);
    });

    it('collectCursor() honors maxItems', async () => {
        let fetches = 0;
        const byToken: Record<string, Array<{ id: string; n: number }>> = {
            '': [{ id: 'a', n: 1 }, { id: 'b', n: 2 }],
            b: [{ id: 'c', n: 3 }],
            c: [],
        };
        const out = await collectCursor<{ id: string; n: number }>({
            fetchPage: (token) => {
                fetches += 1;
                return Promise.resolve(byToken[token ?? '']);
            },
            getCursor: (last) => last.id,
        }, { maxItems: 2 });
        expect(out.map((i) => i.n)).toEqual([1, 2]);
        expect(fetches).toBe(1);
    });
});

describe('symbol-map pagination', () => {
    const pages: Record<string, SymbolMapPage<number>> = {
        '': { data: { AAPL: [1, 2], MSFT: [10] }, nextPageToken: 'p2' },
        p2: { data: { AAPL: [3], MSFT: [11, 12] }, nextPageToken: null },
    };

    it('paginateSymbolMap yields flat { symbol, value } across symbols and pages', async () => {
        const out: Array<{ symbol: string; value: number }> = [];
        for await (const rec of paginateSymbolMap<number>(async (token) => pages[token ?? ''])) {
            out.push(rec);
        }
        expect(out).toEqual([
            { symbol: 'AAPL', value: 1 },
            { symbol: 'AAPL', value: 2 },
            { symbol: 'MSFT', value: 10 },
            { symbol: 'AAPL', value: 3 },
            { symbol: 'MSFT', value: 11 },
            { symbol: 'MSFT', value: 12 },
        ]);
    });

    it('collectBySymbol concatenates each symbol across pages', async () => {
        const merged = await collectBySymbol<number>(async (token) => pages[token ?? '']);
        expect(merged).toEqual({ AAPL: [1, 2, 3], MSFT: [10, 11, 12] });
    });

    it('threads the page token and stops on a null token', async () => {
        const seen: Array<string | undefined> = [];
        await collectBySymbol<number>(async (token) => {
            seen.push(token);
            return pages[token ?? ''];
        });
        expect(seen).toEqual([undefined, 'p2']);
    });

    it('tolerates nullish data without throwing', async () => {
        const merged = await collectBySymbol<number>(async () => ({
            data: undefined as unknown as Record<string, number[]>,
            nextPageToken: null,
        }));
        expect(merged).toEqual({});
    });

    it('collectBySymbol caps each symbol at maxPerSymbol', async () => {
        const merged = await collectBySymbol<number>(async (token) => pages[token ?? ''], { maxPerSymbol: 2 });
        expect(merged).toEqual({ AAPL: [1, 2], MSFT: [10, 11] });
    });

    it('collectBySymbol stops early once every expected symbol is capped', async () => {
        let fetches = 0;
        const merged = await collectBySymbol<number>(async (token) => {
            fetches += 1;
            return pages[token ?? ''];
        }, { maxPerSymbol: 1, symbols: ['AAPL', 'MSFT'] });
        expect(merged).toEqual({ AAPL: [1], MSFT: [10] });
        expect(fetches).toBe(1); // both symbols filled on page one
    });

    it('collectBySymbol without expected symbols caps but still paginates', async () => {
        let fetches = 0;
        const merged = await collectBySymbol<number>(async (token) => {
            fetches += 1;
            return pages[token ?? ''];
        }, { maxPerSymbol: 1 });
        expect(merged).toEqual({ AAPL: [1], MSFT: [10] });
        expect(fetches).toBe(2); // cannot prove a later page has no new symbol
    });
});

describe('bounded concurrency helpers', () => {
    it('chunk splits into consecutive groups of at most size', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
        expect(chunk<number>([], 2)).toEqual([]);
        expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]]); // size floored to 1
    });

    it('mapConcurrent preserves input order in results', async () => {
        const out = await mapConcurrent([1, 2, 3, 4], 2, async (n) => n * 10);
        expect(out).toEqual([10, 20, 30, 40]);
    });

    it('mapConcurrent never exceeds the concurrency limit', async () => {
        let inFlight = 0;
        let peak = 0;
        const work = async (n: number) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 5));
            inFlight -= 1;
            return n;
        };
        await mapConcurrent([1, 2, 3, 4, 5, 6], 2, work);
        expect(peak).toBeLessThanOrEqual(2);
    });

    it('mapConcurrent rejects if any worker rejects', async () => {
        await expect(
            mapConcurrent([1, 2, 3], 2, async (n) => {
                if (n === 2) throw new Error('boom');
                return n;
            }),
        ).rejects.toThrow('boom');
    });
});

describe('symbol-object pagination', () => {
    const pages: Record<string, SymbolObjectPage<{ v: number }>> = {
        '': { data: { AAPL: { v: 1 }, MSFT: { v: 2 } }, nextPageToken: 'p2' },
        p2: { data: { AAPL: { v: 9 }, TSLA: { v: 3 } }, nextPageToken: null },
    };

    it('paginateSymbolObjects yields one { symbol, value } per entry', async () => {
        const out: Array<{ symbol: string; value: { v: number } }> = [];
        for await (const rec of paginateSymbolObjects<{ v: number }>(async (token) => pages[token ?? ''])) {
            out.push(rec);
        }
        expect(out).toEqual([
            { symbol: 'AAPL', value: { v: 1 } },
            { symbol: 'MSFT', value: { v: 2 } },
            { symbol: 'AAPL', value: { v: 9 } },
            { symbol: 'TSLA', value: { v: 3 } },
        ]);
    });

    it('collectSymbolObjects merges by symbol, later pages overwriting', async () => {
        const merged = await collectSymbolObjects<{ v: number }>(async (token) => pages[token ?? '']);
        expect(merged).toEqual({ AAPL: { v: 9 }, MSFT: { v: 2 }, TSLA: { v: 3 } });
    });
});

describe('cursor pagination', () => {
    interface Item { id: string; n: number; }

    it('threads the last id as the next token and stops on an empty page', async () => {
        const byToken: Record<string, Item[]> = {
            '': [{ id: 'a', n: 1 }, { id: 'b', n: 2 }],
            b: [{ id: 'c', n: 3 }],
            c: [],
        };
        const seen: Array<string | undefined> = [];
        const out = await collectCursor<Item>({
            fetchPage: (token) => {
                seen.push(token);
                return Promise.resolve(byToken[token ?? '']);
            },
            getCursor: (last) => last.id,
        });
        expect(out.map((i) => i.n)).toEqual([1, 2, 3]);
        expect(seen).toEqual([undefined, 'b', 'c']);
    });

    it('stops on a short page when pageSize is known (no extra fetch)', async () => {
        let fetches = 0;
        const byToken: Record<string, Item[]> = {
            '': [{ id: 'a', n: 1 }, { id: 'b', n: 2 }],
            b: [{ id: 'c', n: 3 }], // shorter than pageSize -> terminal
        };
        const out = await collectCursor<Item>({
            fetchPage: (token) => {
                fetches += 1;
                return Promise.resolve(byToken[token ?? '']);
            },
            getCursor: (last) => last.id,
            pageSize: 2,
        });
        expect(out.map((i) => i.n)).toEqual([1, 2, 3]);
        expect(fetches).toBe(2);
    });

    it('stops when the cursor repeats (same last id) instead of looping', async () => {
        let fetches = 0;
        const out = await collectCursor<Item>({
            fetchPage: () => {
                fetches += 1;
                // Always a full-looking page whose last id never advances.
                return Promise.resolve([{ id: 'stuck', n: fetches }]);
            },
            getCursor: (last) => last.id,
        });
        // First page sets cursor 'stuck'; second page's cursor 'stuck' === current -> STOP.
        expect(out.map((i) => i.n)).toEqual([1, 2]);
        expect(fetches).toBe(2);
    });

    it('stops when the cursor is nullish', async () => {
        const out = await collectCursor<Item>({
            fetchPage: () => Promise.resolve([{ id: '', n: 1 }]),
            getCursor: (last) => last.id,
        });
        expect(out).toEqual([{ id: '', n: 1 }]);
    });

    it('paginateCursor yields lazily and stops fetching on early break', async () => {
        let fetches = 0;
        const byToken: Record<string, Item[]> = {
            '': [{ id: 'a', n: 1 }, { id: 'b', n: 2 }],
            b: [{ id: 'c', n: 3 }],
            c: [],
        };
        const out: number[] = [];
        for await (const item of paginateCursor<Item>({
            fetchPage: (token) => {
                fetches += 1;
                return Promise.resolve(byToken[token ?? '']);
            },
            getCursor: (last) => last.id,
        })) {
            out.push(item.n);
            if (out.length === 2) break;
        }
        expect(out).toEqual([1, 2]);
        expect(fetches).toBe(1);
    });
});
