/**
 * Writer for the docs-site API reference.
 *
 * Renders the REST surface of the curated, example-driven reference that powers
 * the README (see `scripts/api-reference/render.ts`) into the Docusaurus tree as
 * one page per API group, under `docs/docs/api/`. Only the REST groups (Trading
 * API, Market Data API) are generated here; the streaming and ergonomic-helper
 * surfaces are documented in the hand-written guides (Streaming, Getting
 * started, Market data, Pagination), so the generated reference stays focused
 * and the guides own the prose.
 *
 * The output directory is gitignored and treated as a build artifact: the docs
 * `prebuild` script runs this before every `docusaurus build`/`start`, and the
 * root `npm run docs:api-site` regenerates it on demand.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiReferenceSections, headingSlug } from "./api-reference/render.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "docs", "docs", "api");

/**
 * Per-group slug + sidebar order, keyed by the section title from the renderer.
 * Only the REST groups are generated; the renderer's streaming and ergonomic
 * sections are intentionally omitted here (they live in the curated guides).
 */
const PAGES: Record<string, { slug: string; position: number }> = {
    "Trading API": { slug: "trading", position: 1 },
    "Market Data API": { slug: "market-data", position: 2 },
};

/**
 * Give every `##### `alpaca.x.y`` method heading an explicit Docusaurus anchor
 * matching the in-page links emitted by the renderer, so the "Operations" index
 * resolves regardless of Docusaurus' own slugging rules.
 */
function withExplicitAnchors(lines: string[]): string[] {
    return lines.map((line) => {
        const match = line.match(/^##### `alpaca\.(.+)`$/);
        if (!match) return line;
        return `${line} {#${headingSlug(`alpaca.${match[1]}`)}}`;
    });
}

/** Drop the renderer's leading `### {title}` heading (the page title replaces it). */
function stripGroupHeading(title: string, lines: string[]): string[] {
    const body = [...lines];
    if (body[0] === `### ${title}`) {
        body.shift();
        if (body[0] === "") body.shift();
    }
    return body;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

writeFileSync(
    resolve(outDir, "_category_.json"),
    `${JSON.stringify(
        {
            label: "API reference",
            position: 8,
            collapsed: false,
            link: {
                type: "generated-index",
                title: "API reference",
                description:
                    "Every REST endpoint, grouped by API surface, with a one-line description and a runnable example — generated from the SDK's capability maps. Streaming and ergonomic helpers are covered in the guides.",
            },
        },
        null,
        2,
    )}\n`,
);

const sections = apiReferenceSections();
let written = 0;
for (const section of sections) {
    const page = PAGES[section.title];
    if (!page) continue;
    const body = withExplicitAnchors(stripGroupHeading(section.title, section.lines));
    const contents = [
        "---",
        `title: ${section.title}`,
        `sidebar_position: ${page.position}`,
        "---",
        "",
        `# ${section.title}`,
        "",
        ...body,
        "",
    ].join("\n");
    writeFileSync(resolve(outDir, `${page.slug}.md`), contents);
    written++;
}

console.log(`Wrote ${written} API reference pages to ${outDir}`);
