---
name: forge-ts
description: >
  Universal TypeScript documentation compiler. Enforces TSDoc coverage as a
  build gate, then generates all documentation artifacts from source code in
  one pass. Use when:
  (1) checking or enforcing TSDoc coverage on TypeScript exports,
  (2) running @example blocks as tests (doctests),
  (3) generating OpenAPI 3.2 specs from @route tags,
  (4) creating documentation sites (Mintlify, Docusaurus, Nextra, VitePress),
  (5) producing AI context files (llms.txt, llms-full.txt, SKILL.md),
  (6) configuring forge-ts.config.ts or per-rule enforcement,
  (7) understanding auto-generated vs stub doc pages and their idempotency,
  (8) user mentions "forge-ts", "TSDoc enforcement", "doctest", "documentation
  compiler", or asks about generating docs from TypeScript source.
---

# forge-ts

The documentation compiler for TypeScript. Enforces TSDoc as a build gate,
then generates everything from your documented source code in one pass.

## The Flow

```
Your TypeScript code
  |  Write TSDoc comments (@param, @returns, @example, etc.)
  v
forge-ts check   -->  FAILS if docs incomplete (exact fix suggestions)
  v
forge-ts build   -->  Generates ALL artifacts from TSDoc
  v
forge-ts docs init --target mintlify  -->  Writes adapter scaffold/config
  v
forge-ts docs dev  -->  Preview locally
```

## Quick Start

```bash
npm install -D @forge-ts/cli
npx forge-ts check          # Enforce TSDoc coverage
npx forge-ts test           # Run @example blocks as tests
npx forge-ts build          # Generate all artifacts
npx forge-ts docs init      # Write Mintlify adapter scaffold/config
npx forge-ts docs dev       # Launch dev server
```

JSON envelopes are actionable by default — agents in non-TTY contexts get
structured JSON automatically without needing `--human` or `--json` flags.

## SSoT Principle

Source code IS documentation. Change a function signature, docs update on
next build. Remove a parameter, docs remove it. Add an `@example`, it
becomes a doctest AND a doc page entry AND part of the SKILL.md.

## Auto-Generated vs Stub Pages

`forge-ts build` produces two categories of output:

### Auto-generated (regenerated every build, always fresh)

| Output | Source |
|--------|--------|
| `index.mdx` | package.json + @packageDocumentation |
| `getting-started.mdx` | First @example block |
| `configuration.mdx` | Detected Config types |
| `packages/<name>/api/functions.mdx` | @param, @returns, @example |
| `packages/<name>/api/types.mdx` | Interface properties |
| `packages/<name>/api/examples.mdx` | Aggregated @example blocks |
| `api/openapi.json` | Types + @route tags |
| `llms.txt` / `llms-full.txt` | Compact/dense AI context |
| `<project>/SKILL.md` | agentskills.io package |
| `docs.json` | SSG navigation config (when ssgTarget set) |

### Stubs (created once, never overwritten)

| Output | Purpose |
|--------|---------|
| `concepts.mdx` | Architecture, mental model (domain knowledge) |
| `guides/index.mdx` | How-to guides for specific tasks |
| `faq.mdx` | Common questions |
| `contributing.mdx` | Contribution guidelines |
| `changelog.mdx` | Release history |

Stubs contain `<!-- FORGE:AUTO-START id -->` / `<!-- FORGE:AUTO-END id -->`
markers. On rebuild, content inside markers is updated from source while
manual content outside markers is preserved.

**Idempotency**: Auto pages always overwritten. Stubs never overwritten
(only their FORGE:AUTO marker sections are refreshed).

**Progressive generation**: As your project grows (new packages, new exports),
auto pages grow automatically. New packages get their own
`packages/<name>/` directory. New functions appear in the API reference.

## build vs docs init

`forge-ts build` writes all doc pages, llms.txt, SKILL.md, and SSG config
into `outDir`. The JSON envelope's `generatedFiles` array lists every file
written. `forge-ts docs init` adds SSG-specific adapter config and scaffold
files (e.g. `docs.json` for Mintlify). Run `build` first for content, then
`docs init` if you need platform-specific setup.

## Skill Package Configuration

Inject custom workflow knowledge into the generated SKILL.md:

```typescript
// forge-ts.config.ts
skill: {
  customSections: [
    { heading: "The Flow", content: "check -> build -> docs init -> docs dev" },
    { heading: "SSoT Principle", content: "Source code IS documentation." },
  ],
  extraGotchas: [
    "Stub pages are NEVER overwritten — safe to edit after first build.",
    "@example blocks require fenced code blocks. Bare code is ignored.",
  ],
}
```

Custom sections appear after the auto-generated API summary. Extra gotchas
are appended to the auto-detected ones (@deprecated, @throws, enums).

## Enforcer Rules

| Code | What it checks |
|------|----------------|
| E001 | Exported symbol missing TSDoc summary |
| E002 | Function parameter missing `@param` tag |
| E003 | Non-void function missing `@returns` tag |
| E004 | Exported function missing `@example` block |
| E005 | Entry point missing `@packageDocumentation` |
| E006 | Class member missing documentation |
| E007 | Interface/type member missing documentation |
| E008 | `{@link}` references non-existent symbol |
| W004 | Importing `@deprecated` symbol cross-package |

Rules accept `"error"` | `"warn"` | `"off"` in config `enforce.rules`.
When `strict: true`, all warnings become errors.
Actionable JSON envelopes include `suggestedFix` so agents can apply the exact
TSDoc block to paste.

Fix examples and per-rule config: [references/enforcer-rules.md](references/enforcer-rules.md)

## Configuration

```typescript
// forge-ts.config.ts
import type { ForgeConfig } from "@forge-ts/core";

export default {
  rootDir: ".",
  outDir: "./docs/generated",
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: false,
    rules: {
      "require-example": "warn",    // downgrade E004
      "require-package-doc": "off", // disable E005
    },
  },
  gen: {
    formats: ["markdown"],
    llmsTxt: true,
    ssgTarget: "mintlify",  // or "docusaurus" | "nextra" | "vitepress"
  },
} satisfies Partial<ForgeConfig>;
```

Zero-config works out of the box. Full options: [references/configuration.md](references/configuration.md)

## Key Gotchas

- Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.
- Unknown config keys and unknown `enforce.rules` entries warn to stderr and are ignored.
- `@example` blocks require fenced code blocks. Bare code is silently ignored.
- `// => value` in examples auto-converts to `assert.strictEqual()` during doctest.
- `@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.
- OpenAPI paths require `@route GET /path` tags. No `@route` = empty `paths`.
- Mintlify adapter generates `docs.json` (v4 format), not `mint.json`.
- `forge-ts build` writes the documentation pages into `outDir`; `docs init`
  adds target-specific scaffold/config for the chosen SSG.
- Stub pages are NEVER overwritten — safe to edit immediately after first build.

## Packages

| Package | Purpose |
|---------|---------|
| `@forge-ts/cli` | Unified CLI (install this one) |
| `@forge-ts/core` | AST walker, config loader, shared types |
| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |
| `@forge-ts/doctest` | @example extraction + node:test runner |
| `@forge-ts/api` | OpenAPI 3.2 generation from types |
| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |

## References

- [references/configuration.md](references/configuration.md) — Full config options and defaults
- [references/enforcer-rules.md](references/enforcer-rules.md) — Rule details with fix examples
- [references/api-reference.md](references/api-reference.md) — Programmatic API (functions, types, signatures)
