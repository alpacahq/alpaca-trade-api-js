# Contributing

Thanks for helping improve `@alpacahq/alpaca-trade-api`. By participating, you
agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Choose the right channel

- **SDK bugs, SDK feature requests, and SDK-specific questions:** search or open
  a [GitHub issue](https://github.com/alpacahq/alpaca-trade-api-js/issues/new/choose).
- **Security vulnerabilities:** do not open a public issue. Follow the private
  reporting process in our [Security Policy](./SECURITY.md).
- **Account-specific questions:** contact
  [Alpaca Support](https://alpaca.markets/support) privately.
- **General Alpaca API or platform discussion:** use the
  [Alpaca Community Forum](https://forum.alpaca.markets/).
- **General community discussion:** join the
  [Alpaca community on Slack](https://alpaca.markets/slack).

Please do not include credentials, account details, or other sensitive
information in an issue, discussion, pull request, test, or example.

## Contribution policy

### Contributions we welcome

Focused contributions are welcome when they improve this SDK, including:

- bug fixes and compatibility improvements;
- support for documented Alpaca API capabilities;
- focused tests and reliability improvements;
- documentation and examples; and
- maintainability improvements that preserve public behavior.

### Discuss substantial changes first

Open an issue before investing in a substantial SDK design, new dependency,
broad refactor, or third-party integration. Early discussion helps confirm that
the proposal fits the SDK's scope and avoids duplicated or unusable work.

Missing or incorrect API behavior and OpenAPI specification defects must be
fixed upstream, not patched in this SDK. Report the gap in an issue so
maintainers can track it and coordinate the upstream resolution. Maintainers
alone update pinned specifications and run the generation pipeline. Changes to
specifications, overlays, templates, generator tooling, generated clients,
models, or types are out of scope for external contributions. See
[Generated vs hand-written code](#generated-vs-hand-written-code) for work that
can be proposed in this repository.

### Out of scope

This repository does not accept:

- trading strategies, algorithm design, or investment advice;
- account-specific or general Alpaca platform support requests;
- credentials, private account data, or other secrets;
- referral links or promotional content; or
- unapproved integrations with third-party products or services.

Contributions that add or promote third-party products or services—including
provider-specific clients, API calls, hosted endpoints, referral links, or
promotional content—require prior written approval from Alpaca before
implementation. Open an issue describing the technical scope; repository
maintainers will coordinate the necessary internal review and confirm whether
the proposal may proceed. Contributors do not need to identify or contact
internal approvers.

Using an ordinary open-source dependency or improving generic interoperability
does not by itself make a contribution a provider-specific integration.
Maintainers will explain when a proposal falls outside this policy. A pull
request that proceeds without the required approval may be closed as out of
scope, so open an issue first if you are unsure whether a proposal qualifies.

## License and contribution terms

The project is licensed under the [Apache License 2.0](./LICENSE). Subject to
its full terms, the license permits use, reproduction, modification, and
distribution of the software. It does not grant permission to use Alpaca trade
names, trademarks, service marks, or product names except as described in the
license.

Unless you explicitly state otherwise, a contribution intentionally submitted
for inclusion in this project is provided under Apache-2.0 without additional
terms, as described in Section 5 of the license. This project does not currently
require a separate Contributor License Agreement (CLA) or Developer Certificate
of Origin (DCO) sign-off.

## Contribution workflow

1. Search existing issues and pull requests.
2. Open an issue first for work described under
   [Discuss substantial changes first](#discuss-substantial-changes-first).
3. Fork the repository and create a focused branch.
4. Install dependencies and make the change in hand-written code.
5. Add focused tests for new or changed behavior and update relevant
   documentation.
6. Run the relevant checks listed below.
7. Add a Changeset for an SDK-consumer-facing change.
8. Open a focused pull request, explain why the change is needed, and respond to
   review feedback.

Use clear, descriptive commit messages and pull request titles. Conventional
Commits are not required, and contributors do not need to squash commits before
opening a pull request. Maintainers use GitHub's squash-merge workflow for the
final merge.

## Prerequisites

- **Node.js >= 24** (see `.nvmrc`). The published SDK supports Node >= 20; CI
  verifies the packed package on that floor separately.

## Setup and checks

```bash
npm install            # also builds via the `prepare` script
npm run build          # tsup -> dist/ (dual ESM + CJS)
npm run typecheck      # tsc --noEmit (the type authority)
npm run lint           # biome lint (hand-written code only)
npm test               # vitest
```

The repository does not enforce a formatter. Match the surrounding style and
run the linter. There is no numeric coverage threshold, but changed behavior
must have focused tests.

## Testing and financial safety

- Repository tests must never place live orders or depend on a live trading
  account.
- Tests must be deterministic and run without Alpaca credentials. Use mocks,
  fakes, or synthetic fixtures for API behavior.
- Runnable trading examples must use paper trading by default and require an
  explicit user choice before targeting live trading.
- Real credentials, account identifiers, account data, and production payloads
  must never appear in tests, fixtures, examples, snapshots, or logs.

Preview and validate the documentation site locally:

```bash
npm --prefix docs install   # first time only
npm --prefix docs start     # dev server
npm --prefix docs run build # production build (same as CI/docs deploy)
```

## Generated vs hand-written code

REST clients and models under `src/trading/{apis,models,index.ts}` and
`src/market-data/{apis,models,index.ts}` are **OpenAPI Generator output**.
Generated files and their generation sources—including pinned specifications,
overlays, templates, and generator tooling—are maintained by project
maintainers and are out of scope for external contributions. Maintainers are
responsible for keeping the SDK aligned with upstream specifications, running
the generation pipeline, and committing the resulting clients, models, and
types.

Contributors should report missing or incorrect API coverage rather than patch
generated output. After maintainers adopt an upstream fix, contributors may
help with tests, documentation, examples, or hand-written ergonomics.

Anyone may run safe generation checks locally for testing or diagnostics:

```bash
npm run generate:offline             # reproduce trees from pinned specs
npm run generate -- --dry-run --yes  # preview upstream changes without writes
```

Local generation does not make generated changes part of a contribution.
External contributors must discard changes to pinned specifications, generation
sources, and generated trees before opening a pull request. Maintainer-led
generation updates are handled separately.

Behavior, ergonomics, streaming, pagination, and shared transport live in
hand-written modules (`src/client.ts`, `src/orders.ts`, `src/core/runtime.ts`,
`src/streaming/`, and similar modules). Maintainers and AI agents acting on
their behalf should see
[AGENTS.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md)
and
[tooling/GENERATION.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/tooling/GENERATION.md)
for the full rules.

## Documentation

The hosted guides are canonical for workflows, conventions, and safety. The
curated API Reference supports discovery and examples; installed TypeScript
declarations are authoritative for exact signatures and models.

- **Authored guides** live under
  [`docs/docs/`](https://github.com/alpacahq/alpaca-trade-api-js/tree/master/docs/docs/).
- **Generated pages**—API reference, examples, and the migration page—are
  produced during the docs build from the SDK capability maps, repository
  examples, and root [`MIGRATION.md`](./MIGRATION.md).
- **Production build:** `npm --prefix docs run build` (runs generators first,
  then Docusaurus). CI and the GitHub Pages deploy use this path.

See the
[documentation development guide](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/docs/README.md)
for local preview, generated-page boundaries, validation, and deployment.

For AI-consumer guidance, `LLMS.md` is authored and
`skills/alpaca-trade-api-sdk/SKILL.md` is generated. Edit `LLMS.md`, then run:

```bash
npm run agent:skill
npm run agent:skill:check
```

Commit the regenerated Skill with its source.

When you add ergonomic helpers, keep [`src/capabilities.ts`](./src/capabilities.ts)
in sync—a test asserts every listed helper exists on the facade.

## User-facing changes and releases

SDK-consumer-facing changes ship with a
[Changesets](https://github.com/changesets/changesets) entry:

```bash
npm run changeset
```

Pick the semver bump and write a one-line, user-facing summary. Commit the
generated `.changeset/*.md` file with your change. Governance-only
documentation, CI maintenance, and internal refactors with no consumer impact
do not need a Changeset.

Merging to `master` opens a version PR; publishing to npm **`latest`** happens
after that PR merges. See
[AGENTS.md](https://github.com/alpacahq/alpaca-trade-api-js/blob/master/AGENTS.md)
for the release workflow.

## Pull request checklist

Before requesting review, confirm that:

- the change is focused, explained, and linked to prior discussion when needed;
- generated clients, models, types, specifications, and generation sources are
  unchanged, unless this is a maintainer-led generation update;
- new or changed behavior has focused tests;
- tests are deterministic and credential-free and cannot place live orders;
- trading examples default to paper trading and fixtures contain only synthetic
  data;
- relevant documentation and examples are updated;
- relevant typecheck, lint, test, build, package, documentation, and generation
  checks pass;
- a Changeset is included when the change affects SDK consumers;
- no credentials, account data, or other secrets are included; and
- any provider-specific integration or promotional contribution has written
  Alpaca approval confirmed by repository maintainers.
