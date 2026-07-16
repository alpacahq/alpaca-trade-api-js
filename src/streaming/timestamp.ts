/**
 * High-resolution timestamps for the market-data WebSocket stream.
 *
 * `@msgpack/msgpack`'s built-in decoder turns the msgpack timestamp extension
 * (ext type `-1`) into a millisecond `Date`, silently dropping the sub-ms
 * nanoseconds Alpaca sends. We register a **decode-only** custom codec that
 * instead yields a {@link StreamTimestamp} carrying the full `{sec, nsec}`, so
 * the mappers can surface both a convenient `Date` and a lossless RFC-3339
 * `timestampRaw` string. Encoding is left on the default codec (outbound frames
 * carry no timestamps), because overriding the extension's `encode` would break
 * `Date` serialization (a `Date` would encode to an empty map).
 *
 * This module is hand-written and lives outside the generated `apis/`/`models/`
 * trees, which are kept untouched as a faithful snapshot of the OpenAPI spec.
 */
import { ExtensionCodec, EXT_TIMESTAMP, decodeTimestampToTimeSpec } from "@msgpack/msgpack";
import type { StreamExtensionCodec } from "./websocket";

/**
 * A stream timestamp preserving nanosecond precision: `epochSeconds` plus
 * `nanos` (`0 <= nanos < 1_000_000_000`). Produced by the market-data decode
 * codec from the msgpack timestamp extension.
 */
export class StreamTimestamp {
    constructor(
        readonly epochSeconds: number,
        readonly nanos: number,
    ) {}

    /**
     * Millisecond-precision `Date` for ergonomics. Lossy — use
     * {@link toRFC3339} when you need the full sub-millisecond precision.
     */
    toDate(): Date {
        return new Date(this.epochSeconds * 1000 + Math.floor(this.nanos / 1e6));
    }

    /**
     * Lossless RFC-3339 string with 9 fractional digits, e.g.
     * `2024-01-02T03:04:05.678099211Z`.
     */
    toRFC3339(): string {
        const secondsPart = new Date(this.epochSeconds * 1000).toISOString().slice(0, 19);
        return `${secondsPart}.${String(this.nanos).padStart(9, "0")}Z`;
    }
}

/**
 * A decode-only extension codec that maps the msgpack timestamp extension
 * onto a {@link StreamTimestamp}. Pass it to `decode(...)` only; never to
 * `encode(...)` (the `encode` hook intentionally returns `null` so the default
 * `Date` encoding keeps working for callers that share this codec instance).
 */
export function createMarketDataExtensionCodec(): StreamExtensionCodec {
    const codec = new ExtensionCodec();
    codec.register({
        type: EXT_TIMESTAMP,
        encode: () => null,
        decode: (data: Uint8Array): StreamTimestamp => {
            const { sec, nsec } = decodeTimestampToTimeSpec(data);
            return new StreamTimestamp(sec, nsec);
        },
    });
    return codec as unknown as StreamExtensionCodec;
}
