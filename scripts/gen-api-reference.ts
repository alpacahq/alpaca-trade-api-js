/**
 * Writer CLI for the README API reference.
 *
 * Reads `README.md`, replaces the content between the
 * `<!-- API-REFERENCE:START -->` / `<!-- API-REFERENCE:END -->` markers with
 * the freshly rendered block, and writes it back. Run via `npm run docs:api`.
 * The drift guard in `test/api-reference.test.ts` then fails CI if the file
 * checked in is ever out of sync.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyReference } from "./api-reference/render.ts";

const here = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(here, "..", "README.md");

const original = readFileSync(readmePath, "utf8");
const updated = applyReference(original);

if (updated === original) {
    console.log("API reference already up to date.");
} else {
    writeFileSync(readmePath, updated);
    console.log(`Updated API reference in ${readmePath}`);
}
