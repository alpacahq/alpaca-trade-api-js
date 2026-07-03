import { describe, expect, it } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';

import { StreamTimestamp, createMarketDataExtensionCodec } from '../src/streaming/timestamp';

describe('StreamTimestamp', () => {
    it('formats a full 9-digit RFC-3339 nanosecond string', () => {
        const ts = new StreamTimestamp(1704164645, 678099211);
        expect(ts.toRFC3339()).toBe('2024-01-02T03:04:05.678099211Z');
    });

    it('zero-pads sub-millisecond nanos', () => {
        const ts = new StreamTimestamp(1704164645, 900);
        expect(ts.toRFC3339()).toBe('2024-01-02T03:04:05.000000900Z');
    });

    it('produces a millisecond-truncated Date for ergonomics', () => {
        const ts = new StreamTimestamp(1704164645, 678099211);
        expect(ts.toDate().toISOString()).toBe('2024-01-02T03:04:05.678Z');
    });
});

describe('createMarketDataExtensionCodec', () => {
    it('decodes the msgpack timestamp extension into a StreamTimestamp', () => {
        const codec = createMarketDataExtensionCodec();
        // Encode with the DEFAULT codec (as Alpaca's server sends ext -1).
        const buf = encode({ t: new Date('2024-01-02T03:04:05.678Z') });
        const out = decode(buf, { extensionCodec: codec }) as { t: StreamTimestamp };
        expect(out.t).toBeInstanceOf(StreamTimestamp);
        expect(out.t.toRFC3339()).toBe('2024-01-02T03:04:05.678000000Z');
    });

    it('does not disturb decoding of plain payloads', () => {
        const codec = createMarketDataExtensionCodec();
        const buf = encode({ action: 'subscribe', trades: ['AAPL'] });
        expect(decode(buf, { extensionCodec: codec })).toEqual({ action: 'subscribe', trades: ['AAPL'] });
    });
});
