/**
 * Pure renderers for the docs-site API reference.
 *
 * Joins the capability maps in `src/capabilities.ts` with the hand-maintained
 * examples in `./examples.ts`, then renders the `/api` landing page and one
 * markdown page per reference section. The writer
 * (`scripts/gen-docs-api-reference.ts`) only manages the generated output
 * directory.
 *
 * Examples are authored as compact one-liners in `examples.ts`; this module
 * pretty-prints any that exceed {@link MAX_WIDTH} into a multi-line form so the
 * rendered code blocks never need horizontal scrolling.
 */

import {
    capabilities,
    ergonomicCapabilities,
    streamingCapabilities,
    type CapabilityEntry,
    type ErgonomicHelperEntry,
} from "../../src/capabilities.ts";
import { examples } from "./examples.ts";

/** Wrap examples whose single-line form is wider than this many columns. */
const MAX_WIDTH = 76;

/** Human-readable label for each ergonomic helper kind, used in subheadings. */
const KIND_LABELS: Record<ErgonomicHelperEntry["kind"], string> = {
    orderBuilder: "order builders",
    workflow: "workflow helpers",
    normalized: "normalized accessors",
    pagination: "pagination helpers",
};

/**
 * Every documentation key, in render order: `accessor.method` for each REST and
 * ergonomic method, and the bare `accessor` for each streaming factory. The
 * drift guard compares this to the keys of the examples map.
 */
export function referenceKeys(): string[] {
    const keys: string[] = [];
    for (const entry of capabilities) {
        for (const method of entry.methods) keys.push(`${entry.accessor}.${method}`);
    }
    for (const entry of streamingCapabilities) keys.push(entry.accessor);
    for (const entry of ergonomicCapabilities) {
        for (const method of entry.methods) keys.push(`${entry.accessor}.${method}`);
    }
    return keys;
}

// --- Example pretty-printing ---------------------------------------------

/** Find the index of the `}` matching the `{` at `start`, ignoring strings. */
function matchingBrace(code: string, start: number): number {
    let depth = 0;
    let quote = "";
    for (let i = start; i < code.length; i++) {
        const ch = code[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = "";
            continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") quote = ch;
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) return i;
    }
    return -1;
}

/** Split object-literal contents on top-level commas, ignoring nesting/strings. */
function splitTopLevel(inner: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote = "";
    let start = 0;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = "";
            continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") quote = ch;
        else if (ch === "{" || ch === "[" || ch === "(") depth++;
        else if (ch === "}" || ch === "]" || ch === ")") depth--;
        else if (ch === "," && depth === 0) {
            parts.push(inner.slice(start, i).trim());
            start = i + 1;
        }
    }
    const last = inner.slice(start).trim();
    if (last) parts.push(last);
    return parts;
}

/** Expand an object literal `{...}` onto multiple lines, recursing as needed. */
function expandObject(objText: string, baseIndent: number): string {
    const inner = objText.slice(1, -1).trim();
    const childPad = " ".repeat(baseIndent + 2);
    const lines = splitTopLevel(inner).map((prop) => {
        const oneLine = `${childPad}${prop},`;
        if (oneLine.length <= MAX_WIDTH) return oneLine;
        const objValue = prop.match(/^([\w$]+):\s*(\{[\s\S]*\})$/);
        if (objValue) {
            return `${childPad}${objValue[1]}: ${expandObject(objValue[2], baseIndent + 2)},`;
        }
        return oneLine;
    });
    return `{\n${lines.join("\n")}\n${" ".repeat(baseIndent)}}`;
}

/**
 * Pretty-print a one-line example into a readable multi-line form when it is
 * wider than {@link MAX_WIDTH}. Examples that are already multi-line, short, or
 * carry no object argument are returned unchanged.
 */
