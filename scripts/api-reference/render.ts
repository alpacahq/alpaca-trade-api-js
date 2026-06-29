/**
 * Pure renderer for the README API reference block.
 *
 * Joins the capability maps in `src/capabilities.ts` with the hand-maintained
 * examples in `./examples.ts` and emits the markdown that lives between the
 * `<!-- API-REFERENCE:START -->` / `<!-- API-REFERENCE:END -->` markers. The
 * writer (`scripts/gen-api-reference.ts`) and the drift guard
 * (`test/api-reference.test.ts`) both call into here, so the generated output
 * and the test can never disagree.
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

/** Opening marker that fences the generated block in the README. */
export const START_MARKER = "<!-- API-REFERENCE:START -->";
/** Closing marker that fences the generated block in the README. */
export const END_MARKER = "<!-- API-REFERENCE:END -->";

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
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/ /g, "-");
}

/** In-page anchor for a REST `accessor.method` heading. */
function anchorFor(key: string): string {
    return `#${slugify(`alpaca.${key}`)}`;
}

// --- Markdown blocks -----------------------------------------------------

function lookup(key: string): { description: string; example: string } {
    const entry = examples[key];
    if (!entry) {
        throw new Error(
            `Missing API-reference example for "${key}". Add it to scripts/api-reference/examples.ts, then run \`npm run docs:api\`.`,
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

/**
 * Render the full API reference markdown block (without the surrounding
 * markers). Throws if any documented method lacks an examples entry.
 */
export function renderApiReference(): string {
    const trading = capabilities.filter((c) => c.group === "trading");
    const marketData = capabilities.filter((c) => c.group === "marketData");
    const lines = [
        ...restGroup("Trading API", trading),
        ...restGroup("Market Data API", marketData),
        ...streamingGroup(),
        ...ergonomicGroup(),
    ];
    return lines.join("\n").trimEnd();
}

/**
 * Splice {@link renderApiReference} between the markers in a README string,
 * returning the updated document. Idempotent: applying it to an in-sync README
 * yields the same string (this is what the drift guard asserts). Throws if
 * either marker is absent or out of order.
 */
export function applyReference(readme: string): string {
    const startIdx = readme.indexOf(START_MARKER);
    const endIdx = readme.indexOf(END_MARKER);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        throw new Error(
            `README is missing the ${START_MARKER} / ${END_MARKER} markers (in order).`,
        );
    }
    const before = readme.slice(0, startIdx + START_MARKER.length);
    const after = readme.slice(endIdx);
    return `${before}\n\n${renderApiReference()}\n\n${after}`;
}
