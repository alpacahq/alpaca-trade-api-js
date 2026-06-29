import { configDefaults, defineConfig } from "vitest/config";

// The hand-maintained regeneration pipeline in tooling/ is a separate private
// package with its own dependencies and its own `vitest run`. Exclude it here so
// the SDK's `npm test` stays self-contained (a fresh root `npm install` does not
// install tooling/'s deps).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tooling/**"],
  },
});
