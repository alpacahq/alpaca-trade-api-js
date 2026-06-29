import { describe, it, expect, afterEach } from 'vitest';

import * as trading from '../src/trading';
import * as marketData from '../src/market-data';
import * as auth from '../src/auth';

/**
 * Authentication ergonomics: `keyId`/`secret` are accepted directly on
 * `Configuration`, the legacy `apiKey` string is now a loud error (it used to
 * silently send the same value for both headers -> 403), and `apiKeyAuth()` is
 * a hand-written resolver. Run against BOTH duplicated runtimes.
 */

const KEY_ID = 'AKTEST123';
const SECRET = 'super-secret';

type RuntimeModule = { Configuration: typeof trading.Configuration };

const RUNTIMES: Array<{ name: string; rt: RuntimeModule }> = [
    { name: 'trading', rt: trading },
    { name: 'market-data', rt: marketData },
];

/** Read a header regardless of object/array/Headers representation. */
function headerValue(init: RequestInit | undefined, name: string): string | undefined {
    const h = init?.headers;
    if (!h) return undefined;
    if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(name) ?? undefined;
    if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
    const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? (h as Record<string, string>)[key] : undefined;
}

/** Snapshot + clear the Alpaca credential env vars so the host environment can't leak in. */
function withCleanEnv() {
    const names = [auth.API_KEY_ID_ENV, auth.API_SECRET_KEY_ENV, auth.OAUTH_TOKEN_ENV];
    const saved: Record<string, string | undefined> = {};
    for (const n of names) {
        saved[n] = process.env[n];
        delete process.env[n];
    }
    return () => {
        for (const n of names) {
            if (saved[n] === undefined) delete process.env[n];
            else process.env[n] = saved[n];
        }
    };
}

describe('auth.resolveCredentials', () => {
    let restoreEnv: () => void;
    afterEach(() => restoreEnv?.());

    it('returns the key/secret pair when both are passed', () => {
        restoreEnv = withCleanEnv();
        expect(auth.resolveCredentials({ keyId: KEY_ID, secret: SECRET })).toEqual({ keyId: KEY_ID, secret: SECRET });
    });

    it('returns the access token when passed (no key/secret)', () => {
        restoreEnv = withCleanEnv();
        expect(auth.resolveCredentials({ accessToken: 'tok' })).toEqual({ accessToken: 'tok' });
    });

    it('prefers OAuth and ignores key/secret when both are provided', () => {
        restoreEnv = withCleanEnv();
        expect(auth.resolveCredentials({ keyId: KEY_ID, secret: SECRET, accessToken: 'tok' })).toEqual({ accessToken: 'tok' });
    });

    it('falls back to key/secret env vars', () => {
        restoreEnv = withCleanEnv();
        process.env[auth.API_KEY_ID_ENV] = 'AKENV';
        process.env[auth.API_SECRET_KEY_ENV] = 'env-secret';
        expect(auth.resolveCredentials()).toEqual({ keyId: 'AKENV', secret: 'env-secret' });
    });

    it('falls back to the OAuth token env var', () => {
        restoreEnv = withCleanEnv();
        process.env[auth.OAUTH_TOKEN_ENV] = 'env-tok';
        expect(auth.resolveCredentials()).toEqual({ accessToken: 'env-tok' });
    });

    it('lets explicit options win over env vars', () => {
        restoreEnv = withCleanEnv();
        process.env[auth.API_KEY_ID_ENV] = 'AKENV';
        process.env[auth.API_SECRET_KEY_ENV] = 'env-secret';
        expect(auth.resolveCredentials({ keyId: KEY_ID, secret: SECRET })).toEqual({ keyId: KEY_ID, secret: SECRET });
    });

    it('throws when neither scheme can be resolved', () => {
        restoreEnv = withCleanEnv();
        expect(() => auth.resolveCredentials()).toThrow(/accessToken|keyId/i);
        expect(() => auth.resolveCredentials({ keyId: KEY_ID })).toThrow(/keyId.*secret/i);
    });
});

describe('auth.apiKeyAuth helper', () => {
    it('resolves each Alpaca header to the matching credential', () => {
        const resolve = auth.apiKeyAuth({ keyId: KEY_ID, secret: SECRET });
        expect(resolve(auth.API_KEY_ID_HEADER)).toBe(KEY_ID);
        expect(resolve(auth.API_SECRET_KEY_HEADER)).toBe(SECRET);
    });

    it('throws when a credential is missing', () => {
        expect(() => auth.apiKeyAuth({ keyId: KEY_ID, secret: '' })).toThrow(/keyId.*secret|secret/i);
        expect(() => auth.apiKeyAuth({ keyId: '', secret: SECRET })).toThrow(/keyId/i);
    });

    it('throws on an unexpected header name', () => {
        const resolve = auth.apiKeyAuth({ keyId: KEY_ID, secret: SECRET });
        expect(() => resolve('Authorization')).toThrow(/Unexpected API key header/i);
    });
});

for (const { name, rt } of RUNTIMES) {
    describe(`[${name}] Configuration auth resolution`, () => {
        it('maps keyId/secret onto the two Alpaca headers', async () => {
            const resolve = new rt.Configuration({ keyId: KEY_ID, secret: SECRET }).apiKey!;
            expect(resolve).toBeTypeOf('function');
            expect(await resolve('APCA-API-KEY-ID')).toBe(KEY_ID);
            expect(await resolve('APCA-API-SECRET-KEY')).toBe(SECRET);
        });

        it('throws when only one of keyId/secret is provided', () => {
            expect(() => new rt.Configuration({ keyId: KEY_ID }).apiKey).toThrow(/both `keyId` and `secret`/);
            expect(() => new rt.Configuration({ secret: SECRET }).apiKey).toThrow(/both `keyId` and `secret`/);
        });

        it('rejects the footgun of passing apiKey as a plain string', () => {
            expect(() => new rt.Configuration({ apiKey: 'just-the-key-id' }).apiKey).toThrow(/keyId, secret/);
        });

        it('still accepts a custom apiKey resolver function (back-compat)', async () => {
            const fn = (n: string) => (n === 'APCA-API-KEY-ID' ? KEY_ID : SECRET);
            const resolve = new rt.Configuration({ apiKey: fn }).apiKey!;
            expect(await resolve('APCA-API-SECRET-KEY')).toBe(SECRET);
        });

        it('is undefined when no credentials are configured', () => {
            expect(new rt.Configuration({}).apiKey).toBeUndefined();
        });
    });
}

describe('[trading] credentials reach the wire', () => {
    it('sends both Alpaca auth headers on a real request', async () => {
        let seen: RequestInit | undefined;
        const config = new trading.Configuration({
            keyId: KEY_ID,
            secret: SECRET,
            fetchApi: async (_url, init) => {
                seen = init;
                return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });
        await new trading.AccountsApi(config).getAccount();
        expect(headerValue(seen, 'APCA-API-KEY-ID')).toBe(KEY_ID);
        expect(headerValue(seen, 'APCA-API-SECRET-KEY')).toBe(SECRET);
    });

    it('attaches an Authorization: Bearer header when an accessToken is configured', async () => {
        let seen: RequestInit | undefined;
        const config = new trading.Configuration({
            accessToken: 'tok-xyz',
            fetchApi: async (_url, init) => {
                seen = init;
                return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });
        await new trading.AccountsApi(config).getAccount();
        expect(headerValue(seen, 'Authorization')).toBe('Bearer tok-xyz');
        expect(headerValue(seen, 'APCA-API-KEY-ID')).toBeUndefined();
    });
});
