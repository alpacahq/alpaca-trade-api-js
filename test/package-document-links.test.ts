import { describe, expect, it } from "vitest";

import {
    extractMarkdownLinkTargets,
    findPackedDocumentLinkFailures,
    packedMarkdownDocuments,
} from "../scripts/package-document-links.mjs";

const packedFiles = new Set([
    "README.md",
    "MIGRATION.md",
    "codemods/README.md",
    "docs/guide_(v2).md",
    "src/client.ts",
]);

describe("packed document links", () => {
    it("selects every Markdown document in the packed file set", () => {
        expect(packedMarkdownDocuments(packedFiles)).toEqual([
            "MIGRATION.md",
            "README.md",
            "codemods/README.md",
            "docs/guide_(v2).md",
        ]);
    });

    it("accepts exact packed files and packed directory prefixes", () => {
        const markdown = [
            "[migration](./MIGRATION.md#setup)",
            "[codemods](codemods/?view=all)",
            "[source](src)",
        ].join("\n");

        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it.each([".", "./"])("accepts package-root target %s", (target) => {
        expect(
            findPackedDocumentLinkFailures(
                "README.md",
                `[package root](${target})`,
                packedFiles,
            ),
        ).toEqual([]);
    });

    it("skips external, anchor, mailto, and data links", () => {
        const markdown = [
            "[external](https://example.com/docs)",
            "[anchor](#configuration)",
            "[email](mailto:support@example.com)",
            "![badge](data:image/svg+xml;base64,abc)",
        ].join("\n");

        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("reports omitted relative targets with document and target", () => {
        expect(
            findPackedDocumentLinkFailures(
                "CONTRIBUTING.md",
                "[tooling](./tooling/GENERATION.md)",
                packedFiles,
            ),
        ).toEqual([
            "CONTRIBUTING.md: ./tooling/GENERATION.md resolves to tooling/GENERATION.md, which is not included in the tarball",
        ]);
    });

    it.each(["../private.txt", "%2e%2e/private.txt"])(
        "rejects traversal target %s",
        (target) => {
            const [failure] = findPackedDocumentLinkFailures(
                "README.md",
                `[private](${target})`,
                packedFiles,
            );

            expect(failure).toContain(`README.md: ${target}`);
            expect(failure).toContain("not included in the tarball");
        },
    );

    it("parses nested parentheses in inline destinations", () => {
        const markdown = "[versioned guide](docs/guide_(v2).md)";

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "docs/guide_(v2).md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("parses reference-style link definitions", () => {
        const markdown = [
            "Read the [migration guide][migration].",
            "",
            "[migration]: ./MIGRATION.md#before-you-start",
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md#before-you-start",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("validates only used reference definitions and keeps the first definition", () => {
        const markdown = [
            "Read the [migration guide][migration].",
            "",
            "[migration]: ./MIGRATION.md",
            "[migration]: ./missing-shadowed.md",
            "[unused]: ./missing-unused.md",
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("reports a missing target used through a reference link", () => {
        const markdown = [
            "Read the [missing guide][missing].",
            "",
            "[missing]: ./missing-reference.md",
        ].join("\n");

        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([
            "README.md: ./missing-reference.md resolves to missing-reference.md, which is not included in the tarball",
        ]);
    });

    it("ignores link-looking text inside fenced and inline code", () => {
        const markdown = [
            "`[inline](missing-inline.md)`",
            "`<a href=\"missing-inline-html.md\">inline</a>`",
            "```md",
            "[fenced](missing-fenced.md)",
            "<img src=\"missing-fenced-html.png\">",
            "```",
            "~~~html",
            "<a href=\"missing-tilde-fence.md\">fenced</a>",
            "~~~",
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("follows CommonMark for escaped links, indented code, and titles", () => {
        const markdown = [
            String.raw`\[escaped](./missing-escaped.md)`,
            "",
            "    [indented](./missing-indented.md)",
            "",
            '[titled](./missing-titled.md "why (")',
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./missing-titled.md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([
            "README.md: ./missing-titled.md resolves to missing-titled.md, which is not included in the tarball",
        ]);
    });

    it("does not accept a file target with a directory trailing slash", () => {
        expect(
            findPackedDocumentLinkFailures(
                "README.md",
                "[migration](./MIGRATION.md/)",
                packedFiles,
            ),
        ).toEqual([
            "README.md: ./MIGRATION.md/ resolves to MIGRATION.md/, which is not included in the tarball",
        ]);
    });

    it("finds relative href and src values in raw HTML", () => {
        const markdown = [
            '<a href="./MIGRATION.md#setup">migration</a>',
            "<img src='docs/guide_(v2).md' alt='guide'>",
            '<a href="https://example.com/docs">external</a>',
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md#setup",
            "docs/guide_(v2).md",
            "https://example.com/docs",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("finds poster and every srcset candidate in raw HTML", () => {
        const markdown = [
            '<video poster="./MIGRATION.md"></video>',
            '<source srcset="./MIGRATION.md 1x, docs/guide_(v2).md 2x">',
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md",
            "./MIGRATION.md",
            "docs/guide_(v2).md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("reports missing poster and srcset resources", () => {
        const markdown =
            '<video poster="./missing-poster.png"></video>\n' +
            '<source srcset="./missing-small.png 1x, ./missing-large.png 2x">';

        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([
            "README.md: ./missing-poster.png resolves to missing-poster.png, which is not included in the tarball",
            "README.md: ./missing-small.png resolves to missing-small.png, which is not included in the tarball",
            "README.md: ./missing-large.png resolves to missing-large.png, which is not included in the tarball",
        ]);
    });

    it("reports omitted relative raw-HTML targets", () => {
        expect(
            findPackedDocumentLinkFailures(
                "README.md",
                '<img src="./missing-image.png">',
                packedFiles,
            ),
        ).toEqual([
            "README.md: ./missing-image.png resolves to missing-image.png, which is not included in the tarball",
        ]);
    });

    it("ignores raw-HTML links inside HTML comments", () => {
        const markdown = [
            "<!-- <a href=\"./missing-commented-page.md\">old page</a>",
            "<img src='./missing-commented-image.png'> -->",
            '<a href="./MIGRATION.md">live link</a>',
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("parses rendered HTML attributes instead of tag-shaped script text", () => {
        const markdown = [
            '<script>const example = `<a href="./missing-script.md">`;</script>',
            '<a href="./MIGRATION&#46;md">migration</a>',
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./MIGRATION.md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([]);
    });

    it("continues after an unclosed inline link", () => {
        const markdown = [
            "[broken](docs/guide_(v2).md",
            "[missing](./missing-after-broken.md)",
        ].join("\n");

        expect(extractMarkdownLinkTargets(markdown)).toEqual([
            "./missing-after-broken.md",
        ]);
        expect(
            findPackedDocumentLinkFailures("README.md", markdown, packedFiles),
        ).toEqual([
            "README.md: ./missing-after-broken.md resolves to missing-after-broken.md, which is not included in the tarball",
        ]);
    });
});
