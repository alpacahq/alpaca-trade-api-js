/**
 * Generation-safe authentication helpers for Alpaca's API key + secret scheme.
 *
 * Alpaca authenticates with two distinct headers:
 *   - `APCA-API-KEY-ID`     (your key id)
 *   - `APCA-API-SECRET-KEY` (your secret)
 *
 * The generated `Configuration` reads keys through a callback keyed by header
 * name, which makes the naive `apiKey: "..."` send the *same* value for both
 * headers and fail with an opaque 403. These helpers remove that footgun: pass
 * `{ keyId, secret }` and get back a correctly name-keyed resolver that works
 * with both the `trading` and `marketData` `Configuration` classes.
 *
 * This module is hand-written and lives outside the generated `apis/`/`models/`
 * trees, which are kept untouched as a faithful snapshot of the OpenAPI spec.
 *
 * @example
 * ```ts
 * import { trading, auth } from "@alpacahq/alpaca-ts-alpha";
 *
 * // Preferred: keyId/secret are accepted directly by Configuration.
 * const config = new trading.Configuration({ keyId, secret });
 *
 * // Equivalent, if you need to compose the resolver yourself:
 * const config2 = new trading.Configuration({ apiKey: auth.apiKeyAuth({ keyId, secret }) });
 * ```
 */

/** Header carrying the Alpaca API key id. */
export const API_KEY_ID_HEADER = "APCA-API-KEY-ID";

/** Header carrying the Alpaca API secret. */
export const API_SECRET_KEY_HEADER = "APCA-API-SECRET-KEY";

/** Env var read for the API key id when `keyId` is not passed explicitly. */
export const API_KEY_ID_ENV = "APCA_API_KEY_ID";

/** Env var read for the API secret when `secret` is not passed explicitly. */
export const API_SECRET_KEY_ENV = "APCA_API_SECRET_KEY";

/** Env var read for the OAuth access token when `accessToken` is not passed explicitly. */
export const OAUTH_TOKEN_ENV = "APCA_API_OAUTH_TOKEN";

/** Alpaca API key + secret pair. */
export interface AlpacaCredentials {
    /** API key id, sent as the `APCA-API-KEY-ID` header. */
    keyId: string;
    /** API secret, sent as the `APCA-API-SECRET-KEY` header. */
    secret: string;
}

/**
 * Credentials a caller may supply: either an OAuth `accessToken` or an API
 * `keyId`/`secret` pair. Any field may be omitted and resolved from the
 * environment by {@link resolveCredentials}.
 */
export interface CredentialOptions {
    /** API key id (or set `APCA_API_KEY_ID`). */
    keyId?: string;
    /** API secret (or set `APCA_API_SECRET_KEY`). */
    secret?: string;
    /**
     * OAuth2 access token sent as `Authorization: Bearer <token>` (or set
     * `APCA_API_OAUTH_TOKEN`). Mutually exclusive with `keyId`/`secret`; when
     * present it takes precedence and the key/secret pair is ignored.
     */
    accessToken?: string;
}

/**
 * Fully-resolved credentials: exactly one auth scheme. Either an OAuth
 * `accessToken`, or a `keyId`/`secret` pair — never both.
 */
export type ResolvedCredentials =
    | { accessToken: string; keyId?: undefined; secret?: undefined }
    | { keyId: string; secret: string; accessToken?: undefined };

/**
 * Read an environment variable in a runtime-agnostic way. Returns `undefined`
 * when `process.env` is unavailable (browser) or the value is empty, so the
 * zero-dependency SDK never assumes Node globals.
 */
function readEnv(name: string): string | undefined {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const value = env?.[name];
    return value != null && value !== "" ? value : undefined;
}

/**
 * Resolve credentials from explicit options, falling back to the standard
 * Alpaca environment variables (`APCA_API_KEY_ID`, `APCA_API_SECRET_KEY`,
 * `APCA_API_OAUTH_TOKEN`). Explicitly-passed values always win over the
 * environment.
 *
 * OAuth takes precedence and is mutually exclusive with the key/secret pair
 * (mirroring the official SDKs): when an `accessToken` is resolved, `keyId` /
 * `secret` are ignored. Throws a descriptive error when neither a complete
 * key/secret pair nor an access token can be resolved.
 */
export function resolveCredentials(options: CredentialOptions = {}): ResolvedCredentials {
    const accessToken = options.accessToken || readEnv(OAUTH_TOKEN_ENV);
    if (accessToken) {
        return { accessToken };
    }
    const keyId = options.keyId || readEnv(API_KEY_ID_ENV);
    const secret = options.secret || readEnv(API_SECRET_KEY_ENV);
    if (keyId && secret) {
        return { keyId, secret };
    }
    throw new Error(
        "Alpaca authentication requires either an OAuth `accessToken` " +
        `(or the ${OAUTH_TOKEN_ENV} env var), or both \`keyId\` and \`secret\` ` +
        `(or the ${API_KEY_ID_ENV} / ${API_SECRET_KEY_ENV} env vars).`,
    );
}

/** A resolver compatible with `ConfigurationParameters.apiKey`. */
export type ApiKeyResolver = (name: string) => string;

/**
 * Builds a name-keyed resolver that returns the correct value for each Alpaca
 * auth header. Throws early (rather than failing with a 403 at request time) if
 * either credential is missing or an unexpected header is requested.
 */
export function apiKeyAuth(credentials: AlpacaCredentials): ApiKeyResolver {
    const keyId = credentials?.keyId;
    const secret = credentials?.secret;
    if (!keyId || !secret) {
        throw new Error(
            "Alpaca authentication requires both `keyId` and `secret`. " +
            "Pass them as `apiKeyAuth({ keyId, secret })` or `new Configuration({ keyId, secret })`.",
        );
    }
    return (name: string): string => {
        switch (name) {
            case API_KEY_ID_HEADER:
                return keyId;
            case API_SECRET_KEY_HEADER:
                return secret;
            default:
                throw new Error(`Unexpected API key header requested: "${name}".`);
        }
    };
}
