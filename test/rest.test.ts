import { describe, expect, it } from 'vitest';

// IMPORTANT: this file must NOT import '../src/streaming' (directly or via
// '../src/index'); the whole point is that the REST entrypoint never loads the
// streaming module, so stream factories should throw here.
import { Alpaca } from '../src/rest';
import type * as trading from '../src/trading';

const CREDS = { keyId: 'AKTEST', secret: 'sekret' };

function jsonFetch(body: unknown): trading.FetchAPI {
    return (async () =>
        new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })) as unknown as trading.FetchAPI;
}

describe('@alpacahq/alpaca-ts-alpha/rest entrypoint', () => {
    it('performs REST calls normally', async () => {
        const alpaca = new Alpaca({
            ...CREDS,
            fetchApi: jsonFetch({ id: 'acct-1', account_number: 'PA123', status: 'ACTIVE' }),
        });
        const account = await alpaca.trading.account.getAccount();
        expect(account.accountNumber).toBe('PA123');
    });

    it('throws a helpful error when a stream factory is used (streaming not loaded)', () => {
        const alpaca = new Alpaca({ ...CREDS });
        expect(() => alpaca.trading.stream()).toThrow(/@alpacahq\/alpaca-ts-alpha\/rest/);
        expect(() => alpaca.marketData.stockStream()).toThrow(/streaming is unavailable|@alpacahq\/alpaca-ts-alpha\/rest/i);
    });
});