function formatExample(code: string): string {
    if (code.includes("\n") || code.length <= MAX_WIDTH) return code;
    const callStart = code.indexOf("({");
    if (callStart === -1) return code;
    const braceStart = callStart + 1;
    const braceEnd = matchingBrace(code, braceStart);
    if (braceEnd === -1) return code;
    const head = code.slice(0, braceStart);
    const objText = code.slice(braceStart, braceEnd + 1);
    const tail = code.slice(braceEnd + 1);
    return `${head}${expandObject(objText, 0)}${tail}`;
}

// --- Anchors -------------------------------------------------------------

/** GitHub-compatible heading slug (strips backticks/dots, lowercases, etc.). */
export function headingSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/ /g, "-");
}

/** In-page anchor for a REST `accessor.method` heading. */
function anchorFor(key: string): string {
    return `#${headingSlug(`alpaca.${key}`)}`;
}

// --- Markdown blocks -----------------------------------------------------

function lookup(key: string): { description: string; example: string } {
    const entry = examples[key];
    if (!entry) {
        throw new Error(
            `Missing docs-site API-reference example for "${key}". Add it to scripts/api-reference/examples.ts, then run \`npm run docs:api\`.`,
        );
    }
    return entry;
}

function methodBlock(key: string): string[] {
    const { description, example } = lookup(key);
    return [`##### \`alpaca.${key}\``, "", description, "", "```ts", formatExample(example), "```", ""];
}

/** Collapsible "jump to an operation" index for a REST group. */
function operationsIndex(entries: readonly CapabilityEntry[]): string[] {
    const total = entries.reduce((n, e) => n + e.methods.length, 0);
    const lines = ["<details>", `<summary><strong>Operations</strong> (${total})</summary>`, ""];
    for (const entry of entries) {
        const name = entry.accessor.split(".")[1];
        const links = entry.methods
            .map((m) => `[${m}](${anchorFor(`${entry.accessor}.${m}`)})`)
            .join(", ");
        lines.push(`- \`${name}\` — ${links}`);
    }
    lines.push("", "</details>", "");
    return lines;
}

function restGroup(title: string, entries: readonly CapabilityEntry[]): string[] {
    const lines: string[] = [`### ${title}`, "", ...operationsIndex(entries)];
    for (const entry of entries) {
        lines.push(`#### \`alpaca.${entry.accessor}\` — ${entry.api}`, "", entry.summary, "");
        for (const method of entry.methods) {
            lines.push(...methodBlock(`${entry.accessor}.${method}`));
        }
    }
    return lines;
}

function streamingGroup(): string[] {
    const lines: string[] = ["### Real-time streaming", ""];
    for (const entry of streamingCapabilities) {
        const { description, example } = lookup(entry.accessor);
        lines.push(
            `#### \`alpaca.${entry.accessor}\` — ${entry.stream}`,
            "",
            description,
            "",
            "```ts",
            formatExample(example),
            "```",
            "",
        );
    }
    return lines;
}

function ergonomicGroup(): string[] {
    const lines: string[] = ["### Ergonomic helpers", ""];
    for (const entry of ergonomicCapabilities) {
        lines.push(
            `#### \`alpaca.${entry.accessor}\` — ${KIND_LABELS[entry.kind]}`,
            "",
            entry.summary,
            "",
        );
        for (const method of entry.methods) {
            lines.push(...methodBlock(`${entry.accessor}.${method}`));
        }
    }
    return lines;
}

/** One top-level group of the API reference (heading + rendered markdown). */
export interface ApiReferenceSection {
    /** Group title, e.g. `"Trading API"`. */
    title: string;
    /**
     * Rendered markdown lines for the group. The first line is the
     * `### {title}` heading; the site page renderer strips it in favor of the
     * page title.
     */
    lines: string[];
}

