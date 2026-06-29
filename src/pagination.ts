/**
 * Generic pagination helpers for Alpaca's `next_page_token` style endpoints.
 *
 * The generated APIs expose the page token on responses but do not auto-follow
 * it. These helpers let callers iterate every item across pages without
 * hand-rolling the loop. They are transport-agnostic: you adapt each SDK call
 * into a `Page<T>` and the helper drives the cursor until it is exhausted.
 *
 * @example
 * ```ts
 * import { marketData, pagination } from "@alpacahq/alpaca-ts-alpha";
 *
 * const stocks = new marketData.StockApi(config);
 * for await (const trade of pagination.paginate(async (pageToken) => {
 *   const resp = await stocks.stockTrades({ symbols: "AAPL", pageToken });
 *   return { items: resp.trades?.["AAPL"] ?? [], nextPageToken: resp.nextPageToken };
 * })) {
 *   console.log(trade);
 * }
 * ```
 */

export interface Page<T> {
    /** Items contained in this page. */
    items: T[];
    /** Token for the next page; `null`/`undefined`/`""` means no more pages. */
    nextPageToken?: string | null;
}

/** A function that fetches a single page given an optional page token. */
export type PageFetcher<T> = (pageToken?: string) => Promise<Page<T>>;

/**
 * Resolve the token for the next page, or `undefined` to stop. Stops when the
 * API omits a token (`null`/`undefined`/blank) and ALSO when it echoes the same
 * token we just used: a misbehaving endpoint that repeats its cursor would
 * otherwise loop forever, so we apply the "repeated-token STOP" safeguard and
 * return what was collected so far.
 */
function nextToken(raw: string | null | undefined, current: string | undefined): string | undefined {
    if (!raw || raw === current) {
        return undefined;
    }
    return raw;
}

/**
 * Lazily yields every item across all pages, following `nextPageToken` until
 * the API stops returning one.
 */
export async function* paginate<T>(fetchPage: PageFetcher<T>): AsyncGenerator<T, void, void> {
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        for (const item of page.items ?? []) {
            yield item;
        }
        const next = nextToken(page.nextPageToken, pageToken);
        if (next === undefined) {
            return;
        }
        pageToken = next;
    }
}

/** Options bounding an eager `collect`. */
export interface CollectOptions {
    /**
     * Stop once this many items have been collected, truncating the final page
     * and not fetching further pages. Guards against unbounded result sets
     * (e.g. years of minute bars). Omit for "all pages".
     */
    maxItems?: number;
}

/**
 * Eagerly collects items across pages into a single array. Pass
 * {@link CollectOptions.maxItems} to bound the result; otherwise beware
 * unbounded result sets.
 */
export async function collect<T>(fetchPage: PageFetcher<T>, options: CollectOptions = {}): Promise<T[]> {
    const out: T[] = [];
    const max = options.maxItems;
    for await (const item of paginate(fetchPage)) {
        out.push(item);
        if (max !== undefined && out.length >= max) {
            break;
        }
    }
    return out;
}

// --- Multi-symbol map pagination ------------------------------------------
//
// Several market-data endpoints return data keyed by symbol, e.g.
// `StockBarsResp.bars: { [symbol]: StockBar[] }`, alongside a `next_page_token`.
// Naively following the token leaves the integrator to merge per-symbol arrays
// across pages. These helpers do that merge for you.

/** A page whose payload is a `{ [symbol]: T[] }` map plus an optional token. */
export interface SymbolMapPage<T> {
    /** Per-symbol arrays for this page. */
    data: { [symbol: string]: T[] };
    /** Token for the next page; `null`/`undefined`/`""` means no more pages. */
    nextPageToken?: string | null;
}

/** Fetches a single `{ [symbol]: T[] }` page given an optional page token. */
export type SymbolMapPageFetcher<T> = (pageToken?: string) => Promise<SymbolMapPage<T>>;

/**
 * Lazily yields every `{ symbol, value }` record across all symbols and pages
 * of a symbol-keyed response, following the page token until exhausted.
 */
