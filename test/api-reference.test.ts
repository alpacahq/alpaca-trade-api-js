import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { applyReference, referenceKeys } from '../scripts/api-reference/render';
import { examples } from '../scripts/api-reference/examples';

const here = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(here, '..', 'README.md');

describe('README API reference', () => {
    it('documents exactly every capability method (no missing, no stray)', () => {
        const expected = referenceKeys().sort();
        const actual = Object.keys(examples).sort();

        const missing = expected.filter((k) => !examples[k]);
        const stray = actual.filter((k) => !expected.includes(k));

        expect(missing, `examples.ts is missing entries for: ${missing.join(', ')}`).toEqual([]);
        expect(stray, `examples.ts has stray entries not in capabilities: ${stray.join(', ')}`).toEqual([]);
        expect(actual).toEqual(expected);
    });

    it('every documentation key is unique', () => {
        const keys = referenceKeys();
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('is in sync with src/capabilities.ts (run `npm run docs:api` if this fails)', () => {
        const readme = readFileSync(readmePath, 'utf8');
        expect(applyReference(readme)).toBe(readme);
    });
});
