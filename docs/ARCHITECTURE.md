# Forge (`forge-ts`): System Architecture

## 1. System Overview
`forge-ts` is a unified, zero-config CLI built for **Node.js 24.14.0 LTS ("Krypton")** and **TypeScript 6.0**. It operates as the universal documentation compiler for any TypeScript project (APIs, SDKs, Frontends, CLIs).

By performing a single, blazing-fast AST traversal via the TypeScript Compiler API, it replaces the fragmented ecosystem of ESLint + Prettier (superseded by **Biome 2.4**), TypeDoc, OpenAPI generators, and custom test runners.

The architecture is composed of four primary subsystems:
1. **The Build Gate (`@forge-ts/enforcer`)**
2. **The DocTest Engine (`@forge-ts/doctest`)**
3. **The API Generator (`@forge-ts/api`)**
4. **The Output Generator (`@forge-ts/gen`)** - Handles Consumer Markdown, MDX, and AI Context.

## 2. Mental Model
```text
[ Any TypeScript Project Source Code (TS 6.0+) ]  <-- The Single Source of Truth
                       |
                       v
       [ TS Compiler API Parse (AST) ]  <-- One AST to rule them all
                       |
   +-------------------+-------------------+-------------------+
   |                   |                   |                   |
 1. Gate            2. Test             3. API              4. Output
(@forge-ts/       (@forge-ts/         (@forge-ts/         (@forge-ts/
 enforcer)         doctest)            api)                gen)
   |                   |                   |                   |
Validates         Extracts & runs     Generates         Generates Markdown,
TSDoc presence    @example blocks     openapi.json &    MDX, READMEs, and
on public         as Virtual Tests    API Reference     llms.txt contexts
exports
```

## 3. Subsystem Breakdown

### 3.1 The Build Gate (`@forge-ts/enforcer`)
- **Role:** Replaces `#![deny(missing_docs)]` from Rust.
- **Mechanism:** Leverages `ts.createProgram` (TS 6.0 API) to resolve project entry points based on `tsconfig.json`. Walks the AST to find all exported declarations.
- **Validation:** Uses `@microsoft/tsdoc` to parse comments. If a public export lacks documentation or has invalid syntax, it exits with `code 1`, halting the build before `tsc` or `esbuild` runs.

### 3.2 The DocTest Engine (`@forge-ts/doctest`)
- **Role:** Replaces `cargo test --doc`. Guarantees internal dev docs are always accurate.
- **Mechanism:**
  1. Identifies ````ts ```` blocks inside `@example` tags during the AST traversal.
  2. Generates hidden virtual test files (`.cache/forge-ts/doctests/*.test.ts`).
  3. Auto-injects imports for the parent symbol.
  4. Generates inline Source Maps tying the virtual file's lines back to the original `.ts` source comment.
- **Execution:** Runs the generated tests via the native Node 24 `node:test` runner. Failures point directly to the JSDoc comment in the source file.

### 3.3 The API Generator (`@forge-ts/api`)
- **Role:** Converts exported TypeScript symbols into a complete OpenAPI 3.1 spec or a structured API Reference, depending on project type.
- **Mechanism:** Operates entirely from the `ForgeSymbol` graph produced by the AST traversal — no tsoa, no decorators, no runtime reflection.
  1. **Symbol extraction:** Collects exported interfaces, types, classes, and enums from the symbol graph.
  2. **Schema mapping:** Maps TypeScript type signatures to OpenAPI 3.1 schemas via a typed `schema-mapper`, handling generics, unions, intersections, and enums.
  3. **OpenAPI output:** Generates a complete `openapi.json` with proper schemas, operation tags, and visibility filtering (respects `@public`, `@beta`, `@internal`).
  4. **API Reference output:** For non-API projects (SDKs, CLIs), produces a structured API Reference JSON from the same symbol data.

### 3.4 The Output Generator (`@forge-ts/gen`)
- **Role:** Delivers the Consumer Docs (Markdown/MDX) and AI Context (`llms.txt`).
- **Mechanism:**
  1. Takes the parsed TSDoc comments and generated API JSON.
  2. **Consumer Docs:** Emits clean, formatted Markdown/MDX files ready for Docusaurus, Mintlify, or Nextra. Syncs code examples into the project's root `README.md`.
  3. **AI Context:** Strips human-centric UI artifacts and emits `docs/llms.txt` (a routing manifest listing available context files) and `docs/llms-full.txt` (a dense context file with full type signatures, parameter docs, return types, and code examples).

