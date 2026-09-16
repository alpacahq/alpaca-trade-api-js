import { readFileSync } from 'node:fs';
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
    });
});
