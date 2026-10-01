# Migration guides

Use the guide for the SDK major version currently installed in your
application. Most existing integrations are still on `3.x`, so the
[`3.x` → `4.0` guide](MIGRATION.md) remains the primary migration path.

## Choose an upgrade path

### `3.x` → `4.0`

Follow the [`3.x` → `4.0` migration guide](MIGRATION.md). It covers the complete
client rewrite and includes the
[`alpaca-v3-to-v4.js`](codemods/alpaca-v3-to-v4.js) codemod for the mechanical
parts of the migration.

### `4.x` → `5.0`

Follow the [`4.x` → `5.0` migration guide](MIGRATION_V5.md). Run the focused
[`alpaca-v4-to-v5.js`](codemods/alpaca-v4-to-v5.js) codemod to apply safe
generated-contract renames and identify semantic changes that need review.

### `3.x` → `5.0`

Upgrade one major at a time:

1. Complete the [`3.x` → `4.0` migration](MIGRATION.md), then run your
   type-checker and tests against version 4.
2. Complete the [`4.x` → `5.0` migration](MIGRATION_V5.md), then run your
   type-checker and tests against version 5.

Do not run the `4.x` → `5.0` codemod directly against a `3.x` codebase. The
second transform expects the namespaced version 4 client and generated types.

## Using codemods

The [codemod reference](codemods/README.md) lists copy-and-paste commands,
supported rewrites, and manual-review diagnostics for each migration.
Codemods intentionally handle only changes that can be transformed safely;
always review their output and complete the corresponding migration guide.
