/**
 * Shared harness for the per-endpoint surface tests
 * (`endpoints.trading.test.ts`, `endpoints.marketdata.test.ts`).
 *
 * Each {@link EndpointCase} pins one generated REST method to its HTTP verb +
 * path and invokes it through the facade against a single-route mock server.
 * Because `createMockAlpaca` 404s any unmatched request (which the SDK turns
 * into a thrown `ApiError`), a one-route mock validates verb + path + the
 * method's own deserialization in one shot: if the SDK hits a different path or
 * verb, the call rejects and the case fails.
 *
 * The `call` closure invokes the real, typed facade method so the method name
 * appears literally in the test source (surface coverage) and is type-checked.
 */
import { expect, it } from 'vitest';

import { capabilities, type CapabilityGroup } from '../src/capabilities';
import type { Alpaca } from '../src/client';
import { createMockAlpaca } from '../src/testing';

/** Shape of a single mocked response: a JSON object, a JSON array, or no body (void/204). */
export type ResponseKind = 'object' | 'array' | 'void';

/** One endpoint under test. */
export interface EndpointCase {
    /** Facade accessor the method lives on, e.g. `"trading.orders"`. Must match a `capabilities` entry. */
    accessor: string;
    /** The generated method name, e.g. `"getAccount"`. Must appear in that accessor's `methods`. */
    method: string;
    /** HTTP verb the generated method uses. */
    verb: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Pattern matched against `URL.pathname` (param segments allowed). */
    path: RegExp;
    /** What the mock returns, so deserialization succeeds. */
    kind: ResponseKind;
    /**
     * Explicit mock body. Defaults from {@link kind} (`{}` / `[]` / none).
     * Override when a response model has a required container field that its
     * `FromJSON` dereferences unconditionally (e.g. `{ bars: {} }`).
     */
    body?: unknown;
    /** Invokes the real typed facade method. */
    call: (alpaca: Alpaca) => Promise<unknown>;
}

function bodyFor(testCase: EndpointCase): unknown {
    if (testCase.body !== undefined) return testCase.body;
    if (testCase.kind === 'array') return [];
    if (testCase.kind === 'void') return undefined;
    return {};
}

/**
 * Register `it` cases for every endpoint plus a coverage guard asserting the
 * cases exactly cover the generated methods enumerated in {@link capabilities}
 * for `group` (no missing endpoint, no stray/misspelled one).
 */
export function runEndpointCases(group: CapabilityGroup, cases: EndpointCase[]): void {
    it.each(cases)('$accessor.$method -> $verb hits its endpoint and deserializes', async (testCase) => {
        const alpaca = createMockAlpaca([
            { method: testCase.verb, path: testCase.path, body: bodyFor(testCase) },
        ]);
        const result = await testCase.call(alpaca);
        if (testCase.kind === 'array') {
            expect(Array.isArray(result)).toBe(true);
        }
        // `object`/`void` simply must not reject (a wrong verb/path 404s -> throws).
    });

    it('covers every generated method in the capability map for this group', () => {
        const expected = capabilities
            .filter((entry) => entry.group === group)
            .flatMap((entry) => entry.methods)
            .sort();
        const tested = cases.map((c) => c.method).sort();

        // No method is tested twice.
        expect(new Set(tested).size).toBe(tested.length);
        // The tested set is exactly the capability surface for this group.
        expect(tested).toEqual(expected);
    });
}
