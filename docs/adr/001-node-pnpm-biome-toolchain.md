# ADR-001: Node 24 + pnpm + Biome + TypeScript 6.0 Toolchain

## Status
Accepted

## Date
2026-03-18

## Context

`forge-ts` is built directly on the TypeScript Compiler API (`ts.createProgram`, `ts.TypeChecker`). This is not an optional dependency — it is the foundation of the `@forge-ts/enforcer` and `@forge-ts/doctest` subsystems. Any candidate runtime or toolchain must be fully compatible with the TS Compiler API's execution model.

The project additionally requires:

- **Monorepo support** with topological build ordering across `@forge-ts/cli`, `@forge-ts/enforcer`, `@forge-ts/doctest`, `@forge-ts/api`, and `@forge-ts/gen`.
- **`.d.ts` declaration file generation** for all published packages so consumers get full type safety.
- **Native TypeScript execution** to avoid a separate transpile step during development.
- **A fast, unified linting + formatting layer** to enforce code quality without ESLint's plugin fragility.
- **A stable test runner** supporting per-test timeouts, automatic subtest awaiting, and watch mode for the DocTest engine.

A runtime and toolchain evaluation was conducted in March 2026. Bun 1.3.11 was assessed as the primary alternative to the Node.js + pnpm baseline.

## Decision

Adopt the following toolchain, version-pinned:

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS ("Krypton") | Primary runtime for development, CI, and DocTest execution |
| pnpm | 10.x | Monorepo workspace manager with topological build support |
| TypeScript | 6.0 (beta/RC) | Compiler and Compiler API (last JS-based release) |
| Vitest | 4.1.0 | Unit test layer |
| node:test | Built-in (Node 24) | DocTest execution engine |
| Biome | 2.4 | Linting and formatting (replaces ESLint + Prettier) |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing |
| tsup | 8.5.x | ESM bundling and `.d.ts` generation for published packages |

## Alternatives Considered

### Bun 1.3.11

Bun was evaluated as a potential replacement for Node.js as the runtime and for pnpm as the monorepo/package manager. It was **rejected** due to hard blockers:

**TypeScript Compiler API incompatibility (Hard Blocker)**
Running `ts.createProgram` under Bun 1.3.11 produces seg faults and stack overflows (GitHub issue #18960). Since the entire `@forge-ts/enforcer` build gate and `@forge-ts/doctest` engine are built on the TS Compiler API, Bun is fundamentally incompatible with forge-ts's architecture. This is not a configuration issue — it is a runtime-level crash.

**No `.d.ts` declaration file generation (Hard Blocker)**
Bun cannot emit TypeScript declaration files. All forge-ts packages must ship `.d.ts` files so downstream consumers receive accurate type information. This requires `tsup` (which runs under Node.js) regardless.

**No topological build ordering (Blocker)**
`forge-ts` is an inter-dependent monorepo: `@forge-ts/enforcer` is consumed by `@forge-ts/cli`, which depends on outputs from `@forge-ts/api` and `@forge-ts/gen`. Correct build ordering requires dependency-aware execution. `pnpm -r --filter` provides this natively. Bun has no equivalent topological workspace build command.

**Partial `node:test` implementation (Blocker)**
`@forge-ts/doctest` relies on advanced `node:test` features that are stable in Node 24 but not fully implemented in Bun's `node:test` shim: per-test timeouts, automatic subtest awaiting, and `--test-rerun-failures`.

### ESLint + Prettier

The traditional TypeScript linting and formatting stack (ESLint with `@typescript-eslint`, `eslint-plugin-tsdoc`, and Prettier) was evaluated against Biome 2.4. It was **rejected** in favor of Biome for the following reasons:

**Performance**
Biome is 10-100x faster than ESLint + Prettier in benchmarks. For a tool that runs as a build gate (`forge-ts check`), linter speed is a first-class concern.

**Configuration complexity**
The ESLint + Prettier combination requires multiple config files (`.eslintrc`, `.prettierrc`, `.eslintignore`), several peer dependencies, and careful plugin version management to avoid conflicts across ESLint major versions. Biome ships as a single binary with a single `biome.json`.

**Rule coverage**
Biome 2.4 includes 423+ lint rules, covering the functional equivalent of `eslint:recommended`, `@typescript-eslint/recommended`, and Prettier formatting. Type-aware linting is built in.

**Stability**
ESLint's plugin ecosystem has a history of breaking changes across major versions (v8 → v9 introduced a new flat config system requiring widespread plugin updates). Biome's single-binary distribution avoids this class of fragility entirely.

## Consequences

### Positive

- **TS Compiler API compatibility**: Node.js 24 + pnpm has zero known conflicts with `ts.createProgram`, `TypeChecker`, or any other TS Compiler API surface.
- **Native TypeScript execution**: Node 24 supports `--experimental-strip-types` by default (on since v23.6.0), eliminating a separate transpile step for scripts and development workflows.
- **Stable DocTest engine**: `node:test` in Node 24 is production-stable with all features `@forge-ts/doctest` requires (per-test timeouts, automatic subtest awaiting, `--test-rerun-failures`).
- **Fast feedback loop**: Biome replaces a 3-5 second ESLint + Prettier cycle with sub-100ms checks across the monorepo.
- **Correct monorepo builds**: `pnpm -r` with topological ordering guarantees packages are built in the right sequence on every `pnpm build`.
- **Modern TS defaults**: TypeScript 6.0's new defaults (`strict=true`, `target=es2025`, `module=esnext`) reduce `tsconfig.json` boilerplate to a minimum for new packages.

### Negative

- **TypeScript 6.0 deprecations**: TS 6.0 deprecates `target: es5`, `moduleResolution: node10/classic`, and `--baseUrl`. Any consumer projects using these options will receive warnings or errors when running through forge-ts.
- **`types: []` default**: TS 6.0 defaults `types` to an empty array, requiring every package that uses `@types/node` to explicitly declare it. This is a one-time migration cost but a likely stumbling block for new contributors.
- **Biome pre-stable features**: Some Biome 2.4 features (particularly advanced type-inference lint rules) are still evolving. Parity with every ESLint plugin is not yet complete.
- **Node 24 LTS only**: By targeting Node 24 LTS exclusively, forge-ts drops support for Node 20 LTS. Consumers still on Node 20 cannot use forge-ts until they upgrade.

### Risks

**TypeScript 7.0 Compiler API migration (High Impact, Medium Probability)**

TypeScript 7.0 (the Go rewrite, targeted mid-2026) will change the Compiler API that `@forge-ts/enforcer` and `@forge-ts/doctest` are built on. The scope of breaking changes is currently unknown.

- **Containment**: The TS Compiler API surface is isolated behind `@forge-ts/enforcer`'s internal module boundary. The migration is scoped to this package.
- **Trigger**: Begin migration when TS 7.0 publishes a stable Compiler API reference and a migration guide.
- **Runway**: TS 6.0 remains the stable, JS-based release. No action required until TS 7.0 stabilizes.

**Biome rule gaps (Low Impact, Low Probability)**

If Biome 2.4 lacks a lint rule that forge-ts needs (e.g., a TSDoc-specific check), we may need to implement a custom Biome plugin or accept the gap.

- **Mitigation**: TSDoc-specific validation is handled by `@microsoft/tsdoc` within `@forge-ts/enforcer`, not by Biome. Biome's role is limited to general code style and quality rules.
