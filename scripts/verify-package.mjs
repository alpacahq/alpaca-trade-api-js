import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
    externalModuleSpecifiers,
    forbiddenExternalSpecifiers,
    parseNpmPackJson,
} from "./bundle-specifiers.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesRoot = join(projectRoot, "test", "package-fixtures");
const tempRoot = mkdtempSync(join(tmpdir(), "alpaca-sdk-package-"));
const failures = [];

function fail(label, detail) {
    failures.push(`${label}\n${detail}`.trim());
}

function run(label, command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
    });
    if (result.status !== 0) {
        fail(
            label,
            [result.stdout, result.stderr].filter(Boolean).join("\n"),
        );
    }
    return result;
}

function linkPackage(source, destination) {
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(source, destination, "dir");
}

try {
    if (!existsSync(join(projectRoot, "dist", "index.mjs"))) {
        throw new Error("dist is missing; run `npm run build` before package verification");
    }

    const packed = run(
        "npm pack",
        "npm",
        ["pack", "--ignore-scripts", "--json", "--pack-destination", tempRoot],
        projectRoot,
    );
    if (packed.status !== 0) {
        throw new Error("npm pack failed");
    }

    const [packInfo] = parseNpmPackJson(packed.stdout);
    const packedFiles = new Set(packInfo.files.map(({ path }) => path));
    for (const required of [
        "MIGRATION.md",
        "codemods/alpaca-v3-to-v4.js",
    ]) {
        if (!packedFiles.has(required)) {
            fail("packed files", `missing ${required}`);
        }
    }
    const shippedCodemodTests = packInfo.files
        .map(({ path }) => path)
        .filter(
            (path) =>
                path.startsWith("codemods/test-fixtures/") ||
                /^codemods\/.*\.test\.[cm]?[jt]s$/.test(path),
        );
    if (shippedCodemodTests.length > 0) {
        fail(
            "packed files",
            `codemod test artifacts shipped: ${shippedCodemodTests.join(", ")}`,
        );
    }

    const unpackRoot = join(tempRoot, "unpacked");
    mkdirSync(unpackRoot);
    run(
        "extract packed tarball",
        "tar",
        ["-xzf", join(tempRoot, packInfo.filename), "-C", unpackRoot],
        projectRoot,
    );
    const packedPackage = join(unpackRoot, "package");
    const packedMetadata = JSON.parse(
        readFileSync(join(packedPackage, "package.json"), "utf8"),
    );
    if (packedMetadata.engines?.node !== ">=20") {
        fail(
            "Node compatibility",
            `expected packed engines.node to be ">=20", got ${JSON.stringify(packedMetadata.engines?.node)}`,
        );
    }

    for (const bundle of ["index.mjs", "index.js", "rest.mjs", "rest.js"]) {
        const contents = readFileSync(
            join(packedPackage, "dist", bundle),
            "utf8",
        );
        if (!contents.includes(packInfo.version)) {
            fail(
                "build-time package metadata",
                `${bundle} does not contain package version ${packInfo.version}`,
            );
        }
        if (contents.includes("__ALPACA_PACKAGE_VERSION__")) {
            fail(
                "build-time package metadata",
                `${bundle} contains the unresolved package version token`,
            );
        }
        const packageMetadataDependencies = externalModuleSpecifiers(
            contents,
        ).filter((specifier) => /(^|\/)package\.json$/.test(specifier));
        if (packageMetadataDependencies.length > 0) {
            fail(
                "build-time package metadata",
                `${bundle} imports package metadata at runtime: ${packageMetadataDependencies.join(", ")}`,
            );
        }
    }

    const forbiddenRestDependencies = [
        "node:events",
        "ws",
        "@msgpack/msgpack",
    ];
    for (const bundle of ["rest.mjs", "rest.js"]) {
        const contents = readFileSync(
            join(packedPackage, "dist", bundle),
            "utf8",
        );
        const forbidden = forbiddenExternalSpecifiers(
            contents,
            forbiddenRestDependencies,
        );
        if (forbidden.length > 0) {
            fail(
                "REST bundle isolation",
                `${bundle} imports streaming-only dependencies: ${forbidden.join(", ")}`,
            );
        }
        const buildMetadataDependencies = externalModuleSpecifiers(contents)
            .filter(
                (specifier) =>
                    specifier.startsWith("node:") ||
                    /(^|\/)package\.json$/.test(specifier),
            );
        if (buildMetadataDependencies.length > 0) {
            fail(
                "REST bundle isolation",
                `${bundle} imports build-only metadata dependencies: ${buildMetadataDependencies.join(", ")}`,
            );
        }
    }

    for (const declaration of packInfo.files
        .map(({ path }) => path)
        .filter((path) => /^dist\/.*\.d\.(?:ts|mts)$/.test(path))) {
        const contents = readFileSync(join(packedPackage, declaration), "utf8");
        if (
            contents.includes("__ALPACA_PACKAGE_VERSION__") ||
            /(?:from|import)\s*[(]?["'][^"']*package\.json["']/.test(contents)
        ) {
            fail(
                "declaration isolation",
                `${declaration} references build-time package metadata`,
            );
        }
    }

    const consumerRoot = join(tempRoot, "consumer");
    cpSync(fixturesRoot, consumerRoot, { recursive: true });
    const consumerModules = join(consumerRoot, "node_modules");
    linkPackage(
        packedPackage,
        join(consumerModules, "@alpacahq", "alpaca-trade-api"),
    );

    for (const dependency of [
        "@msgpack/msgpack",
        "lossless-json",
        "ws",
    ]) {
        linkPackage(
            join(projectRoot, "node_modules", dependency),
            join(packedPackage, "node_modules", dependency),
        );
    }
    for (const dependency of [
        "@types/node",
        "@types/ws",
        "undici-types",
    ]) {
        linkPackage(
            join(projectRoot, "node_modules", dependency),
            join(consumerModules, dependency),
        );
    }

    const tsc = join(projectRoot, "node_modules", "typescript", "bin", "tsc");
    for (const fixture of [
        "node-esm",
        "node-cjs",
        "node-no-dom",
        "edge",
        "rest",
    ]) {
        run(
            `${fixture} declarations`,
            process.execPath,
            [tsc, "-p", join(consumerRoot, fixture, "tsconfig.json")],
            join(consumerRoot, fixture),
        );
    }

    run(
        "Node ESM runtime",
        process.execPath,
        [join(consumerRoot, "node-esm", "runtime.mjs")],
        join(consumerRoot, "node-esm"),
    );
    run(
        "Node CJS runtime",
        process.execPath,
        [join(consumerRoot, "node-cjs", "runtime.cjs")],
        join(consumerRoot, "node-cjs"),
    );
    run(
        "edge-light runtime condition",
        process.execPath,
        [
            "--conditions=edge-light",
            join(consumerRoot, "edge", "runtime.mjs"),
        ],
        join(consumerRoot, "edge"),
    );
    run(
        "explicit REST runtime",
        process.execPath,
        [join(consumerRoot, "rest", "runtime.mjs")],
        join(consumerRoot, "rest"),
    );
} catch (error) {
    fail(
        "package verification setup",
        error instanceof Error ? error.stack ?? error.message : String(error),
    );
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
    console.error(failures.map((failure) => `FAIL ${failure}`).join("\n\n"));
    process.exitCode = 1;
} else {
    console.log("Packed package consumers verified.");
}
