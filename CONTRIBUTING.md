# Contributing to forge-ts

Thank you for your interest in contributing to forge-ts. This document covers everything you need to get started.

---

## Development Setup

```bash
git clone https://github.com/kryptobaseddev/forge-ts.git
cd forge-ts
pnpm install
pnpm -r build
pnpm test
```

Node.js >=24 and pnpm >=10 are required.

---

## Project Structure

```
packages/
  core/       # Shared types, config loader, and AST walker
  enforcer/   # TSDoc enforcement (the build gate)
  doctest/    # @example block extraction and test execution
  api/        # OpenAPI 3.1 spec generation
  gen/        # Markdown, MDX, and llms.txt generation
  cli/        # Unified CLI entry point
fixtures/
  sample-project/  # E2E test fixture used by integration tests
docs/
  adr/             # Architecture Decision Records
  generated/       # forge-ts dogfood output (git-ignored)
```

---

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Build and test: `pnpm -r build && pnpm test`
4. Lint: `npx biome check .`
5. Validate TSDoc coverage: `npx forge-ts check`
6. Create a changeset: `pnpm changeset`
7. Open a pull request against `main`

---

## Code Standards

### TSDoc

All public exports **must** have TSDoc comments. The `forge-ts check` command enforces this and runs in CI. A pull request will not merge if `forge-ts check` fails.

Minimum required tags for exported functions:

```typescript
/**
 * Brief one-line summary.
 *
 * @param input - Description of the parameter.
 * @returns Description of the return value.
 * @example
 * ```ts
 * const result = myFunction("value");
 * // => "expected output"
 * ```
 */
export function myFunction(input: string): string { ... }
```

### Types

- All shared contracts live in `@forge-ts/core`. Do not duplicate type definitions across packages.
- Zero `any` or `unknown` in production code — enforced by Biome. Use precise types or generics.

### Formatting

Code is formatted with Biome (tabs, double quotes, semicolons). Run `npx biome check --write .` before committing, or configure your editor to format on save.

### Tests

- Tests use **Vitest 4.x**.
- Unit tests live alongside the source file they test (e.g., `src/foo.ts` and `src/foo.test.ts`).
- Integration tests use the fixture at `fixtures/sample-project/`.
- All `@example` blocks are executed as doctests by `forge-ts test`.

---

## Adding a Changeset

Any pull request that includes a user-facing change (new feature, bug fix, breaking change) requires a changeset.

```bash
pnpm changeset
```

The interactive prompt will ask you to:

1. Select the affected packages
2. Choose the bump type: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
3. Write a one-line summary of the change

This creates a file in `.changeset/` that must be committed with your PR. The changeset is consumed during the release process to update `CHANGELOG.md` and bump package versions.

---

## Architecture Decisions

Significant design decisions are documented as Architecture Decision Records in `docs/adr/`. When making a non-trivial architectural choice, add an ADR so future contributors understand the reasoning.

---

## Reporting Issues

Open an issue on [GitHub](https://github.com/kryptobaseddev/forge-ts/issues) with:

- A minimal reproduction case
- The output of `forge-ts check --json` or `forge-ts build --json` if applicable
- Your Node.js version (`node --version`) and OS
