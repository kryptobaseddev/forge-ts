# VISION: Forge (`forge-ts`)

## The Premise
As of 2026, the TypeScript ecosystem has matured incredibly in type safety, build tooling (esbuild, swc), and runtime engines (Node 24 LTS "Krypton", Deno). Yet, the documentation and API specification layer remains a fractured relic of the past. Teams currently stitch together ESLint plugins, TypeDoc, Zod schemas, and Swagger generators just to achieve what the Rust ecosystem gets out-of-the-box with a single command: `cargo doc`.

Worse, in the era of AI-driven development, documentation isn't just for humans anymore. LLM agents need dense, high-signal context (`llms.txt`), and existing HTML-heavy documentation generators fail to deliver this natively.

## The Vision
**To build `forge-ts` (Forge): The universal documentation compiler for *any* TypeScript project.**

Whether you are building a React frontend, a Node.js REST API, a CLI tool, or a utility SDK, `forge-ts` acts as the uncompromising Single Source of Truth (SSoT). Built natively on the **TypeScript 6.0 Compiler API** — the last JavaScript-based release before the Go rewrite in TS 7.0 — it captures and dynamically generates documentation across three distinct layers:

### 1. API Docs (The Contract Layer)
For REST/GraphQL APIs and SDKs, `forge-ts` crawls your routing controllers and exported symbols. It emits perfect, strictly-typed `openapi.json` (Swagger) specs and API References without runtime reflection. It strictly respects tags like `@public`, `@beta`, and `@internal` so you never leak private APIs.

### 2. Dev Docs & AI Context (The Contributor Layer)
Documentation must be trusted by developers and instantly understood by AI.
- **DocTests:** Code examples in comments (`@example`) are extracted and run natively via Node 24.14.0 LTS's `node:test` runner (now stable with automatic subtest awaiting, per-test timeouts, and `--test-rerun-failures`). If an example rots, the test suite fails. Documentation is executable code.
- **AI Context:** Natively generates token-optimized `llms.txt` and `llms-full.txt` artifacts. It aggregates OpenAPI specs, TSDoc comments, and repository guidelines into a dense format, ensuring that AI agents (Cursor, Copilot, Claude) instantly understand the codebase.
- **Build Gate:** Acts as a strict, zero-config linter during `npm run build`, powered by **Biome 2.4** (replacing the ESLint + Prettier combination), aggressively failing the build if developers try to push new public features without TSDoc comments.

### 3. Consumer Docs (The User-Facing Layer)
Instead of dumping raw JSON, `forge-ts` outputs clean, beautifully formatted Markdown/MDX files ready to be dropped into static site generators like Docusaurus, Mintlify, Nextra, or VitePress. It dynamically injects your primary code examples and API summaries directly into the project's `README.md` (similar to `cargo-rdme`), ensuring your GitHub front page is always perfectly synchronized with your actual code.

## Technology Foundation

The validated tooling stack (as of March 2026):

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS ("Krypton") | Runtime — native TS stripping, stable `node:test`, `node:sqlite` RC |
| TypeScript | 6.0 (beta/RC) | Compiler API — last JS-based release; new defaults: `strict=true`, `target=es2025`, `module=esnext` |
| pnpm | 10.x | Monorepo workspaces with topological build ordering |
| Vitest | 4.1.0 | Unit test layer (28M weekly downloads, stable browser mode) |
| Biome | 2.4 | Linting + formatting — replaces ESLint + Prettier, 10-100x faster, 423+ rules |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing |
| citty | 0.2.1 | Type-safe CLI framework (zero deps, 2.9kB) |
| @cleocode/lafs-protocol | 1.7.0 | LLM-Agent-First output layer |
| @changesets/cli | 2.x | Monorepo versioning with fixed version strategy |
| tsup | 8.5.x | ESM bundling + `.d.ts` generation |

### Future-Proofing: TypeScript 7.0

TypeScript 7.0 (the Go rewrite, targeted mid-2026) will fundamentally change the Compiler API. `forge-ts` is architected on TS 6.0's stable API surface and will require a targeted migration once TS 7.0 reaches stability. The core AST traversal abstraction (`@forge-ts/enforcer`) is isolated precisely to contain this migration cost.

## The Future
By centralizing API specs, Dev Docs, and Consumer Docs into a single AST-traversing pass, `forge-ts` eliminates configuration fatigue, prevents documentation rot, and empowers both developers and autonomous agents to work with perfect clarity. Write your code and TSDoc once, run `npx forge-ts build`, and derive everything.