## 4. Technology Stack (March 2026, Research-Validated)

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS ("Krypton") | Runtime — native TS stripping (`--experimental-strip-types` on by default since v23.6.0), `require(esm)` enabled, V8 13.6 |
| TypeScript | 6.0 (beta/RC) | Compiler API — last JS-based release. New defaults: `strict=true`, `target=es2025`, `module=esnext`, `esModuleInterop` always enabled. `types` defaults to `[]` (must explicitly add `@types/node`). |
| pnpm | 10.x | Monorepo workspaces; topological build ordering via `pnpm -r` |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing (stable, 181 dependents) |
| citty | 0.2.1 | Type-safe CLI framework (zero deps, 2.9kB) |
| @cleocode/lafs-protocol | 1.7.0 | LLM-Agent-First output layer |
| @changesets/cli | 2.x | Monorepo versioning with fixed version strategy |
| Vitest | 4.1.0 | Unit tests — stable browser mode, 28M weekly downloads |
| node:test | Built-in (Node 24) | DocTest execution — automatic subtest awaiting, `--test-rerun-failures`, per-test timeouts, smarter watch mode |
| Biome | 2.4 | Linting + formatting — replaces ESLint + Prettier; 10-100x faster, 423+ lint rules, type-aware linting |
| tsup | 8.5.x | ESM bundling + `.d.ts` declaration file generation |

## 5. Execution Flow

### 5.1 Standard Scripts
Developers add standard scripts to their `package.json`:
- `"check": "forge-ts check"` -> Runs the Enforcer.
- `"test:docs": "forge-ts test"` -> Runs the DocTests.
- `"docs:build": "forge-ts build"` -> Generates `openapi.json`, Consumer Markdown, and `llms.txt`.

### 5.5 CLI LAFS Integration (Agent-First Output)
The CLI is built on `citty 0.2.1` and integrates `@cleocode/lafs-protocol 1.7.0` to produce machine-readable output for LLM agents alongside human-readable output.

**Output mode flags** (available on all commands):

| Flag | Behavior |
|------|----------|
| `--json` | Emits a `LAFSEnvelope` JSON object to stdout; all human text goes to stderr |
| `--human` | Forces plain human-readable output (default in TTY contexts) |
| `--quiet` | Suppresses all non-error output |
| `--mvi` | Machine-Verifiable Intent — includes a structured `intent` block in the envelope for agent verification |

**LAFSEnvelope structure:** Every `--json` response wraps the command result in a typed envelope with `status`, `data`, `warnings`, and optional `intent` fields. This allows agents to parse forge-ts output reliably without scraping human-formatted text.

**Design principle:** forge-ts treats agents as first-class consumers. When running in a CI/CD pipeline or under an LLM agent, pass `--json` to get structured, parseable output. Human display is opt-in, not the default for programmatic use.

## 6. Tooling Rationale

### pnpm over Bun
Bun 1.3.11 was evaluated and rejected as the monorepo manager/runtime for forge-ts due to fundamental incompatibilities with our core dependency:

- **TypeScript Compiler API crashes in Bun** (seg faults, stack overflows — GitHub issue #18960). This is a hard blocker since `@forge-ts/enforcer` and `@forge-ts/doctest` are built entirely on `ts.createProgram`.
- **No `.d.ts` generation**: Bun cannot generate TypeScript declaration files, which tsup handles for our published packages.
- **No topological build ordering**: `pnpm -r --filter` provides dependency-ordered builds across the monorepo; Bun has no equivalent.
- **Partial `node:test` implementation**: Forge relies on advanced `node:test` features (per-test timeouts, automatic subtest awaiting) that are not fully implemented in Bun.

pnpm 10.x with `pnpm -r` is battle-tested, provides true topological workspace builds, and has zero compatibility issues with the TS Compiler API.

### Biome over ESLint + Prettier
Biome 2.4 replaces the ESLint + Prettier combination across the monorepo:

- **Performance**: 10-100x faster than ESLint + Prettier in benchmarks — critical for a tool that acts as a build gate.
- **Unified config**: A single `biome.json` replaces `.eslintrc`, `.prettierrc`, and multiple plugin configs.
- **Rule coverage**: 423+ lint rules, including type-aware linting, covering the equivalent of `eslint:recommended` + `@typescript-eslint/recommended` + Prettier.
- **Zero peer-dependency fragility**: ESLint's plugin ecosystem has frequent breaking changes across major versions; Biome ships as a single binary.