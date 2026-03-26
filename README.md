# forge-ts

> The Hallucination Killer. A documentation compiler that FORCES structural clarity in TypeScript.

[![npm version](https://img.shields.io/npm/v/@forge-ts/cli?style=flat-square&label=@forge-ts/cli)](https://www.npmjs.com/package/@forge-ts/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/kryptobaseddev/forge-ts/ci.yml?style=flat-square&label=CI)](https://github.com/kryptobaseddev/forge-ts/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0.2-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js: >=24](https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)

If it isn't documented, it isn't finished. If the docs are stale, the build is broken.

forge-ts performs a **single AST traversal** of your TypeScript project and compiles TSDoc into OpenAPI specs, executable doctests, AI context files, and SSG-ready documentation. **37 enforcement rules** across 5 layers ensure documentation is never optional, never stale, and never wrong.

---

## Proven Results

forge-ts dogfoods itself. Every claim below is verified by the codebase.

| Metric | Value |
|--------|-------|
| Enforcement rules | **37** across 5 layers (API, Dev, Consumer, LLM Anti-Pattern, Staleness) |
| Symbols checked | **363** across 6 packages |
| TSDoc errors | **0** (forge-ts passes its own full check) |
| Tests | **859** passing across 20 test files |
| Barometer score | **93% (Elite SSoT)** -- a zero-context agent answered 14/15 questions correctly using only generated docs |

### The Barometer Test

We built `forge-ts barometer` -- a command that generates questions from the AST and tests whether the generated docs are accurate enough for an agent with zero prior context. An agent reading only `llms-full.txt` scored **93%**, proving the vision: code IS the documentation, and forge-ts makes it true.

```
Pre-fix barometer:  35% (Stale/Shallow) -- @remarks silently dropped
Post-fix barometer: 93% (Elite SSoT)    -- @remarks pipeline restored
```

---

## Quick Start

```bash
npm install -D @forge-ts/cli

npx forge-ts check            # Lint TSDoc coverage (37 rules)
npx forge-ts test              # Run @example blocks as tests
npx forge-ts build             # Generate all artifacts in one pass
npx forge-ts barometer         # Test documentation effectiveness
npx forge-ts doctor            # Validate project setup
```

---

## What It Generates

```
Your TypeScript + TSDoc
        |
        v
  forge-ts build
        |
   +----+----------------------------------------+
   |              |              |                |
   v              v              v                v
OpenAPI 3.2   Doctests      AI Context       Markdown/MDX
  specs      (@example     (llms.txt /      (Docusaurus /
(openapi.json) blocks)    llms-full.txt)    Mintlify /
                                             Nextra /
                                             VitePress)
```

| Output | Description |
|--------|-------------|
| **OpenAPI 3.2** | Machine-readable API specs from exported types and `@route` tags |
| **Doctests** | `@example` blocks extracted and executed via Node 24's `node:test` runner |
| **AI context** | Token-optimized `llms.txt` and `llms-full.txt` with `@remarks` content for LLM agents |
| **Markdown/MDX** | SSG-ready docs grouped by package with `@packageDocumentation` summaries |
| **SKILL packages** | Agent-consumable skill bundles following the agentskills.io spec |
| **README sync** | Keeps your GitHub front page synchronized with your code |

---

## The Five Pillars

### 1. The Hallucination Killer (Enforcement)

Undocumented code is broken code. forge-ts FORCES explicit `@param`, `@returns`, `@remarks`, and `@example` on every public symbol. Agents can't guess -- they read what's documented.

**37 rules** across 5 layers:

| Layer | Rules | What It Catches |
|-------|-------|----------------|
| **API** | E001-E008, W003-W004 | Missing summary, params, returns, examples, package docs, dead links |
| **Dev** | E013-E015, E017-E018, W005-W006, W009 | Missing @remarks, @typeParam, @see; TSDoc syntax errors |
| **Consumer** | E016, W007-W008, W010-W011 | Missing release tags, stale guides, undocumented exports |
| **LLM Anti-Pattern** | E019-E020, W012-W013 | @ts-ignore in non-test files, `any` in public APIs, stale examples |
| **Staleness** | W014-W017 | @param name drift, param count mismatch, void @returns, placeholder @remarks |

### 2. The Deterministic Layer (Generation)

Extraction > Inference. forge-ts extracts documentation from your AST -- it never guesses, summarizes, or hallucinates. The generated `llms-full.txt` includes full `@remarks` content so agents understand implementation details, not just signatures.

### 3. Agent-Proof Guardrails

Agents take the easy way out. forge-ts blocks the exit.

- **Config Locking**: `forge-ts lock` snapshots rule severities. Weakening them triggers E010.
- **Audit Trail**: Every change logged to `.forge-audit.jsonl` with user, timestamp, and reason.
- **Bypass Budget**: 3 bypasses/day max, each requires `--reason` and expires in 24h.
- **Guard Rules**: E009-E012 detect tsconfig loosening, Biome weakening, engine downgrades.

### 4. Safety Pipeline

Pre-commit, not post-mortem.

```bash
npx forge-ts init hooks        # Scaffold husky/lefthook pre-commit hooks
npx forge-ts prepublish        # Safety gate: check + build before npm publish
```

### 5. Documentation Effectiveness Testing

```bash
npx forge-ts barometer                    # Generate Q&A from AST
npx forge-ts barometer --questions-only   # Questions only (for test agents)
```

The barometer generates questions from your code, produces an answer key, and scores on a 4-band rubric:

| Score | Rating | Meaning |
|-------|--------|---------|
| 90-100% | **Elite SSoT** | Agents operate with zero source code access |
| 70-89% | **High Fidelity** | Excellent, might miss some @remarks details |
| 50-69% | **Standard** | Useful for usage, architecture needs source access |
| 0-49% | **Stale/Shallow** | Needs deeper @remarks and @example coverage |

---

## Agent-First Design

forge-ts is built for LLM agent pipelines. Every command supports `--json` output with LAFS envelopes and machine-readable exit codes.

```bash
# Structured JSON output for agents and CI
forge-ts check --json

# Token-efficient minimal output for agentic loops
forge-ts check --mvi minimal

# Feed generated context directly to your agent
cat docs/generated/llms-full.txt | your-agent-cli
```

The `llms.txt` and `llms-full.txt` outputs follow the [llms.txt standard](https://llmstxt.org), giving any AI assistant accurate, up-to-date context about your project's API surface — including `@remarks` implementation details — without hallucination.

---

## Configuration

Zero-config by default. Optionally create `forge-ts.config.ts`:

```typescript
import { defineConfig } from "@forge-ts/core";

export default defineConfig({
  rootDir: ".",
  outDir: "./docs/generated",
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: false,
    rules: {
      "require-example": "warn",
      "require-remarks": "error",
    },
  },
  doctest: {
    enabled: true,
    cacheDir: ".cache/doctest",
  },
  api: {
    enabled: true,
    openapi: true,
    openapiPath: "./docs/generated/openapi.json",
  },
  gen: {
    enabled: true,
    formats: ["markdown"],
    llmsTxt: true,
    readmeSync: false,
    ssgTarget: "mintlify",
  },
});
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `forge-ts check` | Lint TSDoc coverage. 37 rules. Supports `--staged` for pre-commit. |
| `forge-ts test` | Run `@example` blocks as doctests via `node:test`. |
| `forge-ts build` | Generate OpenAPI, docs, llms.txt, SKILL packages. |
| `forge-ts barometer` | Generate documentation effectiveness Q&A from AST. |
| `forge-ts init` | Full project setup: config, tsdoc.json, scripts. |
| `forge-ts init docs` | Scaffold SSG documentation site. |
| `forge-ts init hooks` | Scaffold pre-commit hooks (Husky/Lefthook). |
| `forge-ts docs dev` | Start local doc preview server. |
| `forge-ts lock` | Snapshot config to prevent drift. |
| `forge-ts unlock` | Remove lock with mandatory `--reason`. |
| `forge-ts bypass` | Temporary rule exemption with daily budget. |
| `forge-ts audit` | View append-only audit trail. |
| `forge-ts prepublish` | Safety gate: check + build before publish. |
| `forge-ts doctor` | Validate project setup. Supports `--fix`. |
| `forge-ts version` | Print version. Also `-V`, `-v`. |

All commands support `--json` (LAFS envelope), `--human`, `--quiet`, `--mvi`.

### `forge-ts check`

Validates TSDoc coverage across all public exports. Use as a CI build gate.

```bash
forge-ts check [--strict] [--staged] [--verbose] [--rule E001] [--file src/] [--cwd <dir>]
```

| Flag | Description |
|------|-------------|
| `--strict` | Treat warnings as errors |
| `--staged` | Only check git-staged `.ts`/`.tsx` files (fast pre-commit) |
| `--rule E001` | Filter to a specific rule code |
| `--file src/types.ts` | Filter to files matching substring |
| `--limit 20` | Max file groups per page (pagination) |
| `--mvi minimal` | Counts only (~50 tokens) |
| `--mvi full` | Full details with `suggestedFix` |

### `forge-ts test`

Extracts `@example` blocks and runs them as tests via Node 24's built-in `node:test` runner.

```bash
forge-ts test [--cwd <dir>]
```

### `forge-ts build`

Generates all outputs in a single AST traversal.

```bash
forge-ts build [--skip-api] [--skip-gen] [--force-stubs] [--cwd <dir>]
```

| Flag | Description |
|------|-------------|
| `--skip-api` | Skip OpenAPI spec generation |
| `--skip-gen` | Skip Markdown/MDX and llms.txt generation |
| `--force-stubs` | Overwrite stub pages (reset to scaffolding) |

---

## SSG Targets

Set `gen.ssgTarget` in your config to target your documentation platform:

| Target | Output Format | Description |
|--------|--------------|-------------|
| `"mintlify"` | MDX | Mintlify docs.json navigation (default) |
| `"docusaurus"` | MDX | Docusaurus sidebar config |
| `"nextra"` | MDX | Nextra v4 App Router with `_meta.json` |
| `"vitepress"` | Markdown | VitePress `.vitepress/config.mts` |

---

## Supported TSDoc Tags

### Standard Tags (enforced)

| Tag | Description |
|-----|-------------|
| `@param` | Parameter documentation (E002) |
| `@returns` | Return value documentation (E003) |
| `@throws` | Exception documentation |
| `@example` | Executable code example — becomes a doctest (E004) |
| `@remarks` | Implementation details for agents (E013) |
| `@defaultValue` | Default value for optional properties (E014) |
| `@typeParam` | Generic type parameter documentation (E015) |
| `@public` | Mark as public API (E016 requires one of public/beta/internal) |
| `@beta` | Mark as beta / unstable |
| `@internal` | Exclude from generated docs |
| `@deprecated` | Mark as deprecated with explanation (W003) |
| `@see` | Cross-reference to related symbols (W005) |
| `@since` | Version when symbol was introduced (W011) |

### Custom Tags (15 tags via `@forge-ts/core/tsdoc-preset`)

| Tag | Kind | Description |
|-----|------|-------------|
| `@route` | block | HTTP route path for OpenAPI (e.g., `@route GET /api/users`) |
| `@category` | block | Symbol grouping for guide discovery |
| `@guide` | block | Associates symbol with a named guide page |
| `@concept` | block | Links symbol to a concepts page section |
| `@response` | block | HTTP response type/status for OpenAPI |
| `@query` | block | Query parameter documentation |
| `@header` | block | HTTP header documentation |
| `@body` | block | Request body schema |
| `@quickstart` | modifier | "Start here" marker |
| `@faq` | block | FAQ entry association |
| `@breaking` | block | Breaking change documentation (W010 requires `@migration`) |
| `@migration` | block | Migration path from old API |
| `@complexity` | block | Algorithmic complexity |
| `@forgeIgnore` | modifier | Skip all enforcement on this symbol |

---

## Packages

| Package | Description |
|---------|-------------|
| `@forge-ts/core` | TypeScript Compiler API walker, ForgeSymbol graph, config loader, lock/audit/bypass |
| `@forge-ts/enforcer` | 37 rules across 5 layers with per-rule severity config |
| `@forge-ts/doctest` | `@example` extraction + Node 24 `node:test` runner |
| `@forge-ts/api` | OpenAPI 3.2.0 generation from `@route` tags |
| `@forge-ts/gen` | Markdown/MDX, SSG adapters, llms.txt, SKILL packages, guide discovery |
| `@forge-ts/cli` | Unified CLI (citty + consola), 15 commands |

---

## Technology

| Tool | Version | Role |
|------|---------|------|
| TypeScript | 6.0.2 | Compiler API -- last JS-based release before Go rewrite |
| Node.js | 24 LTS | Runtime with native TS stripping and stable `node:test` |
| @microsoft/tsdoc | 0.16 | Standards-compliant TSDoc parsing |
| @cleocode/lafs | 2026.3.x | LLM-Agent-First output protocol |
| Biome | 2.4 | Linting + formatting |
| Vitest | 4.1 | Unit testing |
| @codluv/versionguard | 0.4 | Version governance |

---

## The Vision

forge-ts exists because LLM agents are primary contributors now, and undocumented code is a liability. Agents can't infer intent from messy code -- they hallucinate. forge-ts eliminates hallucination by forcing explicit, structured documentation at the compiler level, then extracting it deterministically into artifacts that agents consume with zero context.

**Extraction > Inference. Always.**

Read the full vision: [docs/VISION.md](docs/VISION.md)

---

## License

[MIT](LICENSE)
