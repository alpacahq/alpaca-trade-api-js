/**
 * Writer for the docs-site API reference.
 *
 * Writes the pure renderer's `/api` landing page and four reference sections to
 * the gitignored `docs/docs/api/` build-artifact directory. Removing the
 * directory first also clears files left by older generator layouts.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderApiReferenceSitePages } from "./api-reference/render.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "docs", "docs", "api");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const pages = renderApiReferenceSitePages();
for (const page of pages) {
    writeFileSync(resolve(outDir, page.filename), page.contents);
}

console.log(`Wrote ${pages.length} API reference pages to ${outDir}`);
