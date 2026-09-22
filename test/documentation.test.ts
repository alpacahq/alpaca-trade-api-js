import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

describe('canonical documentation', () => {
    it('fails the docs build for unresolved Markdown links', () => {
        const config = readFileSync(
            resolve(projectRoot, 'docs/docusaurus.config.ts'),
            'utf8',
        );

        expect(config).toMatch(/onBrokenMarkdownLinks:\s*["']throw["']/);
    });

    it('uses the shared Alpaca documentation branding', () => {
        const config = readFileSync(
            resolve(projectRoot, 'docs/docusaurus.config.ts'),
            'utf8',
        );
        const css = readFileSync(
            resolve(projectRoot, 'docs/src/css/custom.css'),
            'utf8',
        );

        expect(config).toContain('Alpaca Node.js Client');
        expect(config).toContain('favicon: "img/alpaca-symbol-yellow.png"');
        expect(config).toContain('src: "img/alpaca-symbol-yellow.png"');
        expect(config).toContain('alt: "Alpaca"');
        expect(config).toContain('footer:');
        expect(config).toContain('https://alpaca.markets/docs/');
        expect(config).toContain('https://alpaca.markets/slack');
        expect(config).toContain('https://forum.alpaca.markets/');
        expect(css).toContain('--ifm-color-primary: #196f6b');
        expect(css).toContain('--ifm-font-family-base: Inter');
        expect(css).not.toContain('#1a73e8');
        expect(css).toContain('[data-theme="dark"]');
        expect(css).toContain('--ifm-color-primary: #39bdb5');
        expect(css).toContain('--ifm-color-primary-darkest: #21928d');
        expect(
            existsSync(
                resolve(
                    projectRoot,
                    'docs/static/img/alpaca-symbol-yellow.png',
                ),
            ),
        ).toBe(true);
    });

    it('preserves advanced public configuration guidance in the canonical guides', () => {
        const authentication = readFileSync(
            resolve(projectRoot, 'docs/docs/authentication.md'),
            'utf8',
        );
        const resilience = readFileSync(
            resolve(projectRoot, 'docs/docs/resilience.md'),
            'utf8',
        );

        expect(authentication).toContain('auth.apiKeyAuth');
        expect(authentication).toContain('trading.TRADING_PAPER_HOST');
        expect(authentication).toContain('trading.TRADING_LIVE_HOST');
        expect(authentication).toContain('marketData.MARKET_DATA_HOST');
        expect(resilience).toContain('maxDelayMs');
        expect(resilience).toContain('retryableStatuses');
        expect(resilience).toContain('respectRetryAfter');
        expect(resilience).toContain('maxConcurrent');
        expect(resilience).toContain(
            'first argument for parameterless methods',
        );
        expect(resilience).not.toContain(
            'which is the second argument',
        );
    });

    it('documents terminal-order and curated-reference semantics', () => {
        const trading = readFileSync(
            resolve(projectRoot, 'docs/docs/trading.md'),
            'utf8',
        );
        const marketData = readFileSync(
            resolve(projectRoot, 'docs/docs/market-data.md'),
            'utf8',
        );
        const typesAndValues = readFileSync(
            resolve(projectRoot, 'docs/docs/types-and-values.md'),
            'utf8',
        );

        expect(trading).toContain('const terminalOrder');
        expect(trading).toMatch(/terminalOrder\.status\s*===\s*["']filled["']/);
        expect(trading).toMatch(
            /canceled.*rejected.*expired.*done_for_day|done_for_day.*expired.*rejected.*canceled/s,
        );
        expect(trading).toContain(
            '`done_for_day` only pauses execution until the next trading day',
        );
        expect(trading).toContain('terminal wait outcome');
        expect(trading).toContain('curated');
        expect(trading).toContain('TypeScript declarations');
        expect(marketData).toContain('curated');
        expect(marketData).toContain('TypeScript declarations');
        expect(typesAndValues).toContain('curated');
        expect(typesAndValues).toContain('TypeScript declarations');
    });

    it('documents pure builders and manual market-data normalization', () => {
        const trading = readFileSync(
            resolve(projectRoot, 'docs/docs/trading.md'),
            'utf8',
        );
        const marketData = readFileSync(
            resolve(projectRoot, 'docs/docs/market-data.md'),
            'utf8',
        );

        expect(trading).toContain('orders.buildLimitOrder');
        expect(trading).toContain('postOrder({ postOrderRequest })');
        expect(trading).toMatch(/without.*network.*tests.*inspection.*composition/is);
        expect(marketData).toContain('marketDataShapes.toBarsBySymbol');
        expect(marketData).toContain('marketDataShapes.toTradesBySymbol');
        expect(marketData).toContain('marketDataShapes.toQuotesBySymbol');
        expect(marketData).toContain('const alpaca = new Alpaca');
        expect(marketData).toMatch(/generated endpoints.*canonical/is);
    });

    it('documents advanced generic pagination behavior', () => {
        const pagination = readFileSync(
            resolve(projectRoot, 'docs/docs/pagination.md'),
            'utf8',
        );

        expect(pagination).not.toContain(
            'same shape across every paginated endpoint',
        );
        expect(pagination).toMatch(/symbol-keyed arrays/i);
        expect(pagination).toMatch(/symbol-keyed objects/i);
        expect(pagination).toMatch(/top-level arrays/i);
        expect(pagination).toMatch(/corporate-action envelope/i);
        expect(pagination).toContain('pagination.paginateCursor');
        expect(pagination).toContain('pagination.collectCursor');
        expect(pagination).toContain('pagination.collectBySymbol');
        expect(pagination).toContain('pagination.chunk');
        expect(pagination).toContain('pagination.mapConcurrent');
        expect(pagination).toContain('const cursorOptions:');
        expect(pagination).toContain('const fetchBarsPage:');
        expect(pagination).toContain('data: response.bars ?? {}');
        expect(pagination).toContain('const bigList =');
        expect(pagination).toContain('const start = new Date');
        expect(pagination).toMatch(/paginateCursor.*backpressure|backpressure.*paginateCursor/is);
        expect(pagination).toMatch(/collectCursor.*maxItems/is);
        expect(pagination).toMatch(/collectBySymbol.*maxPerSymbol/is);
        expect(pagination).toMatch(/mapConcurrent.*input\s+order.*in\s+flight/is);
    });

    it('documents actionable API and transport error handling', () => {
        const resilience = readFileSync(
            resolve(projectRoot, 'docs/docs/resilience.md'),
            'utf8',
        );

        expect(resilience).toContain('error instanceof ApiError');
        expect(resilience).toContain('error instanceof FetchError');
        expect(resilience).toContain('orders.buildMarketOrder');
        expect(resilience).toContain('const postOrderRequest =');
        for (const field of ['status', 'code', 'message', 'requestId', 'rateLimit']) {
            expect(resilience).toContain(`error.${field}`);
        }
        expect(resilience).toMatch(/transport.*ambiguous.*reconcile.*before.*resubmitt/is);
        expect(resilience).toMatch(/Error.*DOMException.*cause.*primitive.*AbortError/is);
    });

    it('documents retry defaults, abort signals, and abort reasons', () => {
        const resilience = readFileSync(
            resolve(projectRoot, 'docs/docs/resilience.md'),
            'utf8',
        );

        expect(resilience).toMatch(
            /Retry-After.*replaces.*computed.*backoff.*capped.*maxDelayMs/is,
        );
        expect(resilience).toMatch(
            /facade.*default.*bare.*generated.*retries.*off/is,
        );
        expect(resilience).toContain('{ signal: controller.signal }');
        expect(resilience).toMatch(
            /default abort.*AbortError.*Error.*DOMException.*cause.*primitive.*AbortError/is,
        );
    });

    it('documents the supported trading stream and safe initial subscription', () => {
        const streaming = readFileSync(
            resolve(projectRoot, 'docs/docs/streaming.md'),
            'utf8',
        );
        const subscribe = streaming.indexOf('updates.subscribeTradeUpdates();');
        const connect = streaming.indexOf('updates.connect();');

        expect(streaming).toContain('order/trade updates');
        expect(streaming).not.toContain('order/account updates');
        expect(subscribe).toBeGreaterThan(-1);
        expect(connect).toBeGreaterThan(subscribe);
        expect(streaming).toMatch(/curated.*Streaming API Reference/is);
    });

    it('keeps SDK skill guidance precise about trading streams and retry defaults', () => {
        const skill = readFileSync(
            resolve(projectRoot, 'skills/alpaca-trade-api-sdk/SKILL.md'),
            'utf8',
        );
        const tradingStream = skill.slice(
            skill.indexOf('const updates = alpaca.trading.stream();'),
            skill.indexOf('Every stream also exposes'),
        );

        expect(skill).toContain('order/trade updates');
        expect(skill).not.toContain('order/account updates');
        expect(tradingStream.indexOf('updates.subscribeTradeUpdates();')).toBeGreaterThan(-1);
        expect(tradingStream.indexOf('updates.connect();')).toBeGreaterThan(
            tradingStream.indexOf('updates.subscribeTradeUpdates();'),
        );
        expect(tradingStream).not.toMatch(/onConnect\([^)]*subscribeTradeUpdates/s);
        expect(skill).toMatch(
            /Alpaca`?\s+facade.*2 retries.*3 attempts.*eligible idempotent requests/is,
        );
        expect(skill).toMatch(
            /bare generated Configuration.*retries.*off.*unless configured/is,
        );
    });

    it('keeps the runnable trading bot subscription safe and accurately described', () => {
        const example = readFileSync(
            resolve(projectRoot, 'examples/trading-bot.ts'),
            'utf8',
        );
        const readme = readFileSync(
            resolve(projectRoot, 'examples/README.md'),
            'utf8',
        );
        const subscribe = example.indexOf('updates.subscribeTradeUpdates();');
        const connect = example.indexOf('updates.connect();');

        expect(example).toContain('order/trade updates');
        expect(example).not.toContain('order/account updates');
        expect(readme).toContain('order/trade updates');
        expect(readme).not.toContain('order/account updates');
        expect(subscribe).toBeGreaterThan(-1);
        expect(connect).toBeGreaterThan(subscribe);
        expect(example).not.toContain('await updates.connect();');
        expect(example).not.toMatch(/onConnect\([^)]*subscribeTradeUpdates/s);
    });

    it('documents low-level base paths and lossless unsafe integers', () => {
        const authentication = readFileSync(
            resolve(projectRoot, 'docs/docs/authentication.md'),
            'utf8',
        );
        const marketData = readFileSync(
            resolve(projectRoot, 'docs/docs/market-data.md'),
            'utf8',
        );

        expect(authentication).toMatch(
            /basePath.*low-level.*Configuration.*not.*Alpaca.*option/is,
        );
        expect(marketData).toMatch(
            /lossless.*parser.*any integer.*beyond.*2\^53.*string/is,
        );
        expect(marketData).toMatch(/IDs.*idRaw.*normalization/is);
    });

    it('requires paper credentials before the first call', () => {
        const gettingStarted = readFileSync(
            resolve(projectRoot, 'docs/docs/getting-started.md'),
            'utf8',
        );
        const firstCall = gettingStarted.indexOf('## Your first call');
        const credentials = gettingStarted.search(/paper\s+credentials/);

        expect(credentials).toBeGreaterThan(-1);
        expect(credentials).toBeLessThan(firstCall);
        expect(gettingStarted).toContain(
            'https://docs.alpaca.markets/docs/paper-trading',
        );
        expect(gettingStarted).toContain('export APCA_API_KEY_ID=');
        expect(gettingStarted).toContain('export APCA_API_SECRET_KEY=');
    });

    it('lists canonical guides in sidebar order in the README', () => {
        const readme = readFileSync(resolve(projectRoot, 'README.md'), 'utf8');
        const documentation = readme.slice(
            readme.indexOf('## Documentation'),
            readme.indexOf('## Build from source'),
        );
        const linkTitles = [...documentation.matchAll(/^- \[([^\]]+)\]\(/gm)].map(
            ([, title]) => title,
        );

        expect(linkTitles).toEqual([
            'Getting started',
            'Trading',
            'Market data',
            'Streaming',
            'Authentication',
            'Resilience & configuration',
            'Pagination',
            'Values & types',
            'Testing your integration',
            'Runtime & module compatibility',
            'Examples',
            'Migration from 3.x',
            'API reference',
        ]);
        expect(readme).toMatch(
            /maps(?:\s*>\s*)?common 3\.x calls and workflows/,
        );
        expect(readme).not.toContain('maps every endpoint old → new');
    });
});
