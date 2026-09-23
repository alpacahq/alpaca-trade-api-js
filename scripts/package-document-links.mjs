import { posix } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import parseSrcset from "parse-srcset";
import { parseFragment } from "parse5";

function rawHtmlLinkTargets(html) {
    const targets = [];
    const visit = (node) => {
        for (const attribute of node.attrs ?? []) {
            if (
                (attribute.name === "href" ||
                    attribute.name === "src" ||
                    attribute.name === "poster") &&
                attribute.value
            ) {
                targets.push(attribute.value);
            } else if (attribute.name === "srcset" && attribute.value) {
                for (const candidate of parseSrcset(attribute.value)) {
                    targets.push(candidate.url);
                }
            }
        }
        for (const child of node.childNodes ?? []) {
            visit(child);
        }
    };
    visit(parseFragment(html));
    return targets;
}

export function extractMarkdownLinkTargets(markdown) {
    const tree = fromMarkdown(markdown);
    const definitions = new Map();
    const collectDefinitions = (node) => {
        if (
            node.type === "definition" &&
            node.identifier &&
            node.url &&
            !definitions.has(node.identifier)
        ) {
            definitions.set(node.identifier, node.url);
        }
        for (const child of node.children ?? []) {
            collectDefinitions(child);
        }
    };
    collectDefinitions(tree);

    const targets = [];
    const visit = (node) => {
        if ((node.type === "link" || node.type === "image") && node.url) {
            targets.push(node.url);
        } else if (
            (node.type === "linkReference" ||
                node.type === "imageReference") &&
            node.identifier
        ) {
            const destination = definitions.get(node.identifier);
            if (destination) {
                targets.push(destination);
            }
        } else if (node.type === "html" && node.value) {
            targets.push(...rawHtmlLinkTargets(node.value));
        }
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    visit(tree);
    return targets;
}

export function packedMarkdownDocuments(packedFiles) {
    return [...packedFiles].filter((file) => /\.md$/i.test(file)).sort();
}

function isIgnoredTarget(target) {
    return (
        target.startsWith("#") ||
        target.startsWith("?") ||
        target.startsWith("/") ||
        /^[a-z][a-z\d+.-]*:/i.test(target)
    );
}

export function findPackedDocumentLinkFailures(
    document,
    markdown,
    packedFiles,
) {
    const failures = [];
    for (const target of extractMarkdownLinkTargets(markdown)) {
        if (isIgnoredTarget(target)) {
            continue;
        }

        const pathOnly = target.split(/[?#]/, 1)[0];
        if (!pathOnly) {
            continue;
        }

        let decoded;
        try {
            decoded = decodeURIComponent(pathOnly);
        } catch {
            decoded = pathOnly;
        }
        const resolved =
            posix
                .normalize(
                    posix.join(
                        posix.dirname(document),
                        decoded.replaceAll("\\", "/"),
                    ),
                )
                .replace(/^\.\//, "") || ".";
        const directoryTarget = resolved.endsWith("/");
        const lookupPath = resolved.replace(/\/+$/, "");
        const outsidePackage =
            lookupPath === ".." || lookupPath.startsWith("../");
        const packageRoot = lookupPath === ".";
        let packed = false;
        if (!outsidePackage) {
            if (packageRoot) {
                packed = packedFiles.size > 0;
            } else if (directoryTarget) {
                packed = [...packedFiles].some((file) =>
                    file.startsWith(`${lookupPath}/`),
                );
            } else {
                packed =
                    packedFiles.has(lookupPath) ||
                    [...packedFiles].some((file) =>
                        file.startsWith(`${lookupPath}/`),
                    );
            }
        }
        if (!packed) {
            failures.push(
                `${document}: ${target} resolves to ${resolved || "."}, which is not included in the tarball`,
            );
        }
    }
    return failures;
}
