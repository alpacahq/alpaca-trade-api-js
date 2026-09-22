import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    createProgram,
    flattenDiagnosticMessageText,
    ModuleKind,
    ModuleResolutionKind,
    ScriptTarget,
} from 'typescript';
import { describe, it, expect } from 'vitest';

import { examples } from '../scripts/api-reference/examples';
import {
    apiReferenceSections,
    referenceKeys,
    renderApiReferenceSitePages,
} from '../scripts/api-reference/render';

function compileExample(
    directory: string,
    sdkEntry: string,
    key: string,
    index: number,
    example: string,
): string[] {
    const safeKey = key.replaceAll(/[^a-zA-Z0-9_$]/g, '_');
    const filename = join(directory, `${index}_${safeKey}.ts`);
    const source = [
        `import { Alpaca, TimeFrame } from ${JSON.stringify(sdkEntry)};`,
        'const alpaca = new Alpaca({ keyId: "key", secret: "secret" });',
        '',
        'async function example() {',
        ...example.split('\n').map((line) => `    ${line}`),
        '}',
        '',
    ].join('\n');

    writeFileSync(filename, source);
    const program = createProgram([filename], {
        target: ScriptTarget.ES2022,
        module: ModuleKind.CommonJS,
        moduleResolution: ModuleResolutionKind.Node10,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ['node'],
    });
    const sourceFile = program.getSourceFile(filename);
    if (!sourceFile) {
        return [`${key}: temporary module was not added to its TypeScript program`];
    }

    return [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
    ]
        .map(
            (diagnostic) =>
                `${key}: ${flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
        );
}

describe('API reference generation', () => {
    it('documents exactly every capability method (no missing, no stray)', () => {
        const expected = referenceKeys().sort();
        const actual = Object.keys(examples).sort();

        const missing = expected.filter((k) => !examples[k]);
        const stray = actual.filter((k) => !expected.includes(k));

        expect(missing, `examples.ts is missing entries for: ${missing.join(', ')}`).toEqual([]);
        expect(stray, `examples.ts has stray entries not in capabilities: ${stray.join(', ')}`).toEqual([]);
        expect(actual).toEqual(expected);
    });

    it('uses exported timeframe values instead of plain string literals', () => {
        const invalid = Object.entries(examples)
            .filter(([, entry]) => /\btimeframe\s*:\s*["'`]/.test(entry.example))
            .map(([key]) => key);

        expect(
            invalid,
            `examples with plain timeframe string literals: ${invalid.join(', ')}`,
        ).toEqual([]);
    });

    it('subscribes to order/trade updates before connecting', () => {
        const { description, example } = examples['trading.stream'];
        const subscribe = example.indexOf('updates.subscribeTradeUpdates();');
        const connect = example.indexOf('updates.connect();');

        expect(description).toContain('order/trade');
        expect(description).not.toContain('order/account');
        expect(subscribe).toBeGreaterThan(-1);
        expect(connect).toBeGreaterThan(subscribe);
        expect(example).not.toMatch(/onConnect\([^)]*subscribeTradeUpdates/s);
    });

    it('compiles each capability example in an isolated TypeScript program', () => {
        const source = readFileSync(import.meta.filename, 'utf8');

        expect(source).toMatch(/^function compileExample\(/m);
        expect(source).toMatch(
            /^function compileExample\([\s\S]*?createProgram\(\[filename\]/m,
        );
    });

    it(
        'type-checks every example against the SDK surface',
        () => {
            const directory = mkdtempSync(join(tmpdir(), 'alpaca-api-reference-'));
            const sdkEntry = resolve(import.meta.dirname, '..', 'src', 'index');

            try {
                const diagnostics = Object.entries(examples).flatMap(
                    ([key, entry], index) =>
                        compileExample(directory, sdkEntry, key, index, entry.example),
                );

                expect(diagnostics, diagnostics.join('\n')).toEqual([]);
            } finally {
                rmSync(directory, { recursive: true, force: true });
            }
        },
        120_000,
    );

    it('describes submitAndWait as returning a terminal order', () => {
        const example = examples['trading.submitAndWait'].example;

        expect(example).toContain('const terminalOrder = await alpaca.trading.submitAndWait');
        expect(example).toContain('if (terminalOrder.status === "filled")');
        expect(example).not.toContain('const filled =');
    });

    it('every documentation key is unique', () => {
        const keys = referenceKeys();
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('renders a deterministic landing page and all four site reference sections', () => {
        const pages = renderApiReferenceSitePages();
        expect(renderApiReferenceSitePages()).toEqual(pages);
        expect(
            pages.map(({ filename, contents }) => ({
                filename,
                customEditUrl: /^---\n(?:.*\n)*?custom_edit_url: null\n(?:.*\n)*?---/m.test(
                    contents,
                ),
            })),
        ).toEqual(
            pages.map(({ filename }) => ({
                filename,
                customEditUrl: true,
            })),
        );
        expect(
            pages.map(({ id, filename, route, title }) => ({
                id,
                filename,
                route,
                title,
            })),
        ).toEqual([
            {
                id: 'api/index',
                filename: 'index.md',
                route: '/api',
                title: 'API Reference',
            },
            {
                id: 'api/trading',
                filename: 'trading.md',
                route: '/api/trading',
                title: 'Trading API',
            },
            {
                id: 'api/market-data',
                filename: 'market-data.md',
                route: '/api/market-data',
                title: 'Market Data API',
            },
            {
                id: 'api/streaming',
                filename: 'streaming.md',
                route: '/api/streaming',
                title: 'Real-time streaming',
            },
            {
                id: 'api/ergonomic-helpers',
                filename: 'ergonomic-helpers.md',
                route: '/api/ergonomic-helpers',
                title: 'Ergonomic helpers',
            },
        ]);

        const landing = pages[0].contents;
        expect(landing).toContain('slug: /api');
        expect(landing).toContain('curated, example-driven facade reference');
        expect(landing).toContain('complete API surface');
        expect(landing).toContain('TypeScript declarations');
        for (const filename of [
            'trading',
            'market-data',
            'streaming',
            'ergonomic-helpers',
        ]) {
            expect(landing).toContain(`](./${filename}.md)`);
        }

        const sections = apiReferenceSections();
        expect(pages.slice(1).map(({ title }) => title)).toEqual(
            sections.map(({ title }) => title),
        );
        for (const section of sections) {
            const page = pages.find((candidate) => candidate.title === section.title);
            expect(page?.contents).toContain(`# ${section.title}`);
        }

        expect(pages[1].contents).toContain(
            '#### `alpaca.trading.account` — AccountsApi',
        );
        expect(pages[1].contents).toContain(
            '##### `alpaca.trading.account.getAccount` {#alpacatradingaccountgetaccount}',
        );
        expect(pages[1].contents).toContain(
            'await alpaca.trading.account.getAccount();',
        );
        expect(pages[2].contents).toContain(
            '##### `alpaca.marketData.stocks.stockBars` {#alpacamarketdatastocksstockbars}',
        );
        expect(pages[2].contents).toContain(
            'Historical bars for one or more stocks (paginated).',
        );
        expect(pages[3].contents).toContain(
            '#### `alpaca.trading.stream` — TradingStream',
        );
        expect(pages[3].contents).toContain(
            'const updates = alpaca.trading.stream();',
        );
        expect(pages[4].contents).toContain(
            '#### `alpaca.trading.orders` — order builders',
        );
        expect(pages[4].contents).toContain(
            '##### `alpaca.trading.orders.market` {#alpacatradingordersmarket}',
        );
        expect(pages[4].contents).toContain(
            'await alpaca.trading.orders.market({ symbol: "AAPL", side: "buy", qty: 1, clientOrderId });',
        );
    });
});
