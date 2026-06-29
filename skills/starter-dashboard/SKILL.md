---
name: starter-dashboard
description: Scaffold a local Next.js Alpaca dashboard using the published @alpacahq/alpaca-ts-alpha SDK for paper Trading API and Market Data API workflows. Use when the user asks for starter-dashboard, a starter Alpaca dashboard, a local Trading API demo, a Market Data API dashboard, or a greenfield Next.js Alpaca SDK prototype.
user_invocable: true
---

# Alpaca Starter Dashboard

Create a local Next.js dashboard for Alpaca paper trading and market data demos.
The generated app uses the published `@alpacahq/alpaca-ts-alpha` package and calls
the Trading API and Market Data API directly through the SDK.

## Workflow

1. Confirm the target directory and app name.
2. Create the app locally with `scripts/scaffold.ts`.
3. Default to paper trading (`APCA_PAPER="true"`). Do not configure live trading.
4. Report the target path and give next commands. Do not print secrets from `.env.local`.

## Run The Scaffolder

From this skill directory:

```bash
npx tsx scripts/scaffold.ts \
  --target-directory /path/to/my-alpaca-dashboard \
  --app-name my-alpaca-dashboard
```

If the local runtime supports it, `node scripts/scaffold.ts` or
`bun scripts/scaffold.ts` are also acceptable. Prefer `npx tsx` for Node 20
compatibility.

The script reads these credential environment variables when flags are omitted:

- `APCA_API_KEY_ID`
- `APCA_API_SECRET_KEY`

If credentials are not locally available, pass `--allow-placeholder-credentials`;
the generated `.env.local` will contain placeholders the user must fill before
running the app.

Useful flags:

- `--create-subdirectory`: treat `--target-directory` as the parent and create `target/app-name`.
- `--key-id` / `--secret`: write explicit paper credentials without reading environment variables.
- `--paper`: set the generated `APCA_PAPER` value. Defaults to `true`; keep this enabled for demos.

The target directory may already contain unrelated files. The scaffolder merges
the template into the target, but refuses to overwrite any existing generated
path, including `.env.local`.

Common failures:

- TypeScript runner unavailable: use `npx tsx`, `node` with native TypeScript support, or `bun`.
- Missing credentials: set `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`, pass `--key-id` / `--secret`, or use `--allow-placeholder-credentials`.
- Invalid app name: use a lowercase npm package name with no spaces, uppercase letters, leading dot, or leading underscore.
- Unsafe target: the target must not be a file or symlink, and generated paths must not already exist.

## Safety Rules

- Paper trading only by default. Do not configure live trading unless the user explicitly asks and understands the risk.
- Allow non-empty targets, but never overwrite existing files or write through symlinked generated paths.
- Never echo `APCA_API_SECRET_KEY` in chat or command output.
- Do not run `npm install` or `npm run dev` unless the user asks.

## Expected Result

The generated app contains `package.json`, `app/`, `components/`, `lib/`, and
`.env.local`. It includes dashboard, positions, stocks, stock detail, trade, and
orders pages.

Next commands:

```bash
cd /path/to/my-alpaca-dashboard
npm install
npm run dev
```