/** The API reference split into its four top-level groups, in render order. */
export function apiReferenceSections(): ApiReferenceSection[] {
    const trading = capabilities.filter((c) => c.group === "trading");
    const marketData = capabilities.filter((c) => c.group === "marketData");
    return [
        { title: "Trading API", lines: restGroup("Trading API", trading) },
        { title: "Market Data API", lines: restGroup("Market Data API", marketData) },
        { title: "Real-time streaming", lines: streamingGroup() },
        { title: "Ergonomic helpers", lines: ergonomicGroup() },
    ];
}

/** Metadata and rendered markdown for one generated docs-site page. */
export interface ApiReferenceSitePage {
    /** Docusaurus document ID, matching `docs/sidebars.ts`. */
    id: string;
    /** Filename relative to `docs/docs/api/`. */
    filename: string;
    /** Public route under the docs site's route base. */
    route: string;
    /** Human-readable page title. */
    title: string;
    /** Complete markdown file contents, including front matter. */
    contents: string;
}

const SITE_SECTIONS = [
    { title: "Trading API", slug: "trading", position: 2 },
    { title: "Market Data API", slug: "market-data", position: 3 },
    { title: "Real-time streaming", slug: "streaming", position: 4 },
    { title: "Ergonomic helpers", slug: "ergonomic-helpers", position: 5 },
] as const;

/** Add stable anchors to facade method headings referenced by operation links. */
function withExplicitAnchors(lines: string[]): string[] {
    return lines.map((line) => {
        const match = line.match(/^##### `alpaca\.(.+)`$/);
        if (!match) return line;
        return `${line} {#${headingSlug(`alpaca.${match[1]}`)}}`;
    });
}

/** Drop the section heading because each generated file supplies a page title. */
function stripSectionHeading(section: ApiReferenceSection): string[] {
    const body = [...section.lines];
    if (body[0] === `### ${section.title}`) {
        body.shift();
        if (body[0] === "") body.shift();
    }
    return body;
}

function renderLandingPage(): ApiReferenceSitePage {
    const contents = [
        "---",
        "title: API Reference",
        "sidebar_position: 1",
        "slug: /api",
        "custom_edit_url: null",
        "---",
        "",
        "# API Reference",
        "",
        "The API Reference is a curated, example-driven facade reference for `@alpacahq/alpaca-trade-api`.",
        "",
        "The published TypeScript declarations and your editor are authoritative for the complete API surface, exact method signatures, and request and response models.",
        "",
        "Examples using `TimeFrame` import it from `@alpacahq/alpaca-trade-api` alongside `Alpaca`.",
        "",
        "- [Trading API](./trading.md)",
        "- [Market Data API](./market-data.md)",
        "- [Real-time streaming](./streaming.md)",
        "- [Ergonomic helpers](./ergonomic-helpers.md)",
        "",
    ].join("\n");

    return {
        id: "api/index",
        filename: "index.md",
        route: "/api",
        title: "API Reference",
        contents,
    };
}

/** Render the `/api` landing page followed by all four reference pages. */
export function renderApiReferenceSitePages(): ApiReferenceSitePage[] {
    const sections = new Map(
        apiReferenceSections().map((section) => [section.title, section]),
    );
    const pages: ApiReferenceSitePage[] = [renderLandingPage()];

    for (const metadata of SITE_SECTIONS) {
        const section = sections.get(metadata.title);
        if (!section) {
            throw new Error(`Missing API-reference section "${metadata.title}".`);
        }
        const route = `/api/${metadata.slug}`;
        const body = withExplicitAnchors(stripSectionHeading(section));
        const contents = [
            "---",
            `title: ${metadata.title}`,
            `sidebar_position: ${metadata.position}`,
            `slug: ${route}`,
            "custom_edit_url: null",
            "---",
            "",
            `# ${metadata.title}`,
            "",
            ...body,
            "",
        ].join("\n");
        pages.push({
            id: `api/${metadata.slug}`,
            filename: `${metadata.slug}.md`,
            route,
            title: metadata.title,
            contents,
        });
    }

    return pages;
}
