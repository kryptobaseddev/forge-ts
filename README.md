# forge-ts

> The universal documentation compiler for any TypeScript project.

[![npm version](https://img.shields.io/npm/v/@forge-ts/cli?style=flat-square&label=forge-cli)](https://www.npmjs.com/package/@forge-ts/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/kryptobaseddev/forge-ts/ci.yml?style=flat-square&label=CI)](https://github.com/kryptobaseddev/forge-ts/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js: >=24](https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)

Write your TypeScript. Write your TSDoc. Run `npx forge-ts build`. Get everything.

forge-ts performs a **single AST traversal** of your TypeScript project and produces OpenAPI specs, executable doctests, AI context files, and SSG-ready docs — all from the TSDoc comments you were writing anyway.

---

## What It Generates

```
Your TypeScript + TSDoc
        │
        ▼
  forge-ts build
        │
   ┌────┴────────────────────────────────────────┐
   │                                              │
   ▼                ▼              ▼              ▼
OpenAPI 3.2    Doctests       AI Context     Markdown/MDX
  specs       (@example      (llms.txt /    (Docusaurus /
(openapi.json)  blocks)     llms-full.txt)  Mintlify /
                                             Nextra /
                                             VitePress)
```

| Output | Description |
|--------|-------------|
| **OpenAPI 3.2** | Machine-readable API specs generated from your exported types and interfaces |
| **Doctests** | `@example` blocks extracted and executed as real tests via Node's test runner |
| **AI context** | `llms.txt` and `llms-full.txt` for feeding LLM agents accurate project context |
| **Markdown/MDX** | SSG-ready docs for Docusaurus, Mintlify, Nextra, or VitePress |
| **README sync** | Keeps your GitHub front page automatically up-to-date |

---

## Quick Start

```bash
# Install the CLI
npm install -D @forge-ts/cli

# Check TSDoc coverage across all public exports
npx forge-ts check

# Run @example blocks as tests
npx forge-ts test

# Generate everything (OpenAPI, docs, AI context)
npx forge-ts build
```

---

## Configuration

Zero-config by default. Optionally create `forge-ts.config.ts` in your project root:

```typescript
import type { ForgeConfig } from "@forge-ts/core";

export default {
  rootDir: ".",
  tsconfig: "./tsconfig.json",
  outDir: "./docs/generated",
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: false,
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
    ssgTarget: "docusaurus",
  },
} satisfies Partial<ForgeConfig>;
```

---

## Commands

### `forge-ts check`

Validates that all public exports have TSDoc comments. Use this as a build gate in CI.

```bash
forge-ts check [--strict] [--verbose] [--json] [--cwd <dir>]
```

| Flag | Description |
|------|-------------|
| `--strict` | Fail on any missing tag (overrides config `strict` setting) |
| `--verbose` | Print all checked symbols, not just failures |
| `--json` | Output results as JSON (ideal for LLM agents and CI parsing) |
| `--cwd <dir>` | Run as if started in `<dir>` (useful for monorepos) |

### `forge-ts test`

Extracts `@example` blocks from your TSDoc and runs them as tests via Node's built-in test runner.

```bash
forge-ts test [--json] [--cwd <dir>]
```

| Flag | Description |
|------|-------------|
| `--json` | Output test results as JSON |
| `--cwd <dir>` | Run as if started in `<dir>` |

### `forge-ts build`

Generates all outputs in a single AST traversal: OpenAPI specs, Markdown/MDX docs, and AI context files.

```bash
forge-ts build [--skip-api] [--skip-gen] [--json] [--cwd <dir>]
```

| Flag | Description |
|------|-------------|
| `--skip-api` | Skip OpenAPI spec generation |
| `--skip-gen` | Skip Markdown/MDX and llms.txt generation |
| `--json` | Output results as JSON |
| `--cwd <dir>` | Run as if started in `<dir>` |

---

## Agent-First Design

forge-ts is built to work inside LLM agent pipelines. Every command supports `--json` output and machine-readable exit codes.

```bash
# Structured JSON output for LLM agents and CI
forge-ts check --json

# Token-efficient output for agentic loops
forge-ts build --json

# Feed generated context directly to your agent
cat docs/generated/llms.txt | your-agent-cli
```

The `llms.txt` and `llms-full.txt` outputs follow the [llms.txt standard](https://llmstxt.org), giving any AI assistant accurate, up-to-date context about your project's API surface without hallucination.

---

## SSG Targets

Set `gen.ssgTarget` in your config to target your documentation platform:

| Target | Output Format | Front Matter |
|--------|--------------|-------------|
| `"docusaurus"` | MDX | Docusaurus-compatible |
| `"mintlify"` | MDX | Mintlify meta blocks |
| `"nextra"` | MDX | Nextra page config |
| `"vitepress"` | Markdown | VitePress frontmatter |

---

## Supported TSDoc Tags

| Tag | Description |
|-----|-------------|
| `@param` | Parameter documentation |
| `@returns` | Return value documentation |
| `@throws` | Exception documentation |
| `@example` | Executable code example (becomes a doctest) |
| `@public` | Mark export as public API |
| `@beta` | Mark as beta / unstable |
| `@internal` | Exclude from generated docs |
| `@deprecated` | Mark as deprecated with message |

---

## Packages

| Package | Description |
|---------|-------------|
| `@forge-ts/core` | Shared types, config loader, and AST walker |
| `@forge-ts/enforcer` | TSDoc enforcement — the build gate |
| `@forge-ts/doctest` | `@example` block extraction and test execution |
| `@forge-ts/api` | OpenAPI 3.2 spec generation from TypeScript types |
| `@forge-ts/gen` | Markdown, MDX, and `llms.txt` generation |
| `@forge-ts/cli` | Unified CLI entry point |

---

## Technology Stack

| Dependency | Version | Role |
|------------|---------|------|
| TypeScript | 6.0 beta | Compiler API for AST traversal |
| @microsoft/tsdoc | 0.16 | Standards-compliant TSDoc parsing |
| Node.js | >=24 LTS | Runtime with native TypeScript support |
| Biome | 2.4 | Linting and formatting |
| Vitest | 4.x | Test runner |
| citty | 0.2 | CLI framework |
| @changesets/cli | 2.x | Release management |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, workflow, and code standards.

## License

[MIT](LICENSE)
