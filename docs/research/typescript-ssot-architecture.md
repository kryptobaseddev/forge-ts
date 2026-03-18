# Forge (`forge-ts`): Gap Analysis & Architecture Proposal

## 1. Executive Summary
While Rust provides a seamless, integrated documentation experience (`cargo doc`, `cargo test --doc`, `#![deny(missing_docs)]`), TypeScript's ecosystem is heavily fragmented. Achieving a Single Source of Truth (SSoT) for documentation, testing, and API specifications in TypeScript currently requires manually stitching together ESLint, TypeDoc, OpenAPI generators, and test runners with extensive configuration.

This research proposes a new zero-config toolchain built directly on the TypeScript Compiler API. This toolchain will act as a unified build gate, doctest runner, and generator for human-readable, API-level, and LLM-optimized documentation.

## 2. Gap Analysis

### 2.1 Documentation Testing (The `cargo test --doc` equivalent)
**Current State:** Highly fragmented. Tools like `vite-plugin-doctest` and `node-doctest` exist but lack universal adoption. Older tools are broken with modern TS. Deno has native `deno test --doc`, but Node.js lacks a built-in equivalent.
**Gap:** No standard way to extract `@example` blocks from TSDoc and verify they compile and pass assertions without heavy plugin configuration.

### 2.2 Zero-Config Enforcement (The `#![deny(missing_docs)]` equivalent)
**Current State:** Requires stitching ESLint (`eslint-plugin-jsdoc`, `eslint-plugin-tsdoc`) and TypeDoc (`typedoc-plugin-coverage`) with ~50 lines of configuration.
**Gap:** Stitching these tools requires parsing the AST multiple times, making it slow and bloated. There is no simple `npx forge-ts check` that runs a fast, single-pass check on exported symbols.

### 2.3 API SSoT (OpenAPI vs. Code Docs)
**Current State:** `tsoa` offers great SSoT by using TSDoc to generate OpenAPI specs. `zod-to-openapi` is popular for runtime validation but fractures the SSoT because TSDoc cannot easily read Zod's `.describe()` runtime calls, decoupling code-level docs from API-level docs.
**Gap:** Need a cohesive way to bind runtime schema validation (like Zod) with build-time TSDoc extraction.

### 2.4 LLM-Optimized Output (`llms.txt`)
**Current State:** Emerging. Plugins like `typedoc-plugin-markdown` and `typedoc-plugin-llms-txt` are paving the way, but are often bolted onto existing human-centric workflows.
**Gap:** Projects need a unified pipeline that outputs code-level docs, `openapi.json`, and an aggregated `llms-full.txt` context file for AI agents in a single pass.

## 3. Architectural Proposal

To build a modern, high-performance SSoT documentation toolchain, we must abandon the "Frankenstein" approach of wrapping ESLint and TypeDoc. Instead, we will build a dedicated CLI using the **TypeScript Compiler API**.

### 3.1 The Build Gate (Native AST Walker)
- **Concept:** A zero-config CLI (`forge-ts check`) that runs before `tsc`.
- **Implementation:** Use `ts.createProgram` to parse the AST *once*. Use the TypeChecker to find all exported symbols and verify they have JSDoc comments.
- **Validation:** Pass extracted comments directly to `@microsoft/tsdoc` for strict syntax validation.
- **Result:** Blazing fast, zero-dependency validation that fails the build if public APIs are undocumented.

### 3.2 The DocTest Engine
- **Extraction:** Use `ts-morph` and `@microsoft/tsdoc` to safely extract ````ts ... ```` code blocks from `@example` tags.
- **Virtualization:** Auto-generate ES module imports for the parent symbol and wrap the snippets in standard test blocks (using `node:test` or `vitest`). Write these to a hidden `.cache/forge-ts/doctests` directory.
- **Source Mapping:** Crucially, generate inline source maps linking the virtual test assertions back to the exact line/column of the original TSDoc comment to ensure great developer UX on test failure.

### 3.3 The API & LLM Generation Pipeline
A 3-pronged output generator:
1. **Human Docs:** Integrate a streamlined markdown generator (bypassing heavy HTML generation).
2. **API Specs:** Integrate with or provide an adapter for `tsoa` (preferred for SSoT) or a Zod-AST transformer to output OpenAPI specs.
3. **Agent Context:** Automatically compile an `llms.txt` router and `llms-full.txt` (concatenated Markdown + OpenAPI spec) pre-loaded with repository guidelines (e.g., cursorrules).