export async function* paginateSymbolMap<T>(
    fetchPage: SymbolMapPageFetcher<T>,
): AsyncGenerator<{ symbol: string; value: T }, void, void> {
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        const data = page.data ?? {};
        for (const symbol of Object.keys(data)) {
            for (const value of data[symbol] ?? []) {
                yield { symbol, value };
            }
        }
        const next = nextToken(page.nextPageToken, pageToken);
        if (next === undefined) {
            return;
        }
        pageToken = next;
    }
}

/** Options bounding an eager {@link collectBySymbol}. */
export interface SymbolMapCollectOptions {
    /**
     * Keep at most this many records per symbol, stopping early (no further page
     * fetches) once every expected symbol is full. Guards against unbounded
     * per-symbol history. Omit for "all pages".
     */
    maxPerSymbol?: number;
    /**
     * The symbols that were requested. Used only to know when an early stop is
     * safe under `maxPerSymbol` (so a symbol that only appears on a later page
     * is not truncated). When omitted, per-symbol arrays are still capped but
     * pagination runs to completion.
     */
    symbols?: string[];
}

/**
 * Eagerly collects a symbol-keyed response into a single merged
 * `{ [symbol]: T[] }` map, concatenating each symbol's arrays across pages.
 * Pass {@link SymbolMapCollectOptions.maxPerSymbol} to bound it; otherwise
 * beware unbounded result sets.
 */
export async function collectBySymbol<T>(
    fetchPage: SymbolMapPageFetcher<T>,
    options: SymbolMapCollectOptions = {},
): Promise<{ [symbol: string]: T[] }> {
    const out: { [symbol: string]: T[] } = {};
    const cap = options.maxPerSymbol;
    const expected = options.symbols;
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        const data = page.data ?? {};
        for (const symbol of Object.keys(data)) {
            const arr = (out[symbol] ??= []);
            for (const value of data[symbol] ?? []) {
                if (cap !== undefined && arr.length >= cap) {
                    break;
                }
                arr.push(value);
            }
        }
        if (cap !== undefined && allSymbolsCapped(out, cap, expected)) {
            break;
        }
        const next = nextToken(page.nextPageToken, pageToken);
        if (next === undefined) {
            break;
        }
        pageToken = next;
    }
    return out;
}

/**
 * True once every expected symbol has reached the cap. When the expected set is
 * unknown we cannot prove a not-yet-seen symbol is full, so we never stop early.
 */
function allSymbolsCapped<T>(
    out: { [symbol: string]: T[] },
    cap: number,
    expected: string[] | undefined,
): boolean {
    if (!expected) {
        return false;
    }
    return expected.every((symbol) => (out[symbol]?.length ?? 0) >= cap);
}

// --- Symbol-keyed single-object pagination --------------------------------
//
// A couple of endpoints (`optionSnapshots`, `optionChain`) return a symbol map
// whose values are single objects, not arrays: `{ [symbol]: OptionSnapshot }`.
// Pages are merged by symbol (later pages fill in / overwrite earlier ones).

/** A page whose payload is a `{ [symbol]: T }` map plus an optional token. */
export interface SymbolObjectPage<T> {
    /** Per-symbol object for this page. */
    data: { [symbol: string]: T };
    /** Token for the next page; `null`/`undefined`/`""` means no more pages. */
    nextPageToken?: string | null;
}

/** Fetches a single `{ [symbol]: T }` page given an optional page token. */
export type SymbolObjectPageFetcher<T> = (pageToken?: string) => Promise<SymbolObjectPage<T>>;

/** Lazily yields every `{ symbol, value }` entry across all pages. */
export async function* paginateSymbolObjects<T>(
    fetchPage: SymbolObjectPageFetcher<T>,
): AsyncGenerator<{ symbol: string; value: T }, void, void> {
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        const data = page.data ?? {};
        for (const symbol of Object.keys(data)) {
            yield { symbol, value: data[symbol] };
        }
        const next = nextToken(page.nextPageToken, pageToken);
        if (next === undefined) {
            return;
        }
        pageToken = next;
    }
}

