import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

/**
 * Re-add the `node:` scheme to Node builtin imports in the emitted bundles.
 *
 * Source uses `node:events`, but tsup strips the prefix in its post-esbuild
 * pipeline (emitting bare `events`) regardless of `platform`/esbuild plugins.
 * Edge runtimes and Node ESM rely on the `node:` prefix to recognize builtins,
 * so rewrite the (single-quoted) `from '<builtin>'` / `require('<builtin>')`
 * specifiers back to `node:<builtin>` after the chunk is rendered. Scoped to the
 * known builtins set and import/require positions to avoid touching literals.
 */
const builtinSpecifier = new RegExp(
    `(\\bfrom\\s*|\\brequire\\()(['"])(${builtinModules.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\2`,
    "g",
);
const preserveNodeProtocol = {
    name: "preserve-node-protocol",
    renderChunk(code: string) {
        const next = code.replace(builtinSpecifier, (_m, pre, quote, name) => `${pre}${quote}node:${name}${quote}`);
        return next === code ? undefined : { code: next };
    },
};

/**
 * Dual ESM + CJS build.
 *
 * `tsc` remains the type authority (`npm run typecheck`); tsup/esbuild produces
 * the runtime artifacts so we get *native* ESM (`dist/index.mjs`) and CJS
 * (`dist/index.js`) without rewriting the generated source's extensionless
 * relative imports. Runtime dependencies (`ws`, `@msgpack/msgpack`) and Node
 * builtins are left external by default.
 *
 * Declarations use `experimentalDts` (api-extractor based) rather than the
 * legacy `dts` rollup. The public API re-exports many namespaces via
 * `export * as <ns>` (`trading`, `marketData`, `streaming`, ...); the legacy
 * dts rollup emitted those namespaces' type-only members as
 * `declare const X: typeof X`, which is invalid TS and breaks consumers that
 * don't set `skipLibCheck`. `experimentalDts` emits correct namespace
 * re-exports, so the published typings type-check cleanly on their own.
 */
export default defineConfig({
    // `rest` is a REST-only entrypoint that does not pull in the streaming
    // module (so `ws`/`@msgpack/msgpack` stay out of REST-only bundles).
    entry: ["src/index.ts", "src/rest.ts", "src/testing.ts"],
    format: ["cjs", "esm"],
    experimentalDts: true,
    sourcemap: true,
    clean: true,
    // Single-file output per format (no shared chunks) for a clean package.
    splitting: false,
    treeshake: true,
    target: "es2020",
    platform: "node",
    outDir: "dist",
    plugins: [preserveNodeProtocol],
});