## 4. Next Steps for Development
1. **Initialize the Monorepo:** Set up the package structure (`@forge-ts/cli`, `@forge-ts/enforcer`, `@forge-ts/doctest`, `@forge-ts/api`, `@forge-ts/gen`).
2. **Build the AST Walker:** Implement the core zero-config Build Gate (`@forge-ts/enforcer`) using `typescript` and `@microsoft/tsdoc`.
3. **Prototype DocTesting:** Build the extraction and source-mapping logic for virtualizing `@example` blocks (`@forge-ts/doctest`).
4. **Integrate Output Generators:** Build the Markdown, MDX, API, and `llms.txt` formatters (`@forge-ts/gen`).

## 5. Research Conclusions (March 2026)

This section documents the findings from the deep tooling evaluation conducted in March 2026, validating the concrete stack that will underpin forge-ts development.

### 5.1 Bun Evaluation and Rejection

Bun 1.3.11 was considered as an alternative runtime and monorepo manager. It was **rejected** due to hard compatibility blockers with forge-ts's core architecture:

| Issue | Severity | Detail |
|-------|----------|--------|
| TypeScript Compiler API crashes | **Hard blocker** | Seg faults and stack overflows when running `ts.createProgram` (GitHub issue #18960). The entire `@forge-ts/enforcer` subsystem is built on this API. |
| No `.d.ts` generation | **Hard blocker** | Bun cannot emit TypeScript declaration files. All forge-ts packages must ship `.d.ts` files for consumer type safety. |
| No topological build ordering | **Blocker** | Monorepo builds require dependency-ordered execution. Bun has no equivalent to `pnpm -r --filter`. |
| Partial `node:test` implementation | **Blocker** | `@forge-ts/doctest` requires per-test timeouts, automatic subtest awaiting, and `--test-rerun-failures` — features not fully implemented in Bun's `node:test` shim. |

**Conclusion**: Bun is not viable for forge-ts until it resolves TypeScript Compiler API compatibility at a fundamental level. Node.js 24.14.0 LTS ("Krypton") is the validated runtime.

### 5.2 Final Validated Stack

The research process produced the following concrete, version-pinned tooling decisions:

| Tool | Version | Rationale |
|------|---------|-----------|
| Node.js | 24.14.0 LTS ("Krypton") | Native TS stripping on by default, stable `node:test` (40% faster than prior releases), `require(esm)` enabled, V8 13.6 with `Float16Array` and `RegExp.escape()` |
| pnpm | 10.x | Battle-tested monorepo workspaces, topological builds via `pnpm -r`, zero Compiler API conflicts |
| TypeScript | 6.0 (beta/RC) | Last JS-based release. New compiler defaults eliminate boilerplate (`strict=true`, `target=es2025`, `module=esnext`). Note: `types` now defaults to `[]` — must explicitly include `@types/node`. |
| Vitest | 4.1.0 | Unit tests; stable browser mode, 28M weekly downloads, mature ecosystem |
| node:test | Built-in (Node 24) | DocTest execution; automatic subtest awaiting, `--test-rerun-failures`, per-test timeouts, smarter watch mode |
| Biome | 2.4 | Replaces ESLint + Prettier; 10-100x faster, 423+ lint rules, type-aware linting, single-binary distribution |
| @microsoft/tsdoc | 0.16.0 | TSDoc parsing; pre-1.0 but stable, 181 dependents, no viable alternative |
| tsup | 8.5.x | ESM bundling + `.d.ts` generation for published packages |

### 5.3 Key Risks and Mitigations

**Risk: TypeScript 7.0 Compiler API Migration**

TypeScript 7.0 (the Go rewrite, targeted mid-2026) will fundamentally change or break the Compiler API that `@forge-ts/enforcer` and `@forge-ts/doctest` depend on. This is the highest-impact known risk for forge-ts.

- **Mitigation**: The TS Compiler API surface is isolated behind `@forge-ts/enforcer`. When TS 7.0 stabilizes, the migration is contained to this package's internals rather than spanning the full monorepo.
- **Timeline**: TS 6.0 (JS-based) will remain on LTS support while 7.0 matures. No action required until TS 7.0 reaches a stable Compiler API release.
- **Trigger**: Begin migration spike when TS 7.0 publishes a stable Compiler API reference.

**Risk: Biome pre-stable features**

Biome 2.4 is mature for linting and formatting but some advanced features (e.g., project-wide type inference rules) are still evolving. ESLint-equivalent rules for all edge cases may not yet exist.

- **Mitigation**: Pin Biome to `2.4.x` in the monorepo root. Review Biome release notes on each minor bump before upgrading.