/**
 * Eagerly collects a symbol-keyed single-object response into one merged
 * `{ [symbol]: T }` map; later pages overwrite earlier values for a symbol.
 */
export async function collectSymbolObjects<T>(
    fetchPage: SymbolObjectPageFetcher<T>,
): Promise<{ [symbol: string]: T }> {
    const out: { [symbol: string]: T } = {};
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        const data = page.data ?? {};
        for (const symbol of Object.keys(data)) {
            out[symbol] = data[symbol];
        }
        const next = nextToken(page.nextPageToken, pageToken);
        if (next === undefined) {
            return out;
        }
        pageToken = next;
    }
}

// --- Cursor pagination -----------------------------------------------------
//
// Account activities return a bare `T[]` with no envelope or token. The next
// page is requested by passing `page_token` = the `id` of the last item on the
// current page. Iteration stops on an empty page, on a short page (when
// `pageSize` is known), or when the last item has no usable cursor.

/** Options controlling cursor-based pagination. */
export interface CursorOptions<T> {
    /** Fetches a single page given an optional cursor token. */
    fetchPage: (pageToken?: string) => Promise<T[]>;
    /** Extracts the cursor (next `page_token`) from the last item of a page. */
    getCursor: (lastItem: T) => string | null | undefined;
    /** Page size, if requested; used to detect the final (short) page. */
    pageSize?: number;
}

/** Lazily yields every item across all cursor pages. */
export async function* paginateCursor<T>(
    options: CursorOptions<T>,
): AsyncGenerator<T, void, void> {
    const { fetchPage, getCursor, pageSize } = options;
    let pageToken: string | undefined ;
    for (;;) {
        const page = await fetchPage(pageToken);
        if (!page || page.length === 0) {
            return;
        }
        for (const item of page) {
            yield item;
        }
        if (pageSize != null && page.length < pageSize) {
            return;
        }
        const cursor = getCursor(page[page.length - 1]);
        // Stop on a missing cursor or a repeated one (the same last-item id):
        // re-requesting it would return the same page forever.
        if (!cursor || cursor === pageToken) {
            return;
        }
        pageToken = cursor;
    }
}

/** Eagerly collects items across cursor pages into a single array. */
export async function collectCursor<T>(options: CursorOptions<T>, collectOptions: CollectOptions = {}): Promise<T[]> {
    const out: T[] = [];
    const max = collectOptions.maxItems;
    for await (const item of paginateCursor(options)) {
        out.push(item);
        if (max !== undefined && out.length >= max) {
            break;
        }
    }
    return out;
}

// --- Bounded concurrency ---------------------------------------------------
//
// Multi-symbol endpoints multiplex every symbol into one request with a single
// page-token chain, which is followed sequentially. To speed up large baskets
// over long ranges, callers can split the symbol list and fetch the chunks in
// parallel with a capped number of in-flight requests. These are the building
// blocks the `MarketDataClient` uses for that.

/** Split `items` into consecutive groups of at most `size` (>= 1). */
export function chunk<T>(items: T[], size: number): T[][] {
    const n = Math.max(1, Math.floor(size));
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += n) {
        out.push(items.slice(i, i + n));
    }
    return out;
}

/**
 * Map `items` through an async `worker`, keeping at most `concurrency` calls in
 * flight at once. Results are returned in input order; the first rejection
 * rejects the whole call.
 */
export async function mapConcurrent<TIn, TOut>(
    items: TIn[],
    concurrency: number,
    worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
    const results: TOut[] = new Array(items.length);
    const limit = Math.max(1, Math.floor(concurrency));
    let next = 0;
    const run = async (): Promise<void> => {
        for (;;) {
            const index = next++;
            if (index >= items.length) {
                return;
            }
            results[index] = await worker(items[index], index);
        }
    };
    const runners: Promise<void>[] = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) {
        runners.push(run());
    }
    await Promise.all(runners);
    return results;
}
