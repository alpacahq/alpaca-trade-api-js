---
type: Architecture Decision
title: ADR-0004 Releases managed with Changesets and published from CI
description: Human-authored changesets drive versioning and the changelog, and publication to npm happens from GitHub Actions with provenance rather than from a contributor machine.
status: accepted
date: unknown
deciders: []
supersedes: []
affects: [alpaca_trade_api_js.sdk]
allium: []
evidence: ["AGENTS.md", ".changeset/config.json", ".changeset/README.md", ".github/workflows/release.yaml", ".github/workflows/ci.yaml", "package.json", "CHANGELOG.md"]
tags: [alpacahq, adr, generated]
timestamp: 2026-09-12T00:00:00+00:00
generated_by: claude-opus-5 / layered-docs 2026-09
source_commit: d9bf929886238c16dc790501432c9e3cd7c0f8e2
source_branch: docs/layered-2026-09
generated_at: 2026-09-12T00:00:00+00:00
confidence: high
review_status: draft-needs-review
---

# ADR-0004 Releases managed with Changesets and published from CI

## Context

The package is public and scoped, and its changelog is meant to be user-facing rather
than a dump of commit subjects. Publishing from a contributor laptop would spread
registry credentials and make provenance impossible (`AGENTS.md`).

## Decision

Versioning and `CHANGELOG.md` are managed with Changesets. Every user-facing change
ships a human-authored changeset file describing it and its semver bump; internal-only
changes need none. On pushes to the default branch the Changesets action opens or
updates a "chore: version packages" pull request, and merging it runs
`npm run release` to publish to the `latest` dist-tag from GitHub Actions with npm
provenance enabled (`AGENTS.md`, `.changeset/config.json`,
`.github/workflows/release.yaml`).

## Consequences

- The release workflow holds publish credentials, so it requests `id-token: write`, sets `NPM_CONFIG_PROVENANCE`, needs the `NPM_KEY` repository secret, and pins the Changesets action to an immutable commit SHA as a supply-chain guard (`.github/workflows/release.yaml`).
- CI validates pending changesets on every pull request, recreating the local base branch reference the tool needs (`.github/workflows/ci.yaml`).
- `@changesets/changelog-github` requires a token when versioning locally in order to resolve pull request and author links; the workflow supplies it automatically (`AGENTS.md`).
- `access: public` is configured because the package is scoped (`.changeset/config.json`, `AGENTS.md`).
