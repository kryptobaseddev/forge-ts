---
name: forge-ts
description: >
  The universal TypeScript documentation compiler. Use this skill when working
  with forge-ts or any TypeScript project that uses it for documentation. Use
  when you need to check TSDoc coverage, run @example blocks as tests, generate
  OpenAPI specs, create documentation sites (Mintlify, Docusaurus, Nextra,
  VitePress), or produce AI context files (llms.txt, SKILL.md). Also use when
  a user mentions "forge-ts", "TSDoc enforcement", "doctest", "documentation
  compiler", or asks about generating docs from TypeScript source code.
license: MIT
compatibility: Requires Node.js >=24 and a TypeScript project with tsconfig.json
metadata:
  author: kryptobaseddev
  version: "0.5.0"
  repository: https://github.com/kryptobaseddev/forge-ts
allowed-tools: Bash(npx:*) Bash(node:*) Read Write
---

# forge-ts

The universal documentation compiler for any TypeScript project. Write your
TypeScript, write your TSDoc comments, run one command, get everything:
OpenAPI specs, executable doctests, AI context files, and SSG-ready docs.

## Installation

```bash
npm install -D @forge-ts/cli
```

## Core Commands

### Check TSDoc coverage

Validates every public export has proper TSDoc. Fails the build if not.

```bash
npx forge-ts check
```

Agent-friendly JSON output with exact fix suggestions:

```bash
npx forge-ts check --json --mvi full
```

The `--mvi` flag controls detail level:
- `minimal` — summary counts only (~50 tokens)
- `standard` — per-file error breakdown (~200 tokens)
- `full` — exact TSDoc templates to paste (~500+ tokens)

### Run doctests

Extracts `@example` blocks from TSDoc and runs them as real tests:

```bash
npx forge-ts test
```

### Generate everything

Single command produces all documentation artifacts:

```bash
npx forge-ts build
```

Output: `openapi.json`, Markdown/MDX pages, `llms.txt`, `llms-full.txt`,
`SKILL.md` package, and SSG navigation config.

### Scaffold a doc site

```bash
npx forge-ts docs init --target mintlify
npx forge-ts docs dev
```

Supported targets: `mintlify` (default), `docusaurus`, `nextra`, `vitepress`.

## Enforcer Rules

When `forge-ts check` fails, errors include `suggestedFix` with the exact
TSDoc block to add. Here are all rules:

| Code | Severity | What it checks |
|------|----------|----------------|
| E001 | error | Exported symbol missing TSDoc summary |
| E002 | error | Function parameter missing `@param` tag |
| E003 | error | Non-void function missing `@returns` tag |
| E004 | error | Exported function missing `@example` block |
| E005 | warn | Entry point missing `@packageDocumentation` |
| E006 | error | Class member missing documentation |
| E007 | error | Interface/type member missing documentation |
| E008 | error | `{@link SymbolName}` references non-existent symbol |
| W004 | warn | Importing `@deprecated` symbol from another package |

Rules are configurable per-project in `forge-ts.config.ts`:

```typescript
enforce: {
  rules: {
    "require-example": "warn",     // downgrade from error
    "require-package-doc": "off",  // disable entirely
  }
}
```

## Configuration

Create `forge-ts.config.ts` at project root:

```typescript
import type { ForgeConfig } from "@forge-ts/core";

export default {
  rootDir: ".",
  outDir: "./docs/generated",
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: false,
  },
  gen: {
    formats: ["markdown"],
    llmsTxt: true,
    readmeSync: false,
    ssgTarget: "mintlify",
  },
} satisfies Partial<ForgeConfig>;
```

Zero-config also works — sensible defaults apply.

See [references/CONFIGURATION.md](references/CONFIGURATION.md) for all options.

## Gotchas

- The enforcer checks ALL files in the tsconfig. Exclude test fixtures
  and generated code via tsconfig `exclude` or they'll trigger errors.
- `@example` blocks must contain fenced code blocks (triple backticks).
  Bare code without fences is silently ignored.
- The `// => value` pattern inside examples auto-converts to
  `assert.strictEqual(expr, value)` during doctest execution.
- `@internal` symbols are excluded from ALL generated output (docs,
  OpenAPI, llms.txt). Use this to hide implementation details.
- `@beta` symbols appear in docs but are filtered when
  `minVisibility: "public"` is set.
- OpenAPI paths are only generated for functions with `@route` tags
  (e.g., `@route GET /users/{id}`). Without `@route`, paths is `{}`.
- The Mintlify adapter generates `docs.json` (not `mint.json` — renamed
  in Mintlify v4).
- `forge-ts docs dev` uses `npx @mintlify/cli dev` under the hood.
  No global install needed.
- Generated `SKILL.md` packages follow the agentskills.io specification
  and work with any Agent Skills-compatible client.

## Output Structure

After `forge-ts build`, the output directory contains:

```
docs/generated/
  index.mdx                    — Landing page
  getting-started.mdx          — Step-by-step tutorial
  concepts.mdx                 — Core concepts (stub)
  configuration.mdx            — Config reference
  faq.mdx                      — FAQ (stub)
  packages/
    <name>/
      index.mdx                — Package overview
      api/index.mdx            — API symbol table
      api/functions.mdx        — Function docs with signatures
      api/types.mdx            — Interface/enum property tables
      api/examples.mdx         — Aggregated @example blocks
  api/openapi.json             — OpenAPI 3.2 spec
  llms.txt                     — AI routing manifest
  llms-full.txt                — Dense AI context
  <project>/SKILL.md           — Agent Skills package
  docs.json                    — Mintlify nav config
```

## Packages

| Package | What it does |
|---------|-------------|
| `@forge-ts/cli` | Unified CLI — install this one |
| `@forge-ts/core` | AST walker, config loader, shared types |
| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |
| `@forge-ts/doctest` | @example extraction + node:test execution |
| `@forge-ts/api` | OpenAPI 3.2 generation from types |
| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |

## LAFS Protocol Integration

All CLI output supports the `@cleocode/lafs-protocol` envelope format:

```bash
forge-ts check --json                    # LAFS JSON envelope
forge-ts check --json --mvi minimal      # Token-efficient
forge-ts check --json --mvi full         # Includes suggestedFix
forge-ts check --human                   # Formatted for terminals
forge-ts check --quiet                   # Suppress non-error output
```

The JSON output wraps results in a `LAFSEnvelope` with `_meta`, `success`,
`result`, and `error` fields. Agents should parse `result.summary` for
counts and `result.byFile` for per-file error details.

See [references/API-REFERENCE.md](references/API-REFERENCE.md) for the
full programmatic API when using forge-ts as a library.
