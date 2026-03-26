# Dependabot Configuration Guide

> LLM-facing reference for replicating the Dependabot setup used in `forge-ts` across other repositories.

## What Dependabot Does

GitHub Dependabot automatically opens PRs to keep your dependencies up to date. It monitors two ecosystems:

1. **npm packages** — your `package.json` / lockfile dependencies
2. **GitHub Actions** — action versions used in `.github/workflows/*.yml`

## File Location

Create `.github/dependabot.yml` at the repository root. This is the only file needed.

## The Configuration

```yaml
version: 2
updates:
  # 1. npm/yarn/pnpm dependencies
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types:
          - minor
          - patch

  # 2. GitHub Actions versions
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

## Key Design Decisions

### Grouping minor + patch together

The `groups` block batches all minor and patch npm updates into a **single PR** instead of one PR per dependency. This keeps your PR list clean. Major version bumps still get their own individual PRs since they often contain breaking changes and need manual review.

### Weekly schedule

`interval: weekly` checks once per week (Monday by default). Other options:
- `daily` — aggressive, can be noisy
- `monthly` — too slow for security patches
- Weekly is the sweet spot for most projects.

### GitHub Actions as a separate ecosystem

Actions pin to major versions (e.g., `actions/checkout@v4`) but get security fixes and features in minor/patch releases. Dependabot tracks these separately from npm.

## Adapting for Other Projects

### Monorepo with multiple package.json files

If your monorepo has independent `package.json` files in subdirectories that each have their own lockfile, add one entry per directory:

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]

  - package-ecosystem: npm
    directory: /apps/web
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
```

> Note: If you use a single root lockfile (like pnpm workspaces), you only need one entry with `directory: /`. That's what forge-ts does.

### Ignoring specific packages

To skip a package (e.g., you want to stay on TypeScript 5.x):

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    ignore:
      - dependency-name: typescript
        update-types: [version-update:semver-major]
    groups:
      minor-and-patch:
        update-types: [minor, patch]
```

### Adding labels

To auto-label Dependabot PRs for filtering:

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    labels:
      - dependencies
      - automated
    groups:
      minor-and-patch:
        update-types: [minor, patch]
```

> GitHub automatically adds `dependencies` and ecosystem labels (e.g., `javascript`, `github_actions`) to Dependabot PRs even without this config.

### Limiting open PRs

To prevent Dependabot from flooding you:

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
```

Default is 5 for version updates. Set to 0 to disable.

### Adding reviewers or assignees

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    reviewers:
      - kryptobaseddev
    assignees:
      - kryptobaseddev
```

## Auto-Merge (Optional)

Dependabot PRs can auto-merge if CI passes. This requires a GitHub Actions workflow:

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Auto-merge Dependabot

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Auto-merge minor/patch updates
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This only auto-merges after all required status checks pass. Major version bumps won't auto-merge because CI will typically fail on breaking changes.

> Requires branch protection rules with required status checks enabled on your default branch.

## Minimal Copy-Paste Setup

For a new repo, create `.github/dependabot.yml` with:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

That's it. Dependabot activates automatically once this file is on your default branch.

## Supported Package Ecosystems

Beyond npm and github-actions, Dependabot supports:
- `pip` (Python)
- `cargo` (Rust)
- `gomod` (Go)
- `composer` (PHP)
- `docker` (Dockerfiles)
- `terraform`
- `nuget` (.NET)
- `bundler` (Ruby)
- `mix` (Elixir)

Use the same pattern — just change `package-ecosystem` and `directory`.
